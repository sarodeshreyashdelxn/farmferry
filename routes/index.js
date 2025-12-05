import { Router } from "express";
import authRoutes from "./auth.routes.js";
import customerRoutes from "./customer.routes.js";
import supplierRoutes from "./supplier.routes.js";
import productRoutes from "./product.routes.js";
import categoryRoutes from "./category.routes.js";
import orderRoutes from "./order.routes.js";
import cartRoutes from "./cart.routes.js";
import reviewRoutes from "./review.routes.js";
import adminRoutes from "./admin.routes.js";
import deliveryAssociateRoutes from "./deliveryAssociate.routes.js";
import notificationRoutes from "./notification.routes.js";
import advancedDeliveryRoutes from "./advancedDelivery.routes.js";
import superadminRoutes from "./superadmin.routes.js";
import customerPaymentRoutes from "./customerPayment.routes.js"
import smsRoutes from "./sms.routes.js";
import deliveryAssociatePaymentRoutes from "./deliveryAssociatePayment.routes.js";
import supplierPaymentRoutes from "./supplierPayment.routes.js";
import refundRoutes from "./refund.routes.js";
import paymentWebhookRoutes from "./paymentWebhook.routes.js";
import excelUploadRoutes from "./excelupload.route.js";
import errorHandler from "../middlewares/errorHandler.js";
import couponRoutes from "./coupon.routes.js";
//import settingsRoutes from "./settings.routes.js";

const router = Router();

// Register all routes
router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/orders", orderRoutes);
router.use("/cart", cartRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin", adminRoutes);
router.use("/delivery-associates", deliveryAssociateRoutes);
router.use("/notifications", notificationRoutes);
router.use("/advanced-delivery", advancedDeliveryRoutes);
router.use("/superadmin", superadminRoutes);
//router.use("/settings", settingsRoutes);

router.use("/payments", customerPaymentRoutes);
router.use("/delivery-payments", deliveryAssociatePaymentRoutes);
router.use("/supplier-payments", supplierPaymentRoutes);
router.use("/refunds", refundRoutes);
router.use("/webhooks", paymentWebhookRoutes);

router.use("/sms", smsRoutes);


//Excel Upload Route
router.use('/excel-upload', excelUploadRoutes);
// Error handler middleware (should be last)
router.use(errorHandler);
router.use("/coupons", couponRoutes);

export default router;
