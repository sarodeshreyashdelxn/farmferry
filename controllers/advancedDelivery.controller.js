import Order from "../models/order.model.js";
import OrderReplacement from "../models/orderReplacement.model.js";
import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import Customer from "../models/customer.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import TomTomService from "../config/googleMaps.js";
import QRCodeService from "../utils/qrCodeService.js";
import DeliveryVerificationService from "../utils/deliveryVerificationService.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { customAlphabet } from 'nanoid';
// controllers/deliveryController.js

/**
 * Advanced Delivery Controller
 * Handles Google Maps optimization, QR codes, OTP verification, and order replacement
 */
export const verifyDeliveryOTPWithNotifications = asyncHandler(async (req, res) => {
  const { orderId, otp } = req.body;
  
  if (!orderId || !otp) {
    throw new ApiError(400, "Order ID and OTP are required");
  }

  // Get order details
  const order = await Order.findById(orderId).populate('customer');
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Get customer phone for OTP verification
  const customerPhone = order.customer?.phone;
  if (!customerPhone) {
    throw new ApiError(400, "Customer phone number not found");
  }

  // Verify OTP with notifications
  const verificationResult = await DeliveryVerificationService.verifyDeliveryOTPWithNotifications(
    orderId,
    otp,
    customerPhone,
    req.user._id // delivery associate ID from auth
  );

  if (!verificationResult.success) {
    throw new ApiError(400, verificationResult.message || "OTP verification failed");
  }

  res.status(200).json(
    new ApiResponse(
      200,
      { 
        order: {
          _id: order._id,
          status: 'delivered',
          deliveredAt: new Date()
        }
      },
      "Order delivered successfully! Notifications sent to customer and delivery associate."
    )
  );
});
// ==================== OTP GENERATION ====================

/**
 * Generate delivery OTP for order
 */
export const generateDeliveryOTP = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const deliveryAssociateId = req.user._id;

  const order = await Order.findById(orderId)
    .populate("customer", "phone email");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check if order is assigned to this delivery associate
  if (order.deliveryAssociate?.associate?.toString() !== deliveryAssociateId.toString()) {
    throw new ApiError(403, "Order not assigned to this delivery associate");
  }

  // Check if order is out for delivery
  if (order.status !== "out_for_delivery") {
    throw new ApiError(400, "Order must be out for delivery to generate OTP");
  }

  const otpData = await DeliveryVerificationService.generateDeliveryOTP(
    orderId,
    order.customer.phone,
    deliveryAssociateId
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { message: "OTP generated and sent successfully" },
      "OTP generated and sent successfully"
    )
  );
});

// ==================== GOOGLE MAPS ROUTE OPTIMIZATION ====================

/**
 * Get optimized route for delivery associate
 */
export const getOptimizedRoute = asyncHandler(async (req, res) => {
  const { orderIds } = req.body;
  const deliveryAssociateId = req.user._id;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new ApiError(400, "Order IDs are required");
  }

  // Get delivery associate location
  const deliveryAssociate = await DeliveryAssociate.findById(deliveryAssociateId);
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  // Get orders with pickup and delivery locations
  const orders = await Order.find({
    _id: { $in: orderIds },
    "deliveryAssociate.associate": deliveryAssociateId
  }).populate("supplier", "address location");

  if (orders.length === 0) {
    throw new ApiError(404, "No orders found");
  }

  // Create waypoints for route optimization
  const waypoints = [deliveryAssociate.currentLocation];
  
  orders.forEach(order => {
    // Add supplier location (pickup)
    if (order.supplier.location) {
      waypoints.push(order.supplier.location);
    }
    // Add delivery address
    waypoints.push({
      lat: order.deliveryAddress.latitude || 0,
      lng: order.deliveryAddress.longitude || 0
    });
  });

  // Get optimized route
  const optimizedRoute = await TomTomService.getOptimizedRoute(waypoints);
  // You may implement cost optimization logic here if needed
  const costOptimization = {};

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        optimizedRoute,
        costOptimization,
        orders: orders.map(order => ({
          id: order._id,
          orderId: order.orderId,
          pickupLocation: order.supplier.location,
          deliveryLocation: order.deliveryAddress,
          status: order.status
        }))
      },
      "Optimized route generated successfully"
    )
  );
});

/**
 * Get delivery time estimation
 */
export const getDeliveryTimeEstimate = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { pickupTime } = req.body;

  const order = await Order.findById(orderId)
    .populate("supplier", "location")
    .populate("deliveryAssociate.associate", "currentLocation");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const origin = order.supplier.location;
  const destination = {
    lat: order.deliveryAddress.latitude || 0,
    lng: order.deliveryAddress.longitude || 0
  };

  const timeEstimate = await TomTomService.getDeliveryTimeEstimate(
    origin,
    destination,
    pickupTime ? new Date(pickupTime) : new Date()
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { timeEstimate },
      "Delivery time estimated successfully"
    )
  );
});

// ==================== QR CODE GENERATION ====================

/**
 * Generate QR code for order delivery
 */
export const generateDeliveryQRCode = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const deliveryAssociateId = req.user._id;

  const order = await Order.findById(orderId)
    .populate("customer", "phone email")
    .populate("deliveryAssociate.associate");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.deliveryAssociate.associate.toString() !== deliveryAssociateId) {
    throw new ApiError(403, "Order not assigned to you");
  }

  // Generate QR code
  const qrCodeData = await QRCodeService.generateDeliveryQRCode(
    orderId,
    order.customer.phone,
    deliveryAssociateId
  );

  // Generate OTP and send to customer
  const otpData = await DeliveryVerificationService.generateDeliveryOTP(
    orderId,
    order.customer.phone,
    order.customer.email,
    deliveryAssociateId
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        qrCode: qrCodeData.qrCodeDataURL,
        deliveryToken: qrCodeData.deliveryToken,
        otpSent: true,
        customerPhone: order.customer.phone
      },
      "QR code generated and OTP sent successfully"
    )
  );
});

/**
 * Generate QR code for order replacement
 */
export const generateReplacementQRCode = asyncHandler(async (req, res) => {
  const { replacementOrderId } = req.params;
  const { originalOrderId } = req.body;

  const replacementOrder = await OrderReplacement.findOne({
    replacementOrder: replacementOrderId,
    originalOrder: originalOrderId
  }).populate("customer", "phone email");

  if (!replacementOrder) {
    throw new ApiError(404, "Replacement order not found");
  }

  // Generate QR code for replacement
  const qrCodeData = await QRCodeService.generateReplacementQRCode(
    originalOrderId,
    replacementOrderId,
    replacementOrder.customer.phone
  );

  // Generate OTP for replacement
  const otpData = await DeliveryVerificationService.generateReplacementOTP(
    originalOrderId,
    replacementOrderId,
    replacementOrder.customer.phone,
    replacementOrder.customer.email
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        qrCode: qrCodeData.qrCodeDataURL,
        replacementToken: qrCodeData.replacementToken,
        otpSent: true,
        customerPhone: replacementOrder.customer.phone
      },
      "Replacement QR code generated and OTP sent successfully"
    )
  );
});

// ==================== OTP VERIFICATION ====================

/**
 * Verify delivery OTP and complete delivery
 */
export const verifyDeliveryOTP = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { otp, qrCodeData } = req.body;
  const deliveryAssociateId = req.user._id;

  const order = await Order.findById(orderId)
    .populate("customer", "phone email");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  // Debug logs for assignment check
  console.log('Order assigned to:', order.deliveryAssociate?.associate?.toString());
  console.log('Current user:', deliveryAssociateId.toString());
  if (order.deliveryAssociate?.associate?.toString() !== deliveryAssociateId.toString()) {
    throw new ApiError(403, "Order not assigned to you");
  }
  
  // Verify QR code if provided
  if (qrCodeData) {
    try {
      const verifiedQRData = QRCodeService.verifyQRCode(qrCodeData);
      if (verifiedQRData.orderId !== orderId) {
        throw new ApiError(400, "Invalid QR code for this order");
      }
    } catch (error) {
      throw new ApiError(400, "Invalid QR code");
    }
  }

  // Verify OTP
  const otpVerification = await DeliveryVerificationService.verifyDeliveryOTP(
    orderId,
    otp,
    order.customer.phone
  );

  if (!otpVerification.success) {
    throw new ApiError(400, "OTP verification failed");
  }

  // Update order status to delivered
  order.status = "delivered";
  order.deliveryAssociate.status = "delivered";
  order.deliveredAt = new Date();

  // Add status history
  order.statusHistory.push({
    status: "delivered",
    updatedAt: new Date(),
    updatedBy: deliveryAssociateId,
    updatedByModel: "DeliveryAssociate",
    note: "Delivered with OTP verification"
  });

  // Remove deliveryAddress.location if coordinates are missing or invalid
  if (
    order.deliveryAddress &&
    order.deliveryAddress.location &&
    !Array.isArray(order.deliveryAddress.location.coordinates)
  ) {
    order.deliveryAddress.location = undefined;
  }

  await order.save();

  // Update delivery associate metrics
  await DeliveryAssociate.findByIdAndUpdate(
    deliveryAssociateId,
    {
      $inc: {
        completedDeliveries: 1,
        totalDeliveries: 1
      }
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        order: {
          id: order._id,
          orderId: order.orderId,
          status: order.status,
          deliveredAt: order.deliveredAt
        }
      },
      "Delivery completed successfully with OTP verification"
    )
  );
});

/**
 * Verify replacement OTP and complete replacement delivery
 */
export const verifyReplacementOTP = asyncHandler(async (req, res) => {
  const { replacementOrderId } = req.params;
  const { otp, qrCodeData } = req.body;

  const replacementOrder = await OrderReplacement.findOne({
    replacementOrder: replacementOrderId
  }).populate("customer", "phone email");

  if (!replacementOrder) {
    throw new ApiError(404, "Replacement order not found");
  }

  // Verify QR code if provided
  if (qrCodeData) {
    try {
      const verifiedQRData = QRCodeService.verifyQRCode(qrCodeData);
      if (verifiedQRData.replacementOrderId !== replacementOrderId) {
        throw new ApiError(400, "Invalid QR code for this replacement order");
      }
    } catch (error) {
      throw new ApiError(400, "Invalid QR code");
    }
  }

  // Verify OTP
  const otpVerification = await DeliveryVerificationService.verifyReplacementOTP(
    replacementOrderId,
    otp,
    replacementOrder.customer.phone
  );

  if (!otpVerification.success) {
    throw new ApiError(400, "Replacement OTP verification failed");
  }

  // Update replacement order status
  replacementOrder.status = "delivered";
  replacementOrder.isVerified = true;
  replacementOrder.verifiedAt = new Date();
  replacementOrder.deliveredAt = new Date();

  await replacementOrder.save();

  // Update the actual replacement order status
  await Order.findByIdAndUpdate(
    replacementOrder.replacementOrder,
    {
      status: "delivered",
      deliveredAt: new Date()
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        replacementOrder: {
          id: replacementOrder._id,
          status: replacementOrder.status,
          deliveredAt: replacementOrder.deliveredAt
        }
      },
      "Replacement delivery completed successfully with OTP verification"
    )
  );
});

// ==================== ORDER REPLACEMENT ====================

/**
 * Request order replacement
 */
export const requestOrderReplacement = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason, description, priority = "medium" } = req.body;
  const customerId = req.user._id;

  const originalOrder = await Order.findById(orderId)
    .populate("customer", "phone email")
    .populate("supplier", "businessName");

  if (!originalOrder) {
    throw new ApiError(404, "Order not found");
  }

  if (originalOrder.customer._id.toString() !== customerId) {
    throw new ApiError(403, "Not authorized to request replacement for this order");
  }

  // Check if order is eligible for replacement
  if (!["delivered", "out_for_delivery"].includes(originalOrder.status)) {
    throw new ApiError(400, "Order is not eligible for replacement");
  }

  // Create replacement order (simplified - in real implementation, you'd create a new order)
  const replacementOrder = await Order.create({
    customer: customerId,
    supplier: originalOrder.supplier._id,
    items: originalOrder.items,
    deliveryAddress: originalOrder.deliveryAddress,
    totalAmount: originalOrder.totalAmount,
    status: "pending",
    orderId: nanoid(),
    isReplacement: true,
    originalOrder: orderId
  });

  // Create replacement record
  const orderReplacement = await OrderReplacement.create({
    originalOrder: orderId,
    replacementOrder: replacementOrder._id,
    customer: customerId,
    supplier: originalOrder.supplier._id,
    reason,
    description,
    priority,
    totalAmount: originalOrder.totalAmount,
    deliveryAddress: originalOrder.deliveryAddress
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        replacementOrder: {
          id: orderReplacement._id,
          originalOrderId: orderId,
          replacementOrderId: replacementOrder._id,
          status: orderReplacement.status,
          reason: orderReplacement.reason,
          priority: orderReplacement.priority
        }
      },
      "Order replacement requested successfully"
    )
  );
});

/**
 * Get order replacements for customer
 */
export const getCustomerReplacements = asyncHandler(async (req, res) => {
  const customerId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { customer: customerId };
  if (status) {
    query.status = status;
  }

  const replacements = await OrderReplacement.find(query)
    .populate("originalOrder", "orderId items totalAmount")
    .populate("replacementOrder", "orderId items totalAmount")
    .populate("supplier", "businessName")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await OrderReplacement.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        replacements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      "Order replacements fetched successfully"
    )
  );
});

/**
 * Get order replacements for admin
 */
export const getAdminReplacements = asyncHandler(async (req, res) => {
  const { status, priority, page = 1, limit = 10 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const replacements = await OrderReplacement.find(query)
    .populate("originalOrder", "orderId items totalAmount")
    .populate("replacementOrder", "orderId items totalAmount")
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName")
    .sort({ priority: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await OrderReplacement.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        replacements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      "Order replacements fetched successfully"
    )
  );
});

/**
 * Approve/reject order replacement
 */
export const updateReplacementStatus = asyncHandler(async (req, res) => {
  const { replacementId } = req.params;
  const { status, approvalNotes, refundAmount = 0 } = req.body;
  const adminId = req.user._id;

  const replacement = await OrderReplacement.findById(replacementId)
    .populate("originalOrder")
    .populate("replacementOrder");

  if (!replacement) {
    throw new ApiError(404, "Replacement order not found");
  }

  if (!["approved", "rejected", "processing"].includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  // Update replacement status
  replacement.status = status;
  replacement.approvedBy = adminId;
  replacement.approvedAt = new Date();
  replacement.approvalNotes = approvalNotes;
  replacement.refundAmount = refundAmount;

  if (status === "approved") {
    // Update replacement order status
    await Order.findByIdAndUpdate(
      replacement.replacementOrder._id,
      { status: "processing" }
    );
  }

  await replacement.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        replacement: {
          id: replacement._id,
          status: replacement.status,
          approvedAt: replacement.approvedAt,
          approvalNotes: replacement.approvalNotes
        }
      },
      "Replacement status updated successfully"
    )
  );
});

// ==================== UTILITY FUNCTIONS ====================

/**
 * Resend delivery OTP
 */
export const resendDeliveryOTP = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const deliveryAssociateId = req.user._id;

  const order = await Order.findById(orderId)
    .populate("customer", "phone");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const otpData = await DeliveryVerificationService.resendDeliveryOTP(
    orderId,
    order.customer.phone
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { message: "OTP resent successfully" },
      "OTP resent successfully"
    )
  );
});

/**
 * Get delivery analytics
 */
export const getDeliveryAnalytics = asyncHandler(async (req, res) => {
  const deliveryAssociateId = req.user._id;
  const { period = "weekly" } = req.query;

  const deliveryAssociate = await DeliveryAssociate.findById(deliveryAssociateId);
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  // Get completed orders in the period
  const startDate = getStartDate(period);
  const completedOrders = await Order.find({
    "deliveryAssociate.associate": deliveryAssociateId,
    status: "delivered",
    deliveredAt: { $gte: startDate }
  });

  // Calculate analytics
  const analytics = {
    totalDeliveries: completedOrders.length,
    totalEarnings: completedOrders.reduce((sum, order) => sum + (order.deliveryCharge || 0), 0),
    averageDeliveryTime: calculateAverageDeliveryTime(completedOrders),
    onTimeDeliveries: completedOrders.filter(order => isOnTimeDelivery(order)).length,
    customerRating: deliveryAssociate.averageRating,
    totalRatings: deliveryAssociate.totalRatings
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      { analytics },
      "Delivery analytics fetched successfully"
    )
  );
});

// Helper functions (top-level)
function getStartDate(period) {
  const today = new Date();
  switch (period) {
    case "daily":
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    case "weekly":
      const day = today.getDay();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - day);
    case "monthly":
      return new Date(today.getFullYear(), today.getMonth(), 1);
    default:
      return new Date(0);
  }
}

function calculateAverageDeliveryTime(orders) {
  if (orders.length === 0) return 0;
  const totalTime = orders.reduce((sum, order) => {
    const deliveryTime = order.deliveredAt - order.createdAt;
    return sum + deliveryTime;
  }, 0);
  return Math.round(totalTime / orders.length / (1000 * 60)); // Return in minutes
}

function isOnTimeDelivery(order) {
  // Simple logic - consider delivery on time if within 2 hours of estimated time
  const estimatedTime = order.estimatedDeliveryDate;
  const actualTime = order.deliveredAt;
  if (!estimatedTime || !actualTime) return true;
  const timeDifference = Math.abs(actualTime - estimatedTime);
  return timeDifference <= 2 * 60 * 60 * 1000; // 2 hours in milliseconds
} 