import { Router } from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  deleteReviewImage,
  markReviewAsHelpful,
  reportReview,
  toggleReviewVisibility,
  replyToReview,
  addCustomerReply
} from "../controllers/review.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.get("/product/:productId", getProductReviews);

// Protected routes
router.use(verifyJWT);

// Customer routes
router.post(
  "/",
  authorizeRoles("customer"),
  upload.array("images", 5),
  createReview
);

router.put(
  "/:id",
  authorizeRoles("customer"),
  upload.array("images", 5),
  updateReview
);

router.delete(
  "/:id",
  authorizeRoles("customer", "admin"),
  deleteReview
);

router.delete(
  "/:id/images/:imageId",
  authorizeRoles("customer"),
  deleteReviewImage
);

// Public routes that require authentication
router.post("/:id/helpful", markReviewAsHelpful);
router.post("/:id/report", reportReview);

// Admin routes
router.put(
  "/:id/visibility",
  authorizeRoles("admin"),
  toggleReviewVisibility
);

// Supplier and admin routes
router.post(
  "/:id/reply",
  authorizeRoles("supplier", "admin"),
  replyToReview
);

// Customer reply to admin/seller response
router.post(
  "/:id/customer-reply",
  authorizeRoles("customer"),
  addCustomerReply
);

export default router;
