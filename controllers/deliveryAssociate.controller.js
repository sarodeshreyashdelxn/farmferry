//DeliveryAssociate.controller

import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import Order from "../models/order.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import sendSMS from "../utils/sms.js";
import fetch from "node-fetch";
// controllers/deliveryController.js
import DeliveryVerificationService from '../utils/deliveryVerificationService.js'
import Customer from '../models/customer.model.js';

/**
 * Verify OTP and mark order as delivered with notifications
 */


// Get delivery associate profile
export const getDeliveryAssociateProfile = asyncHandler(async (req, res) => {
  const deliveryAssociate = await DeliveryAssociate.findById(req.user._id)
    .select("-password -passwordResetToken -passwordResetExpires");

  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { deliveryAssociate },
      "Delivery associate profile fetched successfully"
    )
  );
});

// Update delivery associate profile
export const updateDeliveryAssociateProfile = asyncHandler(async (req, res) => {
  const {
    name,
    phone,
    email,
    address
  } = req.body;

  const updateFields = {};

  if (name) updateFields.name = name;
  if (phone) updateFields.phone = phone;
  if (email) updateFields.email = email;
  if (address) updateFields.address = address;

  // Handle profile image upload
  if (req.file) {
    const profileImage = await uploadToCloudinary(req.file.path, "delivery-associates");

    if (profileImage) {
      // Delete old image if exists
      if (req.user.profileImage?.publicId) {
        await deleteFromCloudinary(req.user.profileImage.publicId);
      }

      updateFields.profileImage = {
        url: profileImage.secure_url,
        publicId: profileImage.public_id
      };
    }
  }

  const updatedDeliveryAssociate = await DeliveryAssociate.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");

  if (!updatedDeliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { deliveryAssociate: updatedDeliveryAssociate },
      "Profile updated successfully"
    )
  );
});

// Update vehicle details
export const updateVehicleDetails = asyncHandler(async (req, res) => {
  const {
    vehicleType,
    vehicleNumber,
    vehicleModel,
    vehicleColor
  } = req.body;

  const updateFields = {
    "vehicle.type": vehicleType,
    "vehicle.number": vehicleNumber,
    "vehicle.model": vehicleModel,
    "vehicle.color": vehicleColor
  };

  const updatedDeliveryAssociate = await DeliveryAssociate.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");

  if (!updatedDeliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { vehicle: updatedDeliveryAssociate.vehicle },
      "Vehicle details updated successfully"
    )
  );
});

// Upload document
export const uploadDocument = asyncHandler(async (req, res) => {
  const { documentType } = req.body;

  if (!documentType) {
    throw new ApiError(400, "Document type is required");
  }

  if (!req.file) {
    throw new ApiError(400, "Document file is required");
  }

  // Upload document to cloudinary
  const document = await uploadToCloudinary(req.file.path, "delivery-associate-documents");

  if (!document) {
    throw new ApiError(500, "Document upload failed");
  }

  const deliveryAssociate = await DeliveryAssociate.findById(req.user._id);

  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  // Check if document type already exists
  const existingDocIndex = deliveryAssociate.documents.findIndex(
    doc => doc.type === documentType
  );

  if (existingDocIndex !== -1) {
    // Delete old document from cloudinary
    if (deliveryAssociate.documents[existingDocIndex].publicId) {
      await deleteFromCloudinary(deliveryAssociate.documents[existingDocIndex].publicId);
    }

    // Update existing document
    deliveryAssociate.documents[existingDocIndex] = {
      type: documentType,
      url: document.secure_url,
      publicId: document.public_id,
      isVerified: false,
      uploadedAt: new Date()
    };
  } else {
    // Add new document
    deliveryAssociate.documents.push({
      type: documentType,
      url: document.secure_url,
      publicId: document.public_id,
      isVerified: false,
      uploadedAt: new Date()
    });
  }

  await deliveryAssociate.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { documents: deliveryAssociate.documents },
      "Document uploaded successfully"
    )
  );
});

// Update online status
export const updateOnlineStatus = asyncHandler(async (req, res) => {
  const { isOnline, location } = req.body;

  if (isOnline === undefined) {
    throw new ApiError(400, "Online status is required");
  }

  const updateFields = {
    isOnline: isOnline
  };

  // Update location if provided
  if (location && location.coordinates) {
    updateFields.location = {
      type: "Point",
      coordinates: [
        parseFloat(location.coordinates[0]),
        parseFloat(location.coordinates[1])
      ]
    };
  }

  const updatedDeliveryAssociate = await DeliveryAssociate.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");

  if (!updatedDeliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isOnline: updatedDeliveryAssociate.isOnline,
        location: updatedDeliveryAssociate.location
      },
      "Status updated successfully"
    )
  );
});

// Get assigned orders
export const getAssignedOrders = asyncHandler(async (req, res) => {
  const { status, sort = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;

  const queryOptions = {
    "deliveryAssociate.associate": req.user._id
  };

  // Filter by delivery status
  if (status) {
    queryOptions["deliveryAssociate.status"] = status;
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;

  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate({
      path: "customer",
      select: "firstName lastName email phone",
      populate: { path: "addresses", select: "name type" }
    })
    .populate("supplier", "businessName phone address")
    .populate("items.product", "name images")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);

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
      "Orders fetched successfully"
    )
  );
});

// Get order details
export const getOrderDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findOne({
    _id: id,
    "deliveryAssociate.associate": req.user._id
  })
    .populate("customer", "firstName lastName phone address")
    .populate("supplier", "businessName phone address")
    .populate("items.product", "name images");

  if (!order) {
    throw new ApiError(404, "Order not found or not assigned to you");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order details fetched successfully"
    )
  );
});

// Update delivery status
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, location, notes } = req.body;

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  // Validate status
  if (!["packaging", "out_for_delivery", "delivered", "failed"].includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const order = await Order.findOne({
    _id: id,
    "deliveryAssociate.associate": req.user._id
  });

  if (!order) {
    throw new ApiError(404, "Order not found or not assigned to you");
  }

  // Validate status transition
  const validTransitions = {
    assigned: ["picked_up"],
    packaging: ["out_for_delivery"],
    out_for_delivery: ["delivered", "failed"],
    delivered: [],
    failed: []
  };

  if (!validTransitions[order.deliveryAssociate.status] ||
    !validTransitions[order.deliveryAssociate.status].includes(status)) {
    throw new ApiError(400, `Cannot transition from ${order.deliveryAssociate.status} to ${status}`);
  }

  // Capture previous delivery status before updating
  const previousDeliveryStatus = order.deliveryAssociate.status;

  // Update delivery status
  order.deliveryAssociate.status = status;

   const customer = await Customer.findById(order.customer);

  if (status === "packaging" && customer && customer.phone) {
  const body = `Hi ${customer.addresses?.[0]?.name || 'Customer'}, your order is being packed 🚚.`;
  await sendSMS.sendSmsThroughWhatsapp(customer.phone, body);
}


  if (status === "out_for_delivery" && customer && customer.phone) {
  const body = `Hi ${customer.addresses?.[0]?.name || 'Customer'}, your order is out for delivery 🚚.`;
  await sendSMS.sendSmsThroughWhatsapp(customer.phone, body);
}

  // Update main order status ONLY when transitioning from packaging -> out_for_delivery
  if (previousDeliveryStatus === "packaging" && status === "out_for_delivery") {
    order.status = "out_for_delivery";
    order.statusHistory.push({
      status: "out_for_delivery",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "DeliveryAssociate",
      note: "Delivery started by delivery associate"
    });
  }

  // Add location if provided
  if (location && location.coordinates) {
    order.deliveryAssociate.currentLocation = {
      type: "Point",
      coordinates: [
        parseFloat(location.coordinates[0]),
        parseFloat(location.coordinates[1])
      ]
    };
  }

  // Update delivery associate location in their profile
  if (location && location.coordinates) {
    await DeliveryAssociate.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [
              parseFloat(location.coordinates[0]),
              parseFloat(location.coordinates[1])
            ]
          }
        }
      }
    );
  }

  // Update order status if delivery status is delivered
  if (status === "delivered") {
    order.status = "delivered";
    order.deliveredAt = new Date();

    // Add status history entry
    order.statusHistory.push({
      status: "delivered",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "DeliveryAssociate",
      note: notes || "Delivered by delivery associate"
    });

    // Update delivery associate metrics
    await DeliveryAssociate.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          "completedDeliveries": 1,
          "totalEarnings": order.deliveryCharge || 0
        }
      }
    );
  }

  // Update order status if delivery status is failed
  if (status === "failed") {
    // Add status history entry
    order.statusHistory.push({
      status: "delivery_failed",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "DeliveryAssociate",
      note: notes || "Delivery failed"
    });

    // Update delivery associate metrics
    await DeliveryAssociate.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          "failedDeliveries": 1
        }
      }
    );
  }

  await order.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Delivery status updated successfully"
    )
  );
});

// Get earnings
export const getEarnings = asyncHandler(async (req, res) => {
  const { period = "weekly" } = req.query;

  const deliveryAssociate = await DeliveryAssociate.findById(req.user._id);

  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  // Get current date
  const today = new Date();
  let startDate;

  // Set start date based on period
  if (period === "daily") {
    startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else if (period === "weekly") {
    const day = today.getDay();
    startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day);
  } else if (period === "monthly") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "all") {
    startDate = new Date(0); // Beginning of time
  } else {
    throw new ApiError(400, "Invalid period. Use daily, weekly, monthly, or all");
  }

  // Get completed orders in the period
  const completedOrders = await Order.find({
    "deliveryAssociate.associate": req.user._id,
    "deliveryAssociate.status": "delivered",
    deliveredAt: { $gte: startDate }
  }).select("deliveryCharge deliveredAt");

  // Calculate earnings
  const earnings = completedOrders.reduce((total, order) => total + (order.deliveryCharge || 0), 0);

  // Get earnings by day for the period
  const earningsByDay = {};

  completedOrders.forEach(order => {
    const date = order.deliveredAt.toISOString().split('T')[0];
    if (!earningsByDay[date]) {
      earningsByDay[date] = 0;
    }
    earningsByDay[date] += order.deliveryCharge || 0;
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        period,
        totalEarnings: earnings,
        completedOrders: completedOrders.length,
        earningsByDay: Object.entries(earningsByDay).map(([date, amount]) => ({
          date,
          amount
        })),
        allTimeMetrics: {
          deliveriesCompleted: deliveryAssociate.completedDeliveries,
          deliveriesFailed: deliveryAssociate.failedDeliveries,
          totalEarnings: deliveryAssociate.totalEarnings
        }
      },
      "Earnings fetched successfully"
    )
  );
});

// Get nearby orders (for admin/supplier to assign)
export const getNearbyDeliveryAssociates = asyncHandler(async (req, res) => {
  const { longitude, latitude, maxDistance = 10000 } = req.query; // maxDistance in meters

  if (!longitude || !latitude) {
    throw new ApiError(400, "Longitude and latitude are required");
  }

  // Find online delivery associates near the location
  const nearbyAssociates = await DeliveryAssociate.find({
    isOnline: true,
    isVerified: true,
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: parseInt(maxDistance)
      }
    }
  })
    .select("name phone profileImage location vehicle metrics isOnline")
    .limit(10);

  return res.status(200).json(
    new ApiResponse(
      200,
      { deliveryAssociates: nearbyAssociates },
      "Nearby delivery associates fetched successfully"
    )
  );
});

// Request payout
export const requestPayout = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid payout amount');
  }
  const deliveryAssociate = await DeliveryAssociate.findById(req.user._id);
  if (!deliveryAssociate) {
    throw new ApiError(404, 'Delivery associate not found');
  }
  if (deliveryAssociate.totalEarnings < amount) {
    throw new ApiError(400, 'Insufficient earnings for payout');
  }
  // Deduct amount from total earnings
  deliveryAssociate.totalEarnings -= amount;
  // Add payout request
  const payoutRequest = {
    amount,
    status: 'pending',
    requestedAt: new Date(),
  };
  deliveryAssociate.payoutRequests.push(payoutRequest);
  await deliveryAssociate.save();
  return res.status(201).json(
    new ApiResponse(201, { payoutRequest }, 'Payout request submitted successfully')
  );
});

// Feedback and proof upload stubs
export const submitOrderFeedback = asyncHandler(async (req, res) => {
  // TODO: Save feedback to order or separate collection
  return res.status(200).json(new ApiResponse(200, {}, 'Feedback submitted.'));
});

export const uploadOrderProof = asyncHandler(async (req, res) => {
  // TODO: Save proof image to order or separate collection
  return res.status(200).json(new ApiResponse(200, {}, 'Proof uploaded.'));
});

export const getAllDeliveryAssociates = asyncHandler(async (req, res) => {
  const associates = await DeliveryAssociate.find().select('-password -passwordResetToken -passwordResetExpires');
  return res.status(200).json(
    new ApiResponse(200, associates, 'All delivery associates fetched successfully')
  );
});

export const approveDeliveryAssociate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const associate = await DeliveryAssociate.findById(id);
  if (!associate) throw new ApiError(404, "Delivery associate not found");
  associate.isVerified = !associate.isVerified;
  await associate.save();
  return res.status(200).json(new ApiResponse(200, associate, "Approval status updated"));
});


export const getNearbyOrders = asyncHandler(async (req, res) => {
  const { longitude, latitude, maxDistance = 10000 } = req.query; // meters

  if (!longitude || !latitude) {
    throw new ApiError(400, "Longitude and latitude are required");
  }

  // 1️⃣ Get active orders that still need delivery
  const orders = await Order.find({
    status: { $in: ["pending", "processing", "out_for_delivery"] }
  }).select("deliveryAddress");

  const nearbyOrders = [];

  for (const order of orders) {
    const address = `${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state}, ${order.deliveryAddress.postalCode}, ${order.deliveryAddress.country}`;

    // 2️⃣ Geocode order address to get lat/lng
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const geoData = await geoRes.json();

    if (geoData.status !== "OK" || !geoData.results[0]) continue;

    const { lat, lng } = geoData.results[0].geometry.location;

    // 3️⃣ Use Distance Matrix API to calculate driving distance
    const distRes = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const distData = await distRes.json();

    if (distData.status !== "OK") continue;

    const distanceMeters = distData.rows[0].elements[0].distance.value;

    // 4️⃣ Filter orders within maxDistance
    if (distanceMeters <= parseInt(maxDistance)) {
      nearbyOrders.push({
        order,
        distanceMeters
      });
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { orders: nearbyOrders },
      "Nearby orders fetched successfully"
    )
  );
});