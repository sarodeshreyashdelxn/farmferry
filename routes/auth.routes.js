import { Router } from "express";
//import cors from "cors";

import {
  //registerCustomer,
  //loginCustomer,
  logout,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  registerAdmin,
  registerSupplier,
  registerDeliveryAssociate,
  login,
  forgotPassword,
  resetPassword,
  resetPasswordWithOTP,
  sendPhoneVerification,
  verifyPhoneOTP,
  sendDeliveryAssociatePhoneVerification,
  loginDeliveryAssociate,
  getDeliveryAssociateMe,
  loginSupplier,
  loginAdmin,
  loginWithPhoneOtp,
  sendLoginOtp
} from "../controllers/auth.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();

// ================== PUBLIC ROUTES (No JWT required) ==================
//router.post("/register", registerCustomer);
//router.post("/register/customer", registerCustomer);
router.post("/login", login);

// OTP-based customer login
router.post("/send-customer-otp", sendLoginOtp);   // Step 1: send OTP
router.post("/login/customer-otp", loginWithPhoneOtp); // Step 2: verify OTP & login

router.post("/login/admin", loginAdmin);
//router.post("/login/customer", loginCustomer);
router.post("/login/supplier", loginSupplier);
router.post("/login/delivery-associate", loginDeliveryAssociate);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/reset-password-otp", resetPasswordWithOTP); // New route for customer OTP reset
// OTP routes
router.post("/send-phone-verification", sendPhoneVerification);
router.post("/verify-phone-otp", verifyPhoneOTP);
router.post("/send-delivery-associate-otp", sendDeliveryAssociatePhoneVerification);
router.post("/register/admin", registerAdmin);
router.post("/register/delivery-associate", registerDeliveryAssociate);
router.post("/register/supplier", registerSupplier);
// Secured routes (require authentication)
router.use(verifyJWT);

router.post("/logout", logout);
router.post("/change-password", changePassword);
router.get("/current-user", getCurrentUser);
router.patch("/update-account", updateAccountDetails);
router.patch("/update-avatar", upload.single("avatar"), updateUserAvatar);
router.patch("/update-cover-image", upload.single("coverImage"), updateUserCoverImage);


// Channel routes
router.get("/c/:username", getUserChannelProfile);
router.get("/history", getWatchHistory);

// Delivery associate protected route
router.get("/me/delivery-associate", getDeliveryAssociateMe);

export default router;