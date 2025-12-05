// routes/sms.routes.js
import express from "express";
import smsUtils from "../utils/sms.js";

const router = express.Router();

// Route: Send Order Confirmation SMS
router.post("/send-order-sms", smsUtils.sendOrderSMS);

// Route: Send OTP for delivery confirmation
router.post("/send-otp", smsUtils.sendOTP);

router.post("/send-new-order-sms", smsUtils.sendNewOrderToDeliveryBoys);

export default router;
