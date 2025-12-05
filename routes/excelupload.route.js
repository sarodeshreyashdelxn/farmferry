// excelupload.route.js
import express from "express";
import multer from "multer";
import {
  generateTemplate,
  parseExcelUpload,
  getPreviewProducts,
  confirmUpload,
  deletePreviewProducts,
  getUploadStatus,
  updatePreviewProduct,
  uploadPreviewProductImage,
  uploadMultiplePreviewProductImages,
  setMainPreviewProductImage,
  deletePreviewProductImage,
  getPreviewProductImages,
} from "../controllers/excelUpload.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// ---------- Storage ----------
const storage = multer.memoryStorage();

// ---------- Excel Upload ----------
const excelUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ---------- Image Upload ----------
const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

// ---------- Multer Error Handler ----------
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: "File too large.",
      });
    }
  }

  if (
    error.message === "Only Excel files are allowed" ||
    error.message === "Only image files are allowed"
  ) {
    return res.status(400).json({ status: "error", message: error.message });
  }

  next(error);
};

// Apply JWT middleware
router.use(verifyJWT);

// ---------------- Excel Routes ----------------
router.get("/:supplierId/template/:type", generateTemplate);
router.post(
  "/:supplierId/upload",
  excelUpload.single("excelFile"),
  handleMulterError,
  parseExcelUpload
);
router.get("/:supplierId/preview-products", getPreviewProducts);
router.get("/:supplierId/upload-status", getUploadStatus);
router.patch("/:supplierId/preview-products/:previewProductId", updatePreviewProduct);
router.post("/:supplierId/confirm-upload", confirmUpload);
router.delete("/:supplierId/preview-products", deletePreviewProducts);

// ---------------- Image Routes ----------------
router.post(
  "/:supplierId/preview-products/:previewProductId/upload-image",
  imageUpload.single("image"),
  handleMulterError,
  uploadPreviewProductImage
);

router.post(
  "/:supplierId/preview-products/:previewProductId/upload-images",
  imageUpload.array("images", 5),
  handleMulterError,
  uploadMultiplePreviewProductImages
);

router.patch(
  "/:supplierId/preview-products/:previewProductId/images/:imageId/set-main",
  setMainPreviewProductImage
);

router.delete(
  "/:supplierId/preview-products/:previewProductId/images/:imageId",
  deletePreviewProductImage
);

router.get(
  "/:supplierId/preview-products/:previewProductId/images",
  getPreviewProductImages
);

export default router;
