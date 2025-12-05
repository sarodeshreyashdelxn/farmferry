import Order from "../models/order.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Handle Razorpay webhook
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const { event, payload } = req.body;
  
  console.log('Razorpay webhook received:', { event, payload });
  
  try {
    switch (event) {
      case 'payment.captured':
        await handlePaymentSuccess(payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailure(payload.payment.entity);
        break;
      default:
        console.log('Unhandled webhook event:', event);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle Stripe webhook
export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const { type, data } = req.body;
  
  console.log('Stripe webhook received:', { type, data });
  
  try {
    switch (type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(data.object);
        break;
      default:
        console.log('Unhandled webhook event:', type);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle UPI payment status update
export const handleUPIPaymentStatus = asyncHandler(async (req, res) => {
  const { orderId, paymentStatus, transactionId, paymentDetails } = req.body;
  
  if (!orderId || !paymentStatus) {
    throw new ApiError(400, "Order ID and payment status are required");
  }
  
  const order = await Order.findOne({ orderId });
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Update payment status
  order.paymentStatus = paymentStatus;
  if (transactionId) {
    order.transactionId = transactionId;
  }
  if (paymentDetails) {
    order.paymentDetails = paymentDetails;
  }
  
  // Add status history entry
  order.statusHistory.push({
    status: order.status,
    updatedAt: new Date(),
    updatedBy: order.customer,
    updatedByModel: "Customer",
    note: `Payment status updated to ${paymentStatus} via webhook`
  });
  
  await order.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Payment status updated successfully"
    )
  );
});

// Helper function to handle successful payments
const handlePaymentSuccess = async (paymentData) => {
  const { order_id, id: transactionId } = paymentData;
  
  // Find order by order ID or transaction reference
  const order = await Order.findOne({
    $or: [
      { orderId: order_id },
      { transactionId: transactionId },
      { "paymentDetails.razorpayOrderId": order_id }
    ]
  });
  
  if (!order) {
    console.error('Order not found for payment:', paymentData);
    return;
  }
  
  // Update payment status
  order.paymentStatus = 'paid';
  order.transactionId = transactionId;
  order.paymentDetails = {
    ...order.paymentDetails,
    gateway: 'razorpay',
    paymentId: transactionId,
    capturedAt: new Date().toISOString()
  };
  
  // Add status history entry
  order.statusHistory.push({
    status: order.status,
    updatedAt: new Date(),
    updatedBy: order.customer,
    updatedByModel: "Customer",
    note: "Payment successful via Razorpay"
  });
  
  await order.save();
  console.log(`Payment status updated to 'paid' for order: ${order.orderId}`);
};

// Helper function to handle failed payments
const handlePaymentFailure = async (paymentData) => {
  const { order_id, id: transactionId } = paymentData;
  
  // Find order by order ID or transaction reference
  const order = await Order.findOne({
    $or: [
      { orderId: order_id },
      { transactionId: transactionId },
      { "paymentDetails.razorpayOrderId": order_id }
    ]
  });
  
  if (!order) {
    console.error('Order not found for failed payment:', paymentData);
    return;
  }
  
  // Update payment status
  order.paymentStatus = 'failed';
  order.transactionId = transactionId;
  order.paymentDetails = {
    ...order.paymentDetails,
    gateway: 'razorpay',
    paymentId: transactionId,
    failedAt: new Date().toISOString(),
    failureReason: paymentData.error_description || 'Payment failed'
  };
  
  // Add status history entry
  order.statusHistory.push({
    status: order.status,
    updatedAt: new Date(),
    updatedBy: order.customer,
    updatedByModel: "Customer",
    note: "Payment failed via Razorpay"
  });
  
  await order.save();
  console.log(`Payment status updated to 'failed' for order: ${order.orderId}`);
};

export default {
  handleRazorpayWebhook,
  handleStripeWebhook,
  handleUPIPaymentStatus
};

