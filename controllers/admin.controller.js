import Admin from "../models/admin.model.js";
import Customer from "../models/customer.model.js";
import Supplier from "../models/supplier.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import Category from "../models/category.model.js";
import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import Review from "../models/review.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import cloudinary from "cloudinary";

// Get admin profile
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }
  
  // Add joinDate to response
  const adminObj = admin.toObject();
  adminObj.joinDate = admin.createdAt;
  return res.status(200).json(
    new ApiResponse(
      200,
      { admin: adminObj },
      "Admin profile fetched successfully"
    )
  );
});

// Update admin profile
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const { name, phone, location, company, avatar, notificationPreferences } = req.body;
  
  const updateFields = {};
  
  if (name) updateFields.name = name;
  if (phone) updateFields.phone = phone;
  if (location) updateFields.location = location;
  if (company) updateFields.company = company;
  if (avatar) updateFields.avatar = avatar;
  if (notificationPreferences) updateFields.notificationPreferences = notificationPreferences;
  
  const updatedAdmin = await Admin.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!updatedAdmin) {
    throw new ApiError(404, "Admin not found");
  }
  
  // Add joinDate to response
  const adminObj = updatedAdmin.toObject();
  adminObj.joinDate = updatedAdmin.createdAt;
  return res.status(200).json(
    new ApiResponse(
      200,
      { admin: adminObj },
      "Admin profile updated successfully"
    )
  );
});

// Change admin password
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ApiError(400, "All password fields are required");
  }
  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "New passwords do not match");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }
  // Add more password requirements as needed
  const admin = await Admin.findById(req.user._id);
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }
  const isMatch = await admin.isPasswordCorrect(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, "Current password is incorrect");
  }
  admin.password = newPassword;
  await admin.save();
  return res.status(200).json(new ApiResponse(200, {}, "Password updated successfully"));
});

// Upload admin avatar
export const uploadAdminAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }

  // Upload buffer to Cloudinary
  const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        { folder: "admin-avatars" },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      stream.end(buffer);
    });
  };

  let uploadResult;
  try {
    uploadResult = await streamUpload(req.file.buffer);
  } catch (error) {
    throw new ApiError(500, "Error uploading avatar");
  }

  if (!uploadResult || !uploadResult.secure_url) {
    throw new ApiError(500, "Error uploading avatar");
  }

  // Update admin profile with new avatar URL
  const updatedAdmin = await Admin.findByIdAndUpdate(
    req.user._id,
    { $set: { avatar: uploadResult.secure_url } },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");

  if (!updatedAdmin) {
    throw new ApiError(404, "Admin not found");
  }

  // Add joinDate to response
  const adminObj = updatedAdmin.toObject();
  adminObj.joinDate = updatedAdmin.createdAt;
  return res.status(200).json(
    new ApiResponse(
      200,
      { avatar: uploadResult.secure_url, admin: adminObj },
      "Avatar updated successfully"
    )
  );
});

// Get all customers
export const getAllCustomers = asyncHandler(async (req, res) => {
  const { 
    search, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = {};
  
  // Search by name or email
  if (search) {
    queryOptions.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get customers with pagination
  const customers = await Customer.find(queryOptions)
    .select("-password -passwordResetToken -passwordResetExpires")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalCustomers = await Customer.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        customers,
        pagination: {
          total: totalCustomers,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalCustomers / parseInt(limit))
        }
      },
      "Customers fetched successfully"
    )
  );
});

// Get customer by ID
export const getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const customer = await Customer.findById(id)
    .select("-password -passwordResetToken -passwordResetExpires");
  
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { customer },
      "Customer fetched successfully"
    )
  );
});

// Get all suppliers
export const getAllSuppliers = asyncHandler(async (req, res) => {
  const { 
    search, 
    status,
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = {};
  
  // Search by business name, owner name, or email
  if (search) {
    queryOptions.$or = [
      { businessName: { $regex: search, $options: "i" } },
      { ownerName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }
  
  // Filter by status
  if (status) {
    queryOptions.status = status;
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get suppliers with pagination
  const suppliers = await Supplier.find(queryOptions)
    .select("-password -passwordResetToken -passwordResetExpires")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalSuppliers = await Supplier.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        suppliers,
        pagination: {
          total: totalSuppliers,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalSuppliers / parseInt(limit))
        }
      },
      "Suppliers fetched successfully"
    )
  );
});

// Get supplier by ID
export const getSupplierById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const supplier = await Supplier.findById(id)
    .select("-password -passwordResetToken -passwordResetExpires");
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier },
      "Supplier fetched successfully"
    )
  );
});

// Update supplier verification status
export const updateSupplierStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, verificationNotes } = req.body;
  
  if (!status) {
    throw new ApiError(400, "Status is required");
  }
  
  // Validate status
  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new ApiError(400, "Invalid status");
  }
  
  const supplier = await Supplier.findById(id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update status
  supplier.status = status;
  
  // Add verification details if approved or rejected
  if (status === "approved") {
    supplier.verifiedAt = new Date();
    supplier.verifiedBy = req.user._id;
    supplier.verificationNotes = verificationNotes || "Approved by admin";
    
    // Also mark all documents as verified if they exist
    if (supplier.documents && supplier.documents.length > 0) {
      supplier.documents.forEach(doc => {
        doc.isVerified = true;
        doc.verifiedAt = new Date();
        doc.verifiedBy = req.user._id;
        doc.verificationNotes = "Auto-verified with supplier approval";
      });
    }
  } else if (status === "rejected") {
    supplier.verificationNotes = verificationNotes || "Rejected by admin";
  }
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier },
      `Supplier ${status} successfully`
    )
  );
});

// Verify supplier document
export const verifySupplierDocument = asyncHandler(async (req, res) => {
  const { supplierId, documentId } = req.params;
  const { isVerified, notes } = req.body;
  
  if (isVerified === undefined) {
    throw new ApiError(400, "Verification status is required");
  }
  
  const supplier = await Supplier.findById(supplierId);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Find document
  const documentIndex = supplier.documents.findIndex(
    doc => doc._id.toString() === documentId
  );
  
  if (documentIndex === -1) {
    throw new ApiError(404, "Document not found");
  }
  
  // Update document verification
  supplier.documents[documentIndex].isVerified = isVerified;
  supplier.documents[documentIndex].verificationNotes = notes;
  supplier.documents[documentIndex].verifiedAt = new Date();
  supplier.documents[documentIndex].verifiedBy = req.user._id;
  
  // Check if all documents are verified and automatically update supplier status
  const allDocumentsVerified = supplier.documents.every(doc => doc.isVerified === true);
  const anyDocumentRejected = supplier.documents.some(doc => doc.isVerified === false);
  
  if (allDocumentsVerified && supplier.documents.length > 0) {
    // All documents are verified, approve the supplier
    supplier.status = "approved";
    supplier.verifiedAt = new Date();
    supplier.verifiedBy = req.user._id;
    supplier.verificationNotes = "Auto-approved: All documents verified";
  } else if (anyDocumentRejected) {
    // At least one document is rejected, reject the supplier
    supplier.status = "rejected";
    supplier.verificationNotes = "Auto-rejected: One or more documents rejected";
  }
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200, 
      { 
        document: supplier.documents[documentIndex],
        supplierStatus: supplier.status,
        autoUpdated: allDocumentsVerified || anyDocumentRejected
      },
      `Document ${isVerified ? 'verified' : 'rejected'} successfully${allDocumentsVerified ? ' and supplier auto-approved' : anyDocumentRejected ? ' and supplier auto-rejected' : ''}`
    )
  );
});

// Update supplier details by admin
export const updateSupplier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    "businessName",
    "ownerName",
    "email",
    "phone",
    "businessType",
    "gstNumber",
    "panNumber",
    "address",
    "bankDetails",
    "status"
  ];
  const updateData = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }
  const updatedSupplier = await Supplier.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");
  if (!updatedSupplier) {
    throw new ApiError(404, "Supplier not found");
  }
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Supplier updated successfully"
    )
  );
});

// Create a new supplier (admin)
export const createSupplier = asyncHandler(async (req, res) => {
  const { businessName, ownerName, email, phone, status, address,password} = req.body;

  // Generate a random password for the supplier
  // const password = Math.random().toString(36).slice(-8);

  // Check if email already exists
  const existing = await Supplier.findOne({ email });
  if (existing) {
    throw new ApiError(400, "Supplier with this email already exists");
  }

  const supplier = await Supplier.create({
    businessName,
    ownerName,
    email,
    phone,
    status: status || "pending",
    address,
    password,
  });

  return res.status(201).json(
    new ApiResponse(201, { supplier }, "Supplier created successfully")
  );
});

// Get dashboard stats
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get customer stats
  const totalCustomers = await Customer.countDocuments();
  const newCustomers = await Customer.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  });
  
  // Get supplier stats
  const totalSuppliers = await Supplier.countDocuments();
  const pendingSuppliers = await Supplier.countDocuments({ status: "pending" });
  const approvedSuppliers = await Supplier.countDocuments({ status: "approved" });
  
  // Get product stats
  const totalProducts = await Product.countDocuments();
  const activeProducts = await Product.countDocuments({ isActive: true });
  
  // Get order stats
  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ status: "pending" });
  const processingOrders = await Order.countDocuments({ status: "processing" });
  const deliveredOrders = await Order.countDocuments({ status: "delivered" });
  
  // Get category stats
  const totalCategories = await Category.countDocuments();
  
  // Get revenue stats
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0));
  const endOfToday = new Date(today.setHours(23, 59, 59, 999));
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Today's revenue
  const todayRevenue = await Order.aggregate([
    { 
      $match: { 
        status: { $in: ["delivered", "processing", "out_for_delivery"] },
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  // Monthly revenue
  const monthlyRevenue = await Order.aggregate([
    { 
      $match: { 
        status: { $in: ["delivered", "processing", "out_for_delivery"] },
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  // Total revenue
  const totalRevenue = await Order.aggregate([
    { 
      $match: { 
        status: { $in: ["delivered", "processing", "out_for_delivery"] }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  // Get recent orders
  const recentOrders = await Order.find()
    .populate("customer", "firstName lastName phone email")
    .populate("supplier", "businessName")
    .sort({ createdAt: -1 })
    .limit(5);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        customers: {
          total: totalCustomers,
          new: newCustomers
        },
        suppliers: {
          total: totalSuppliers,
          pending: pendingSuppliers,
          approved: approvedSuppliers
        },
        products: {
          total: totalProducts,
          active: activeProducts
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          processing: processingOrders,
          delivered: deliveredOrders
        },
        categories: {
          total: totalCategories
        },
        revenue: {
          today: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
          monthly: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0,
          total: totalRevenue.length > 0 ? totalRevenue[0].total : 0
        },
        recentOrders
      },
      "Dashboard stats fetched successfully"
    )
  );
});

// Get revenue analytics
export const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { period = "daily", startDate, endDate } = req.query;
  
  let groupBy;
  let dateFormat;
  let matchQuery = {};
  
  // Set default date range if not provided
  const today = new Date();
  const defaultEndDate = new Date();
  let defaultStartDate;
  
  if (period === "daily") {
    defaultStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    dateFormat = "YYYY-MM-DD";
  } else if (period === "weekly") {
    defaultStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 12 * 7);
    groupBy = { 
      $concat: [
        { $toString: { $year: "$createdAt" } },
        "-W",
        { $toString: { $week: "$createdAt" } }
      ]
    };
    dateFormat = "YYYY-Www";
  } else if (period === "monthly") {
    defaultStartDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    dateFormat = "YYYY-MM";
  } else {
    throw new ApiError(400, "Invalid period. Use daily, weekly, or monthly");
  }
  
  // Set date range
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    matchQuery.createdAt = {
      $gte: defaultStartDate,
      $lte: defaultEndDate
    };
  }
  
  // Only include completed or processing orders
  matchQuery.status = { $in: ["delivered", "processing", "out_for_delivery"] };
  
  // Get revenue data
  const revenueData = await Order.aggregate([
    { $match: matchQuery },
    { 
      $group: { 
        _id: groupBy,
        revenue: { $sum: "$totalAmount" },
        count: { $sum: 1 }
      } 
    },
    { $sort: { _id: 1 } }
  ]);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        analytics: {
          period,
          dateFormat,
          data: revenueData
        }
      },
      "Revenue analytics fetched successfully"
    )
  );
});

// Get product analytics
export const getProductAnalytics = asyncHandler(async (req, res) => {
  // Get top selling products
  const topSellingProducts = await Order.aggregate([
    { $match: { status: { $in: ["delivered", "processing", "out_for_delivery"] } } },
    { $unwind: "$items" },
    { 
      $group: { 
        _id: "$items.product",
        totalSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.totalPrice" }
      } 
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    
    {
      $project: {
        _id: 1,
        totalSold: 1,
        revenue: 1,
        product: { $arrayElemAt: ["$product", 0] }
      }
    },
    {
      $project: {
        _id: 1,
        totalSold: 1,
        revenue: 1,
        "product.name": 1,
        "product.images": 1,
        "product.price": 1,
        "product.discountedPrice": 1
      }
    }
  ]);
  
  // Get top categories
  const topCategories = await Order.aggregate([
    { $match: { status: { $in: ["delivered", "processing", "out_for_delivery"] } } },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    { 
      $group: { 
        _id: "$product.categoryId",
        totalSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.totalPrice" }
      } 
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category"
      }
    },
    {
      $project: {
        _id: 1,
        totalSold: 1,
        revenue: 1,
        category: { $arrayElemAt: ["$category", 0] }
      }
    },
    {
      $project: {
        _id: 1,
        totalSold: 1,
        revenue: 1,
        "category.name": 1,
        "category.image": 1
      }
    }
  ]);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        topSellingProducts,
        topCategories
      },
      "Product analytics fetched successfully"
    )
  );
});

// Get customer analytics
export const getCustomerAnalytics = asyncHandler(async (req, res) => {
  // Get top customers by order count
  const topCustomersByOrders = await Order.aggregate([
    { $match: { status: { $in: ["delivered", "processing", "out_for_delivery"] } } },
    { 
      $group: { 
        _id: "$customer",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" }
      } 
    },
    { $sort: { orderCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customer"
      }
    },
    {
      $project: {
        _id: 1,
        orderCount: 1,
        totalSpent: 1,
        customer: { $arrayElemAt: ["$customer", 0] }
      }
    },
    {
      $project: {
        _id: 1,
        orderCount: 1,
        totalSpent: 1,
        "customer.firstName": 1,
        "customer.lastName": 1,
        "customer.email": 1,
        "customer.profileImage": 1
      }
    }
  ]);
  
  // Get top customers by spending
  const topCustomersBySpending = await Order.aggregate([
    { $match: { status: { $in: ["delivered", "processing", "out_for_delivery"] } } },
    { 
      $group: { 
        _id: "$customer",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" }
      } 
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customer"
      }
    },
    {
      $project: {
        _id: 1,
        orderCount: 1,
        totalSpent: 1,
        customer: { $arrayElemAt: ["$customer", 0] }
      }
    },
    {
      $project: {
        _id: 1,
        orderCount: 1,
        totalSpent: 1,
        "customer.firstName": 1,
        "customer.lastName": 1,
        "customer.email": 1,
        "customer.profileImage": 1
      }
    }
  ]);
  
  // Get new customer registrations over time
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  
  const newCustomers = await Customer.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        topCustomersByOrders,
        topCustomersBySpending,
        newCustomers
      },
      "Customer analytics fetched successfully"
    )
  );
});

// Get all delivery associates
export const getAllDeliveryAssociates = asyncHandler(async (req, res) => {
  const { 
    search, 
    status,
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = {};
  
  // Search by name, email, or phone
  if (search) {
    queryOptions.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } }
    ];
  }
  
  // Filter by status
  if (status) {
    queryOptions.status = status;
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get delivery associates with pagination
  const deliveryAssociates = await DeliveryAssociate.find(queryOptions)
    .select("-password -passwordResetToken -passwordResetExpires")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalDeliveryAssociates = await DeliveryAssociate.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        deliveryAssociates,
        pagination: {
          total: totalDeliveryAssociates,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalDeliveryAssociates / parseInt(limit))
        }
      },
      "Delivery associates fetched successfully"
    )
  );
});

// Create a new delivery associate (Admin)
export const createDeliveryAssociate = asyncHandler(async (req, res) => {
  const { name, email, phone, password, status = 'Active', vehicleType = 'Motorcycle', address, specialization } = req.body;
  if (!name || !email || !phone || !password) {
    throw new ApiError(400, 'Name, email, phone, and password are required');
  }
  // Check for duplicate email/phone
  const existing = await DeliveryAssociate.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    throw new ApiError(409, 'A delivery associate with this email or phone already exists');
  }
  const deliveryAssociate = await DeliveryAssociate.create({
    name,
    email,
    phone,
    password, // <-- Add this line
    status,
    isActive: status === 'Active',
    vehicle: { type: vehicleType },
    address,
    specialization,
    isVerified: false,
    activeAssignments: 0,
    ordersCompleted: 0,
    rating: 0,
    joinedDate: new Date(),
    lastActive: new Date(),
  });
  return res.status(201).json(new ApiResponse(201, { deliveryAssociate }, 'Delivery associate created successfully'));
});

// Update a delivery associate (Admin)
export const updateDeliveryAssociate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, status, vehicleType, address, specialization } = req.body;
  const updateFields = {};
  if (name) updateFields.name = name;
  if (email) updateFields.email = email;
  if (phone) updateFields.phone = phone;
  if (status) {
    updateFields.status = status;
    updateFields.isActive = status === 'Active';
  }
  if (vehicleType) updateFields['vehicle.type'] = vehicleType;
  if (address) updateFields.address = address;
  if (specialization) updateFields.specialization = specialization;
  const updated = await DeliveryAssociate.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
  if (!updated) throw new ApiError(404, 'Delivery associate not found');
  return res.status(200).json(new ApiResponse(200, { deliveryAssociate: updated }, 'Delivery associate updated successfully'));
});

// Delete a delivery associate (Admin)
export const deleteDeliveryAssociate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await DeliveryAssociate.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, 'Delivery associate not found');
  return res.status(200).json(new ApiResponse(200, {}, 'Delivery associate deleted successfully'));
});

// Review Management Functions

// Get all reviews with filtering and pagination
export const getAllReviews = asyncHandler(async (req, res) => {
  console.log("🔍 getAllReviews called with query:", req.query);
  
  const { 
    status, 
    rating, 
    search, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;

  // Build query
  const query = {};
  
  if (status && status !== 'all') {
    query.status = status;
  }
  
  if (rating && rating !== 'all') {
    query.rating = parseInt(rating);
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { comment: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;

  // Get reviews with populated data
  const reviews = await Review.find(query)
    .populate("customer", "firstName lastName email profileImage")
    .populate("product", "name images")
    .populate("order", "orderNumber")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalReviews = await Review.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        reviews,
        pagination: {
          total: totalReviews,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalReviews / parseInt(limit))
        }
      },
      "Reviews fetched successfully"
    )
  );
});

// Get review by ID
export const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const review = await Review.findById(id)
    .populate("customer", "firstName lastName email profileImage")
    .populate("product", "name images description")
    .populate("order", "orderNumber status")
    .populate("reply.createdBy", "firstName lastName");

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      "Review fetched successfully"
    )
  );
});

// Update review status (approve/reject)
export const updateReviewStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    throw new ApiError(400, "Valid status is required (approved, rejected, pending)");
  }

  const review = await Review.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).populate("customer", "firstName lastName email");

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      `Review ${status} successfully`
    )
  );
});

// Toggle review visibility
export const toggleReviewVisibility = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isVisible } = req.body;

  if (typeof isVisible !== 'boolean') {
    throw new ApiError(400, "isVisible must be a boolean");
  }

  const review = await Review.findByIdAndUpdate(
    id,
    { isVisible },
    { new: true }
  ).populate("customer", "firstName lastName email");

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      `Review ${isVisible ? 'made visible' : 'hidden'} successfully`
    )
  );
});

// Delete review
export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  // Delete images from cloudinary if they exist
  if (review.images && review.images.length > 0) {
    const deletePromises = review.images.map(image => 
      deleteFromCloudinary(image.publicId)
    );
    await Promise.all(deletePromises);
  }

  await Review.findByIdAndDelete(id);

  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Review deleted successfully"
    )
  );
});

// Reply to review
export const replyToReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === '') {
    throw new ApiError(400, "Reply content is required");
  }

  const review = await Review.findById(id).populate("product");
  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  // Add reply
  review.reply = {
    content: content.trim(),
    createdAt: new Date(),
    createdBy: req.user._id,
    createdByModel: "Admin"
  };

  await review.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      "Reply added successfully"
    )
  );
});

// Get review statistics
export const getReviewStats = asyncHandler(async (req, res) => {
  console.log("📊 getReviewStats called");
  
  // Get total reviews
  const totalReviews = await Review.countDocuments();
  
  // Get reviews by status
  const pendingReviews = await Review.countDocuments({ status: 'pending' });
  const approvedReviews = await Review.countDocuments({ status: 'approved' });
  const rejectedReviews = await Review.countDocuments({ status: 'rejected' });
  
  // Get average rating
  const avgRatingResult = await Review.aggregate([
    { $group: { _id: null, avgRating: { $avg: "$rating" } } }
  ]);
  const avgRating = avgRatingResult.length > 0 ? parseFloat(avgRatingResult[0].avgRating.toFixed(1)) : 0;
  
  // Get rating distribution
  const ratingDistribution = await Review.aggregate([
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
  
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingDistribution.forEach(item => {
    distribution[item._id] = item.count;
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalReviews,
        pendingReviews,
        approvedReviews,
        rejectedReviews,
        avgRating,
        distribution
      },
      "Review statistics fetched successfully"
    )
  );
});

export default {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  uploadAdminAvatar,
  getAllCustomers,
  getCustomerById,
  getAllSuppliers,
  getSupplierById,
  updateSupplierStatus,
  verifySupplierDocument,
  updateSupplier,
  createSupplier,
  getAllDeliveryAssociates,
  createDeliveryAssociate,
  updateDeliveryAssociate,
  deleteDeliveryAssociate,
  getDashboardStats,
  getRevenueAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  getAllReviews,
  getReviewById,
  updateReviewStatus,
  toggleReviewVisibility,
  deleteReview,
  replyToReview,
  getReviewStats
};
