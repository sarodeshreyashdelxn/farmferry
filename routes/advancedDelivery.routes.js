import { Router } from "express";
import {
  getOptimizedRoute,
  getDeliveryTimeEstimate,
  generateDeliveryQRCode,
  generateReplacementQRCode,
  generateDeliveryOTP,
  verifyDeliveryOTP,
  verifyReplacementOTP,
  requestOrderReplacement,
  getCustomerReplacements,
  getAdminReplacements,
  updateReplacementStatus,
  resendDeliveryOTP,
  getDeliveryAnalytics,

  verifyDeliveryOTPWithNotifications
} from "../controllers/advancedDelivery.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// ==================== GOOGLE MAPS ROUTE OPTIMIZATION ====================

// Get optimized route for delivery associate
router.post(
  "/route/optimize",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  getOptimizedRoute
);

router.post('/verify-delivery', verifyJWT, authorizeRoles("deliveryAssociate"), verifyDeliveryOTPWithNotifications);
// Get delivery time estimation
router.post(
  "/route/estimate/:orderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate", "admin"),
  getDeliveryTimeEstimate
);

// ==================== QR CODE GENERATION ====================

// Generate QR code for order delivery
router.post(
  "/qr/delivery/:orderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  generateDeliveryQRCode
);

// Generate QR code for order replacement
router.post(
  "/qr/replacement/:replacementOrderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate", "admin"),
  generateReplacementQRCode
);

// ==================== OTP GENERATION & VERIFICATION ====================

// Generate delivery OTP
router.post(
  "/otp/generate/:orderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  generateDeliveryOTP
);

// Verify delivery OTP and complete delivery
router.post(
  "/verify/delivery/:orderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  verifyDeliveryOTP
);

// Verify replacement OTP and complete replacement delivery
router.post(
  "/verify/replacement/:replacementOrderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  verifyReplacementOTP
);

// Resend delivery OTP
router.post(
  "/otp/resend/:orderId",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  resendDeliveryOTP
);

// ==================== ORDER REPLACEMENT ====================

// Request order replacement (customer)
router.post(
  "/replacement/request/:orderId",
  verifyJWT,
  authorizeRoles("customer"),
  requestOrderReplacement
);

// Get customer replacements
router.get(
  "/replacement/customer",
  verifyJWT,
  authorizeRoles("customer"),
  getCustomerReplacements
);

// Get admin replacements
router.get(
  "/replacement/admin",
  verifyJWT,
  authorizeRoles("admin"),
  getAdminReplacements
);

// Update replacement status (admin)
router.put(
  "/replacement/:replacementId/status",
  verifyJWT,
  authorizeRoles("admin"),
  updateReplacementStatus
);

// ==================== ANALYTICS ====================

// Get delivery analytics
router.get(
  "/analytics",
  verifyJWT,
  authorizeRoles("deliveryAssociate"),
  getDeliveryAnalytics
);

export default router; 