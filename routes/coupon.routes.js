import { Router } from "express";
import {
  createCoupon,
  getAllCoupons,
  getActiveCoupons,
  getCouponById,
  getCouponByCode,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCouponToCart,
  removeCouponFromCart,
  getCouponStats
} from "../controllers/coupon.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes (no authentication required)
// None for coupons - all require authentication

// Customer routes (require authentication)
router.use(verifyJWT); // Apply JWT verification to all routes below

// Customer accessible routes
router.get("/active", getActiveCoupons); // Get all active coupons
router.get("/code/:code", getCouponByCode); // Get coupon by code
router.post("/validate", validateCoupon); // Validate coupon
router.post("/apply", applyCouponToCart); // Apply coupon to cart
router.delete("/remove", removeCouponFromCart); // Remove coupon from cart

// Admin only routes (require admin role)
// Note: Admin role verification should be added as middleware
// For now, assuming admin verification is handled in controller or separate middleware

router.post("/", createCoupon); // Create new coupon (Admin only)
router.get("/", getAllCoupons); // Get all coupons with pagination (Admin only)
router.get("/:id", getCouponById); // Get coupon by ID (Admin only)
router.put("/:id", updateCoupon); // Update coupon (Admin only)
router.delete("/:id", deleteCoupon); // Delete coupon (Admin only)
router.get("/:id/stats", getCouponStats); // Get coupon statistics (Admin only)

export default router;
