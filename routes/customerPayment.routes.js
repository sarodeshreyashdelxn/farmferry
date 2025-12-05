import express from "express";
import {
  getAllPaymentRecords,
  getPaymentRecordById,
  getPaymentStatistics,
  updatePaymentStatus,
  exportPaymentRecords
} from "../controllers/customerPayment.controller.js";

const router = express.Router();

// Get all payment records with filtering, searching, and pagination
router.get("/", getAllPaymentRecords);

// Get payment statistics
router.get("/statistics", getPaymentStatistics);

// Export payment records
router.get("/export", exportPaymentRecords);

// Get specific payment record by ID
router.get("/:paymentId", getPaymentRecordById);

// Update payment status
router.put("/:paymentId/status", updatePaymentStatus);

export default router;