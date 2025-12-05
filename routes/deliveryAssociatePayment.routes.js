import { Router } from "express";
import {
    getAllDeliveryAssociatePayments,
    getDeliveryAssociatePaymentById,
    getPaymentStatistics,
    updatePaymentStatus
} from "../controllers/deliveryAssociatePayment.controller.js";

const router = Router();

// Apply authentication middleware to all routes


// GET /api/v1/delivery-payments - Get all delivery associate payment records
// Query params: page, limit, status, sortBy, sortOrder, search, dateFrom, dateTo
router.route("/")
    .get(
        getAllDeliveryAssociatePayments
    );

// GET /api/v1/delivery-payments/statistics - Get payment statistics and summary
router.route("/statistics")
    .get(
        getPaymentStatistics
    );

// GET /api/v1/delivery-payments/:partnerId - Get payment details for specific delivery associate
router.route("/:partnerId")
    .get(
        getDeliveryAssociatePaymentById
    );

// PATCH /api/v1/delivery-payments/:partnerId/:paymentId - Update payment status
router.route("/:partnerId/:paymentId")
    .patch(
        updatePaymentStatus
    );

export default router;