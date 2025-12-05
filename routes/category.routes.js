import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryTree,
  updateCategory,
  deleteCategory,
  addHandlingFee,
  getCategoryHandlingFee
} from "../controllers/category.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.get("/", getAllCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategoryById);

// Protected routes
router.use(verifyJWT);

// Admin routes - Specific routes first
router.post(
  "/add-handling-fee",
  authorizeRoles("admin"),
  addHandlingFee
);
router.get('/:categoryId/handling-fee', getCategoryHandlingFee);

router.post(
  "/",
  authorizeRoles("admin"),
  upload.single("image"),
  createCategory
);

router.put(
  "/:id",
  authorizeRoles("admin"),
  upload.single("image"),
  updateCategory
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  deleteCategory
);

export default router;
