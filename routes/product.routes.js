import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProductImage,
  deleteProduct,
  getMyProducts,
  getProductsBySupplier,
  addOffer
} from "../controllers/product.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// Protected routes
router.use(verifyJWT);

// Supplier and admin routes
router.post(
  "/",
  authorizeRoles("supplier", "admin"),
  upload.array("images", 5),
  createProduct
);

router.post(
  "/:id",
  authorizeRoles("supplier", "admin"),
  upload.array("images", 5),
  updateProduct
);

router.patch('/:id', upload.array('images'), updateProduct);

router.delete(
  "/:id/images/:imageId",
  authorizeRoles("supplier", "admin"),
  deleteProductImage
);

router.delete(
  "/:id",
  authorizeRoles("supplier", "admin"),
  deleteProduct
);

router.get(
  '/supplier/me',
  authorizeRoles('supplier'),
  getMyProducts
);

router.get(
  '/supplier/:supplierId',
  authorizeRoles('admin', 'supplier'),
  getProductsBySupplier
);

// Add offer to product
router.post(
  '/:id/offer',
  authorizeRoles('supplier'),
  addOffer
);

export default router;
