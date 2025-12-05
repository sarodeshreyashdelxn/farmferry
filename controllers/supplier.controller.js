import Supplier from "../models/supplier.model.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ExcelJS from 'exceljs';
import { mapExcelToProduct, validateProductData } from "../utils/uploadValidation.js";
import mongoose from "mongoose";
import Order from '../models/order.model.js';import bcrypt from "bcryptjs"; // Added for password hashing

// Register supplier
export const registerSupplier = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber, businessName, password } = req.body;

  // Validate required fields
  if (!fullName || !email || !phoneNumber || !businessName || !password) {
    throw new ApiError(400, "Full name, email, phone number, business name, and password are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  // Check for existing email
  const existingSupplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (existingSupplier) {
    throw new ApiError(409, "Email is already registered");
  }

  // Check for existing phone
  const existingPhone = await Supplier.findOne({ phone: phoneNumber });
  if (existingPhone) {
    throw new ApiError(409, "Phone number is already registered");
  }

  // Hash password (remove if model has pre-save hook)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create new supplier
  const supplier = await Supplier.create({
    ownerName: fullName, // Map fullName to ownerName
    email: email.toLowerCase(),
    phone: phoneNumber,
    businessName,
    password: hashedPassword,
    role: "supplier",
    status: "pending",
    lastLogin: new Date(),
  });

  // Remove sensitive fields
  const createdSupplier = await Supplier.findById(supplier._id).select(
    "-password -passwordResetToken -passwordResetExpires"
  );

  if (!createdSupplier) {
    throw new ApiError(500, "Something went wrong while registering the supplier");
  }

  // Generate tokens for auto-login
  const accessToken = supplier.generateAccessToken();
  const refreshToken = supplier.generateRefreshToken();

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: createdSupplier,
        accessToken,
        refreshToken,
      },
      "Supplier registered and logged in successfully"
    )
  );
});

// Get supplier profile
export const getSupplierProfile = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }

  // Count total orders for this supplier (ensure ObjectId type)
  const totalOrders = await Order.countDocuments({ supplier: new mongoose.Types.ObjectId(req.user._id) });

  // Convert supplier to object and add totalOrders
  const supplierObj = supplier.toObject();
  supplierObj.totalOrders = totalOrders;
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: supplierObj },
      "Supplier profile fetched successfully"
    )
  );
});

// Update supplier profile
export const updateSupplierProfile = asyncHandler(async (req, res) => {
  console.log('updateSupplierProfile req.body:', req.body); // Debug log
  const { 
    businessName, 
    ownerName, 
    phone, 
    businessType,
    description,
    gstNumber,
    panNumber
  } = req.body;
  
  const updateFields = {};
  
  if (businessName) updateFields.businessName = businessName;
  if (ownerName) updateFields.ownerName = ownerName;
  if (phone) updateFields.phone = phone;
  if (businessType) updateFields.businessType = businessType;
  if (description) updateFields.description = description;
  if (gstNumber) updateFields.gstNumber = gstNumber;
  if (panNumber) updateFields.panNumber = panNumber;
  
  // Handle logo upload if file is provided
  if (req.files?.logo) {
    const supplier = await Supplier.findById(req.user._id);
    
    // Delete old logo if exists
    if (supplier.logo?.publicId) {
      await deleteFromCloudinary(supplier.logo.publicId);
    }
    
    // Upload new logo
    const uploadResult = await uploadToCloudinary(req.files.logo[0].path, "suppliers/logos");
    
    if (!uploadResult) {
      throw new ApiError(500, "Error uploading logo");
    }
    
    updateFields.logo = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };
  }
  
  const updatedSupplier = await Supplier.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!updatedSupplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Supplier profile updated successfully"
    )
  );
});

// Update logo
export const updateLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Logo image is required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Delete old logo if exists
  if (supplier.logo?.publicId) {
    await deleteFromCloudinary(supplier.logo.publicId);
  }
  
  // Upload new logo
  const uploadResult = await uploadToCloudinary(req.file.path, "suppliers/logos");
  
  if (!uploadResult) {
    throw new ApiError(500, "Error uploading logo");
  }
  
  // Update supplier logo
  supplier.logo = {
    url: uploadResult.url,
    publicId: uploadResult.public_id
  };
  
  await supplier.save();
  
  const updatedSupplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Logo updated successfully"
    )
  );
});

// Update address
export const updateAddress = asyncHandler(async (req, res) => {
  console.log('updateAddress req.body:', req.body); // Debug log
  const { 
    street, 
    city, 
    state, 
    postalCode, 
    country, 
    landmark,
    coordinates 
  } = req.body;
  
  if (!street || !city || !state || !postalCode || !country) {
    throw new ApiError(400, "All address fields are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update address
  supplier.address = {
    street,
    city,
    state,
    postalCode,
    country,
    landmark: landmark || "",
    coordinates: coordinates || {}
  };
  
  await supplier.save();
  
  const updatedSupplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Address updated successfully"
    )
  );
});

// Update bank details
export const updateBankDetails = asyncHandler(async (req, res) => {
  console.log('updateBankDetails req.body:', req.body); // Debug log
  const { accountName, accountNumber, bankName, ifscCode, branchName } = req.body;
  
  // Validate required fields
  if (!accountName || !accountNumber || !bankName || !ifscCode) {
    throw new ApiError(400, "Account name, number, bank name, and IFSC code are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update bank details
  supplier.bankDetails = {
    accountHolderName: accountName,
    accountNumber,
    bankName,
    ifscCode,
    branchName: branchName || ""
  };
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { bankDetails: supplier.bankDetails },
      "Bank details updated successfully"
    )
  );
});

// Upload verification document
export const uploadVerificationDocument = asyncHandler(async (req, res) => {
  console.log('📤 Upload verification document called');
  console.log('📤 Request body:', req.body);
  console.log('📤 Request file:', req.file);
  console.log('📤 Request files:', req.files);
  
  const { documentType } = req.body;
  
  if (!documentType || !req.file) {
    console.log('❌ Missing documentType or file');
    console.log('❌ documentType:', documentType);
    console.log('❌ req.file:', req.file);
    throw new ApiError(400, "Document type and file are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Upload document
  console.log('📤 Uploading to Cloudinary, file path:', req.file.path);
  const uploadResult = await uploadToCloudinary(req.file.path, "suppliers/documents");
  console.log('📤 Cloudinary upload result:', uploadResult);
  
  if (!uploadResult) {
    console.log('❌ Cloudinary upload failed');
    throw new ApiError(500, "Error uploading document");
  }
  
  // Check if document of this type already exists
  const existingDocIndex = supplier.documents.findIndex(doc => doc.type === documentType);
  
  if (existingDocIndex !== -1) {
    // Delete old document from cloudinary
    await deleteFromCloudinary(supplier.documents[existingDocIndex].publicId);
    
    // Update existing document
    supplier.documents[existingDocIndex] = {
      type: documentType,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadedAt: new Date(),
      isVerified: false
    };
  } else {
    // Add new document
    supplier.documents.push({
      type: documentType,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadedAt: new Date(),
      isVerified: false
    });
  }
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { documents: supplier.documents },
      "Document uploaded successfully"
    )
  );
});

// Get supplier products
export const getSupplierProducts = asyncHandler(async (req, res) => {
  const { 
    search, 
    category, 
    isActive, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = { supplierId: req.user._id };
  
  // Search by name
  if (search) {
    queryOptions.name = { $regex: search, $options: "i" };
  }
  
  // Filter by category
  if (category) {
    queryOptions.categoryId = category;
  }
  
  // Filter by active status
  if (isActive !== undefined) {
    queryOptions.isActive = isActive === "true";
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get products with pagination
  const products = await Product.find(queryOptions)
    .populate("categoryId", "name")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalProducts = await Product.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products,
        pagination: {
          total: totalProducts,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalProducts / parseInt(limit))
        }
      },
      "Supplier products fetched successfully"
    )
  );
});

// Get supplier orders
export const getSupplierOrders = asyncHandler(async (req, res) => {
  console.log('🔄 getSupplierOrders called');
  console.log('👤 Supplier ID:', req.user._id);
  console.log('📝 Query params:', req.query);
  
  const { 
    status, 
    customerId, 
    startDate, 
    endDate, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10,
    debugAll = false
  } = req.query;
  
  let queryOptions;
  if (debugAll === 'true') {
    // Debug mode: return all orders
    queryOptions = {};
    console.log('⚠️ DEBUG MODE: Returning all orders (no supplier filter)');
  } else {
    queryOptions = { supplier: req.user._id };
  }
  
  // Filter by status
  if (status) {
    queryOptions.status = status;
  }
  
  // Filter by customer
  if (customerId) {
    queryOptions.customer = customerId;
  }
  
  // Filter by date range
  if (startDate && endDate) {
    queryOptions.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else if (startDate) {
    queryOptions.createdAt = { $gte: new Date(startDate) };
  } else if (endDate) {
    queryOptions.createdAt = { $lte: new Date(endDate) };
  }
  
  console.log('🔍 Query options:', queryOptions);
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  console.log('📊 Sort options:', sortOptions);
  console.log('📄 Pagination - skip:', skip, 'limit:', parseInt(limit));
  
  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("customer", "firstName lastName email")
    .populate("items.product", "name images")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  console.log('📦 Found orders:', orders.length);
  console.log('📦 Orders:', orders);
  
  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);
  
  console.log('📊 Total orders count:', totalOrders);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Supplier orders fetched successfully"
    )
  );
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Ensure the supplier owns this order
  if (order.supplier.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to update this order");
  }

  // Update the main order status
  order.status = status;

  // Add a note to the status history
  const historyEntry = {
    status: status,
    updatedAt: new Date(),
    updatedBy: req.user._id,
    updatedByModel: "Supplier",
  };

  if (note) {
    historyEntry.note = note;
  }

  // Avoid duplicating the last status history entry
  const lastStatus = order.statusHistory.length > 0 ? order.statusHistory[order.statusHistory.length - 1] : null;
  if (!lastStatus || lastStatus.status !== status) {
    order.statusHistory.push(historyEntry);
  }

  await order.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order status updated successfully"
    )
  );
});

// Get supplier dashboard stats
export const getSupplierDashboardStats = asyncHandler(async (req, res) => {
  const supplierId = req.user._id;
  
  // Get total products
  const totalProducts = await Product.countDocuments({ supplierId });
  
  // Get active products
  const activeProducts = await Product.countDocuments({ 
    supplierId, 
    isActive: true 
  });
  
  // Get total orders
  const totalOrders = await Order.countDocuments({ supplier: supplierId });
  
  // Get orders by status
  const pendingOrders = await Order.countDocuments({ 
    supplier: supplierId, 
    status: "pending" 
  });
  
  const processingOrders = await Order.countDocuments({ 
    supplier: supplierId, 
    status: "processing" 
  });
  
  const deliveredOrders = await Order.countDocuments({ 
    supplier: supplierId, 
    status: "delivered" 
  });
  
  // Get recent orders
  const recentOrders = await Order.find({ supplier: supplierId })
    .populate("customer", "firstName lastName phone email addresses")
    .populate("items.product", "name")
    .sort({ createdAt: -1 })
    .limit(5);
  
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
        supplier: supplierId,
        status: "delivered",
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
        supplier: supplierId,
        status: "delivered",
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
        supplier: supplierId,
        status: "delivered"
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
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
        revenue: {
          today: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
          monthly: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0,
          total: totalRevenue.length > 0 ? totalRevenue[0].total : 0
        },
        recentOrders
      },
      "Supplier dashboard stats fetched successfully"
    )
  );
});

// Update supplier address
export const updateSupplierAddress = asyncHandler(async (req, res) => {
  const { street, city, state, postalCode, country } = req.body;
  
  // Validate required fields
  if (!street || !city || !state || !postalCode || !country) {
    throw new ApiError(400, "All address fields are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update address
  supplier.address = {
    street,
    city,
    state,
    postalCode,
    country
  };
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { address: supplier.address },
      "Supplier address updated successfully"
    )
  );
});

// Get a single supplier order by ID
export const getSupplierOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findOne({ _id: id, supplier: req.user._id })
    .populate("customer", "firstName lastName email")
    .populate("items.product", "name images");
  if (!order) throw new ApiError(404, "Order not found");
  return res.status(200).json(new ApiResponse(200, { order }, "Order fetched successfully"));
});

// GET /suppliers/verification-status
export const getVerificationStatus = asyncHandler(async (req, res) => {
  // Fetch supplier from DB
  const supplier = await Supplier.findById(req.user._id);

  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }

  // Example: required document types
  const requiredDocs = ['Aadhar Card', 'PAN Card', 'Bank Statement'];

  // Build documents array dynamically
  const documents = requiredDocs.map(type => {
    const doc = supplier.documents?.find(d => d.type === type);
    return {
      type,
      status: doc
        ? doc.isVerified
          ? 'approved'
          : doc.rejectionReason
            ? 'rejected'
            : 'pending'
        : 'not_uploaded',
      url: doc?.url || null,
      rejectionReason: doc?.rejectionReason || null
    };
  });

  // Determine overall verification status based on supplier status first
  let verificationStatus = 'pending';
  
  // Check supplier's overall status first (this is the primary verification status)
  if (supplier.status === 'approved') {
    verificationStatus = 'verified';
  } else if (supplier.status === 'rejected') {
    verificationStatus = 'rejected';
  } else {
    // If supplier status is pending, check document status as fallback
    if (documents.every(doc => doc.status === 'approved')) {
      verificationStatus = 'verified';
    } else if (documents.some(doc => doc.status === 'rejected')) {
      verificationStatus = 'rejected';
    }
  }

  // Build steps dynamically
  const steps = [
    { label: 'Upload documents', completed: documents.every(doc => doc.status !== 'not_uploaded') },
    { label: 'Under review', completed: documents.every(doc => doc.status === 'approved' || doc.rejectionReason) },
    { label: 'Verification complete', completed: verificationStatus === 'verified' }
  ];

  return res.status(200).json(
    new ApiResponse(200, {
      verificationStatus,
      documents,
      steps,
      supplierStatus: supplier.status,
      verifiedAt: supplier.verifiedAt,
      verificationNotes: supplier.verificationNotes
    }, 'Supplier verification status fetched successfully')
  );
});