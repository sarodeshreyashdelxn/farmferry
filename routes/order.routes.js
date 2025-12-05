import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAssociate,
  updateDeliveryStatus,
  getMyOrders,
  getOrderStatusCounts,
  getAvailableOrdersForDelivery, // NEW
  selfAssignOrder, // NEW
  getMyCustomerOrders, // NEW
  generateOrderInvoice, // NEW
  getOrderInvoice, // NEW
  updateOrderPaymentStatus, // NEW
  
} from "../controllers/order.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply JWT verification to all routes
router.use(verifyJWT);

// Customer routes
router.post("/", authorizeRoles("customer"), createOrder);
router.get("/my-orders", authorizeRoles("customer"), getMyCustomerOrders);
//router.get("/nearby",  getAvailableOrdersNearby)

// Admin routes (must come before other GET routes)
router.get("/", authorizeRoles("admin"), getAllOrders);

// Delivery associate routes
router.get("/available-for-delivery", authorizeRoles("deliveryAssociate"), getAvailableOrdersForDelivery);
//router.get("/available-for-delivery", authorizeRoles("deliveryAssociate"), getAvailableOrdersNearby);

// Common routes (accessible by all authenticated users with appropriate roles)
router.get("/:id", getOrderById);

// Delivery associate routes
router.put("/:id/self-assign", authorizeRoles("deliveryAssociate"), selfAssignOrder);

// Supplier routes
router.get("/supplier/me", authorizeRoles("supplier"), getMyOrders);
router.get("/supplier/me/status-counts", authorizeRoles("supplier"), getOrderStatusCounts);

// Supplier and admin routes
router.put(
  "/:id/status",
  authorizeRoles("supplier", "admin", "customer", "deliveryAssociate"),
  updateOrderStatus
);

// Customer and admin routes for payment status
router.put(
  "/:id/payment-status",
  authorizeRoles("customer", "admin"),
  updateOrderPaymentStatus
);

router.put(
  "/:id/assign-delivery",
  authorizeRoles("supplier", "admin"),
  assignDeliveryAssociate
);

// Delivery associate routes
router.put(
  "/:id/delivery-status",
  authorizeRoles("deliveryAssociate"),
  updateDeliveryStatus
);

// Invoice routes
router.post(
  "/:id/invoice",
  authorizeRoles("customer", "supplier", "admin"),
  generateOrderInvoice
);

router.get(
  "/:id/invoice",
  authorizeRoles("customer", "supplier", "admin"),
  getOrderInvoice
);

export default router;
