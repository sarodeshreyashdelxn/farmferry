import express from "express";
import {
  handleRazorpayWebhook,
  handleStripeWebhook,
  handleUPIPaymentStatus
} from "../controllers/paymentWebhook.controller.js";

const router = express.Router();

// Razorpay webhook endpoint
router.post("/razorpay", handleRazorpayWebhook);

// Stripe webhook endpoint
router.post("/stripe", handleStripeWebhook);

// UPI payment status update endpoint
router.post("/upi-status", handleUPIPaymentStatus);

export default router;

