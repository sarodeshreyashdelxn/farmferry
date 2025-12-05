// import { Router } from "express";
// import {
//   getSettings,
//   updateSettings,
//   getDeliveryCharges,
//   resetSettings
// } from "../controllers/settings.controller.js";
// import { verifyJWT } from "../middlewares/auth.middleware.js";
//import { isAdmin } from "../middlewares/auth.middleware.js";

// const router = Router();

// // Public routes
// router.get("/", getSettings);
// router.get("/delivery-charges", getDeliveryCharges);

// // Admin only routes
// router.put("/", verifyJWT, isAdmin, updateSettings);
// router.post("/reset", verifyJWT, isAdmin, resetSettings);

// export default router; 