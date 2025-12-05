import { Router } from "express";
//import cors from "cors";

import {
  getCustomerProfile,
  updateCustomerProfile,
  updateProfileImage,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  getCustomerOrders,
  getCustomerReviews,
  getPendingReviews
} from "../controllers/customer.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Apply JWT verification and admin role to all routes
router.use(verifyJWT, authorizeRoles("customer"));

// Apply JWT verification to all routes
router.use(verifyJWT, authorizeRoles("customer"));

// Profile routes
router.get("/profile", getCustomerProfile);
router.put("/profile", updateCustomerProfile);
router.put("/profile/image", upload.single("profileImage"), updateProfileImage);

// Address routes
router.post("/address", addAddress);
router.put("/address/:addressId", updateAddress);
router.delete("/address/:addressId", deleteAddress);
router.put("/address/:addressId/default", setDefaultAddress);

// Wishlist routes
router.post("/wishlist", addToWishlist);
router.delete("/wishlist/:productId", removeFromWishlist);
router.get("/wishlist", getWishlist);

// Order routes
router.get("/orders", getCustomerOrders);

// Review routes
router.get("/reviews", getCustomerReviews);
router.get("/reviews/pending", getPendingReviews);

export default router;
