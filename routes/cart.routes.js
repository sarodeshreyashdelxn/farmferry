import { Router } from "express";
import {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  applyCoupon
} from "../controllers/cart.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply JWT verification and customer role to all routes
router.use(verifyJWT, authorizeRoles("customer"));

// Cart routes
router.get("/", getCart);
router.post("/items", addItemToCart);
router.put("/items/:itemId", updateCartItemQuantity);
router.delete("/items/:itemId", removeCartItem);
router.delete("/", clearCart);
router.post("/apply-coupon", applyCoupon);

export default router;
