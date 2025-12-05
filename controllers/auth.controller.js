import crypto from "crypto";
import jwt from "jsonwebtoken";
import Customer from "../models/customer.model.js";
import Supplier from "../models/supplier.model.js";
import Admin from "../models/admin.model.js";
import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendEmail from "../utils/email.js";
import smsUtils from "../utils/sms.js";

// Helper function to generate tokens and save to cookies
const generateTokensAndSetCookies = async (user, res) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Set cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' ? true : false,
    };

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating tokens");
  }
};



export const sendLoginOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) throw new ApiError(400, "Phone number is required");

  // Find or create customer
  let customer = await Customer.findOne({ phone });
  if (!customer) {
    customer = await Customer.create({ phone, isPhoneVerified: false });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  customer.phoneOTP = otp;
  customer.phoneOTPExpires = Date.now() + 30 * 1000; // 5 mins
  await customer.save({ validateBeforeSave: false });

  // Send OTP via Twilio
  await smsUtils.sendSMS(
    phone,
    `Your FarmFerry login OTP is: ${otp}. Valid for 5 minutes.`
  );

  return res.json(
    new ApiResponse(200, { phone }, "OTP sent successfully")
  );
});


/**
 * Step 2: Verify OTP and login
 */
export const loginWithPhoneOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) throw new ApiError(400, "Phone and OTP are required");

  const customer = await Customer.findOne({ phone });
  if (!customer) throw new ApiError(404, "Customer not found");

  // Check OTP
  if (
    !customer.phoneOTP ||
    customer.phoneOTP !== otp ||
    customer.phoneOTPExpires < Date.now()
  ) {
    throw new ApiError(401, "Invalid or expired OTP");
  }

  // Mark phone as verified
  customer.isPhoneVerified = true;
  customer.phoneOTP = undefined;
  customer.phoneOTPExpires = undefined;
  customer.lastLogin = new Date();
  await customer.save({ validateBeforeSave: false });

  // Remove sensitive fields
  const loggedInCustomer = await Customer.findById(customer._id).select(
    "-password -passwordResetToken -passwordResetExpires"
  );

  // Generate JWT tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(
    customer,
    res
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { customer: loggedInCustomer, accessToken, refreshToken },
      "Customer logged in successfully"
    )
  );
});


// Admin Registration
export const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = "admin", permissions } = req.body;
  console.log(req.body);

  if (!name || !email || !password) {
    throw new ApiError(400, "email, name, password are required");
  }

  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    throw new ApiError(409, "Email is already registered");
  }

  const [firstName, ...lastNameParts] = name.trim().split(" ");
  const lastName = lastNameParts.join(" ");

  const admin = await Admin.create({
    name: { firstName, lastName },
    email: email.toLowerCase(),
    password,
    phone,
    role,
    permissions,
    lastLogin: new Date()
  });

  const createdAdmin = await Admin.findById(admin._id).select(
    "-password -passwordResetToken -passwordResetExpires"
  );

  if (!createdAdmin) {
    throw new ApiError(500, "Something went wrong while registering the admin");
  }

  const { accessToken, refreshToken } = await generateTokensAndSetCookies(admin, res);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        admin: createdAdmin,
        accessToken,
        refreshToken
      },
      "Admin registered successfully"
    )
  );
});

// Supplier Registration
export const registerSupplier = asyncHandler(async (req, res) => {
  const {
    businessName,
    ownerName,
    email,
    password,
    phone,
    businessType,
    address
  } = req.body;
  console.log(req.body);
  // Validate required fields


  // Check if email already exists
  const existingSupplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (existingSupplier) {
    throw new ApiError(409, "Email is already registered");
  }

  // Create new supplier
  const supplier = await Supplier.create({
    businessName,
    ownerName,
    email: email.toLowerCase(),
    password,
    phone,
    businessType,
    address,
    status: "pending",
    lastLogin: new Date()
  });

  // Remove sensitive fields from response
  const createdSupplier = await Supplier.findById(supplier._id).select("-password -passwordResetToken -passwordResetExpires");

  if (!createdSupplier) {
    throw new ApiError(500, "Something went wrong while registering the supplier");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(supplier, res);

  // Send response
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        supplier: createdSupplier,
        accessToken,
        refreshToken
      },
      "Supplier registered successfully. Your account is pending verification."
    )
  );
});

// Supplier Login
export const loginSupplier = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Find supplier
  const supplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }

  // Verify password
  const isPasswordValid = await supplier.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Update last login
  supplier.lastLogin = new Date();
  await supplier.save();

  // Get supplier without sensitive fields
  const loggedInSupplier = await Supplier.findById(supplier._id).select("-password -passwordResetToken -passwordResetExpires");

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(supplier, res);

  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInSupplier,
        accessToken,
        refreshToken
      },
      "Supplier logged in successfully"
    )
  );
});

// Admin Login
export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log(email,password)
  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Find admin
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  // Verify password
  const isPasswordValid = await admin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Update last login
  admin.lastLogin = new Date();
  await admin.save();

  // Get admin without sensitive fields
  const loggedInAdmin = await Admin.findById(admin._id).select("-password -passwordResetToken -passwordResetExpires");

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(admin, res);

  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        admin: loggedInAdmin,
        accessToken,
        refreshToken
      },
      "Admin logged in successfully"
    )
  );
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Logged out successfully"
    )
  );
});

// Refresh Access Token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookies
  const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    // Verify refresh token
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Find user
    let user;
    if (req.body.role === "admin") {
      user = await Admin.findById(decodedToken.id);
    } else if (req.body.role === "supplier") {
      user = await Supplier.findById(decodedToken.id);
    } else {
      user = await Customer.findById(decodedToken.id);
    }

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Generate new tokens
    const { accessToken, refreshToken } = await generateTokensAndSetCookies(user, res);

    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        { accessToken, refreshToken },
        "Access token refreshed"
      )
    );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Forgot Password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Find user based on role, or auto-detect if role not provided
  let user;
  let resolvedRole = role?.toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  if (resolvedRole === "admin") {
    user = await Admin.findOne({ email: normalizedEmail });
  } else if (resolvedRole === "supplier") {
    user = await Supplier.findOne({ email: normalizedEmail });
  } else if (resolvedRole === "customer") {
    user = await Customer.findOne({ email: normalizedEmail });
  } else {
    // Auto-detect role by searching across collections
    user = await Supplier.findOne({ email: normalizedEmail });
    resolvedRole = user ? "supplier" : resolvedRole;

    if (!user) {
      user = await Admin.findOne({ email: normalizedEmail });
      resolvedRole = user ? "admin" : resolvedRole;
    }
    if (!user) {
      user = await Customer.findOne({ email: normalizedEmail });
      resolvedRole = user ? "customer" : resolvedRole;
    }
  }

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Generate reset token or OTP based on role
  if (resolvedRole === "customer") {
    // For customers, generate OTP
    const resetOTP = user.generatePasswordResetOTP();
    await user.save({ validateBeforeSave: false });

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset OTP",
        html: `
          <h1>Password Reset OTP</h1>
          <p>You are receiving this email because you (or someone else) has requested the reset of your password.</p>
          <p>Your password reset OTP is: <strong style="font-size: 24px; color: #28a745; letter-spacing: 2px;">${resetOTP}</strong></p>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending password reset OTP email:", error);
      throw new ApiError(500, "There was an error sending the email. Please try again later.");
    }

    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset OTP sent to email"
      )
    );
  } else {
    // For admin and supplier, use token (existing logic)
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetURL = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html: `
          <h1>Password Reset Request</h1>
          <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
          <p>Please click on the following link, or paste this into your browser to complete the process:</p>
          <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw new ApiError(500, "There was an error sending the email. Please try again later.");
    }

    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset instructions sent to email"
      )
    );
  }
});

// Reset Password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password, role, otp } = req.body;

  if (role === "customer" || otp) {
    // For customers, use OTP
    if (!otp || !password) {
      throw new ApiError(400, "OTP and password are required");
    }

    // Find customer with valid OTP
    const user = await Customer.findOne({
      passwordResetOTP: otp,
      passwordResetOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new ApiError(400, "OTP is invalid or has expired");
    }

    // Update password and clear OTP
    user.password = password;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save();

    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset successful"
      )
    );
  } else {
    // For admin and supplier (and fallback), use token without requiring role
    if (!token || !password) {
      throw new ApiError(400, "Token and password are required");
    }

    // Hash the token
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Try to find user by token across roles if role not provided
    let user;
    const resolvedRole = role?.toLowerCase();

    if (resolvedRole === "admin") {
      user = await Admin.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    } else if (resolvedRole === "supplier") {
      user = await Supplier.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    } else if (resolvedRole === "customer") {
      user = await Customer.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    } else {
      // Auto-detect: supplier -> admin -> customer
      user = await Supplier.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
      if (!user) {
        user = await Admin.findOne({
          passwordResetToken: hashedToken,
          passwordResetExpires: { $gt: Date.now() }
        });
      }
      if (!user) {
        user = await Customer.findOne({
          passwordResetToken: hashedToken,
          passwordResetExpires: { $gt: Date.now() }
        });
      }
    }

    if (!user) {
      throw new ApiError(400, "Token is invalid or has expired");
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset successful"
      )
    );
  }
});

// Reset Password with OTP (for customers)
export const resetPasswordWithOTP = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password) {
    throw new ApiError(400, "Email, OTP and password are required");
  }

  // Find customer with valid OTP
  const user = await Customer.findOne({
    email: email.toLowerCase(),
    passwordResetOTP: otp,
    passwordResetOTPExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new ApiError(400, "OTP is invalid or has expired");
  }

  // Update password and clear OTP
  user.password = password;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpires = undefined;
  await user.save();

  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Password reset successful"
    )
  );
});

// Send Phone Verification OTP
export const sendPhoneVerification = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    throw new ApiError(400, "Phone number is required");
  }

  // First try to find customer
  let customer = await Customer.findOne({ phone });

  if (customer) {
    // Generate new phone verification OTP for customer
    const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString();
    customer.phoneOTP = phoneOTP;
    customer.phoneOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await customer.save({ validateBeforeSave: false });

    try {
      await smsUtils.sendSMS(
        customer.phone,
        `Your FarmFerry verification OTP is: ${phoneOTP}. Valid for 10 minutes.`
      );
    } catch (error) {
      console.error("Error sending verification SMS:", error);
      throw new ApiError(500, "There was an error sending the SMS. Please try again later.");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Verification OTP sent successfully"));
  }

  // If not customer, try supplier
  const supplier = await Supplier.findOne({ phone });

  if (supplier) {
    const otp = supplier.generatePhoneVerificationToken();
    await supplier.save({ validateBeforeSave: false });

    try {
      await sendSMS(
        supplier.phone,
        `Your FarmFerry verification code is: ${otp}`
      );
    } catch (error) {
      console.error("Error sending verification SMS:", error);
      throw new ApiError(500, "There was an error sending the SMS. Please try again later.");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Verification OTP sent successfully"));
  }

  throw new ApiError(404, "User not found with this phone number");
});

// Verify Phone OTP
export const verifyPhone = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw new ApiError(400, "Phone number and OTP are required");
  }

  const supplier = await Supplier.findOne({
    phone,
    phoneVerificationToken: otp,
    phoneVerificationExpires: { $gt: Date.now() },
  });

  if (!supplier) {
    throw new ApiError(400, "Invalid OTP or OTP has expired");
  }

  supplier.isPhoneVerified = true;
  supplier.phoneVerificationToken = undefined;
  supplier.phoneVerificationExpires = undefined;
  await supplier.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Phone number verified successfully"));
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  // Get user from request
  const user = await req.user.constructor.findById(req.user._id);

  // Verify current password
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Password changed successfully"
    )
  );
});

// Delivery Associate Registration
export const registerDeliveryAssociate = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    gender,
    dateOfBirth,
    address,
    vehicle
  } = req.body;

  // Validate required fields
  if (!name || !email || !phone || !password || !address) {
    throw new ApiError(400, "Name, email, phone, password, and address are required");
  }

  // Check if email already exists
  const existingEmail = await DeliveryAssociate.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, "Email is already registered");
  }

  // Check if phone already exists
  const existingPhone = await DeliveryAssociate.findOne({ phone });
  if (existingPhone) {
    throw new ApiError(409, "Phone number is already registered");
  }

  // Create new delivery associate
  const deliveryAssociate = await DeliveryAssociate.create({
    name,
    email: email.toLowerCase(),
    phone,
    password,
    gender,
    dateOfBirth,
    address,
    vehicle,
    isVerified: false,
    lastLogin: new Date()
  });

  // Remove sensitive fields from response
  const createdDeliveryAssociate = await DeliveryAssociate.findById(deliveryAssociate._id).select(
    "-password -passwordResetToken -passwordResetExpires"
  );

  if (!createdDeliveryAssociate) {
    throw new ApiError(500, "Something went wrong while registering the delivery associate");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(deliveryAssociate, res);

  // Send welcome email
  try {
    await sendEmail({
      to: createdDeliveryAssociate.email,
      subject: "Welcome to FarmFerry Delivery Team!",
      html: `
        <h1>Welcome, ${createdDeliveryAssociate.name}!</h1>
        <p>Thank you for joining the FarmFerry delivery team. We're excited to have you on board.</p>
        <p>Your account has been created successfully and is pending verification. Our team will review your profile and get back to you soon.</p>
        <p>Once verified, you'll be able to start accepting delivery orders and earning money.</p>
        <a href="${process.env.FRONTEND_URL}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Get Started</a>
      `,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }

  // Send response
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          _id: createdDeliveryAssociate._id,
          name: createdDeliveryAssociate.name,
          email: createdDeliveryAssociate.email,
          phone: createdDeliveryAssociate.phone,
          isVerified: createdDeliveryAssociate.isVerified,
          vehicle: createdDeliveryAssociate.vehicle,
        },
        accessToken,
        refreshToken
      },
      "Delivery associate registered successfully. Your account is pending verification."
    )
  );
});

// Delivery Associate Login
export const loginDeliveryAssociate = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new ApiError(400, "Phone and password are required");
  }

  const deliveryAssociate = await DeliveryAssociate.findOne({ phone });
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  const isPasswordValid = await deliveryAssociate.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  deliveryAssociate.lastLogin = new Date();
  await deliveryAssociate.save();

  const { accessToken, refreshToken } = await generateTokensAndSetCookies(deliveryAssociate, res);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          _id: deliveryAssociate._id,
          name: deliveryAssociate.name,
          email: deliveryAssociate.email,
          phone: deliveryAssociate.phone,
          isVerified: deliveryAssociate.isVerified,
          vehicle: deliveryAssociate.vehicle,
        },
        token: accessToken,
        refreshToken,
      },
      "Delivery associate logged in successfully"
    )
  );
});

export const getDeliveryAssociateMe = asyncHandler(async (req, res) => {
  const deliveryAssociate = await DeliveryAssociate.findById(req.user.id).select("-password -passwordResetToken -passwordResetExpires");
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }
  return res.status(200).json(
    new ApiResponse(
      200,
      deliveryAssociate,
      "Delivery associate profile fetched successfully"
    )
  );
});

// Send Phone Verification OTP for Delivery Associate
export const sendDeliveryAssociatePhoneVerification = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    // throw new ApiError(400, "Phone number is required");
  }

  const deliveryAssociate = await DeliveryAssociate.findOne({ phone });
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate with this phone number not found");
  }

  const otp = deliveryAssociate.generatePhoneVerificationToken();
  await deliveryAssociate.save({ validateBeforeSave: false });

  try {
    await smsUtils.sendSMS(
      deliveryAssociate.phone,
      `Your FarmFerry verification code is: ${otp}`
    );
    return res.status(200).json(new ApiResponse(200, {}, "Verification OTP sent successfully"));
  } catch (error) {
    console.error("Error sending SMS:", error);
    // Clear OTP fields if SMS fails
    deliveryAssociate.phoneVerificationToken = undefined;
    deliveryAssociate.phoneVerificationTokenExpires = undefined;
    await deliveryAssociate.save({ validateBeforeSave: false });
    throw new ApiError(500, "Failed to send OTP. Please try again later.");
  }
});

// Verify Phone OTP
export const verifyPhoneOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw new ApiError(400, "Phone number and OTP are required");
  }

  // First try to find customer
  let customer = await Customer.findOne({
    phone,
    phoneOTP: otp,
    phoneOTPExpires: { $gt: Date.now() },
  });

  if (customer) {
    customer.isPhoneVerified = true;
    customer.phoneOTP = undefined;
    customer.phoneOTPExpires = undefined;
    await customer.save({ validateBeforeSave: false });

    return res.status(200).json(
      new ApiResponse(200, {
        user: customer,
        userType: "customer"
      }, "Phone number verified successfully")
    );
  }

  // If not customer, try delivery associate
  const deliveryAssociate = await DeliveryAssociate.findOne({
    phone,
    phoneVerificationToken: otp,
    phoneVerificationExpires: { $gt: Date.now() },
  });

  if (deliveryAssociate) {
    deliveryAssociate.isPhoneVerified = true;
    deliveryAssociate.phoneVerificationToken = undefined;
    deliveryAssociate.phoneVerificationExpires = undefined;
    await deliveryAssociate.save({ validateBeforeSave: false });

    return res.status(200).json(
      new ApiResponse(200, {
        user: deliveryAssociate,
        userType: "deliveryAssociate"
      }, "Phone number verified successfully")
    );
  }

  throw new ApiError(400, "Invalid OTP or OTP has expired");
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User not authenticated");
  }

  let user;
  let userType;

  // Try to find user in each collection
  user = await Customer.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  if (user) userType = "customer";
  if (!user) {
    user = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
    if (user) userType = "supplier";
  }
  if (!user) {
    user = await Admin.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
    if (user) userType = "admin";
  }
  if (!user) {
    user = await DeliveryAssociate.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
    if (user) userType = "deliveryAssociate";
  }

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(200, { user, userType }, "Current user fetched successfully")
  );
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "updateAccountDetails placeholder"));
});

export const updateUserAvatar = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "updateUserAvatar placeholder"));
});

export const updateUserCoverImage = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "updateUserCoverImage placeholder"));
});

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "getUserChannelProfile placeholder"));
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "getWatchHistory placeholder"));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  // Find supplier
  const supplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  // Verify password
  const isPasswordValid = await supplier.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  // Update last login
  supplier.lastLogin = new Date();
  await supplier.save();
  // Get supplier without sensitive fields
  const loggedInSupplier = await Supplier.findById(supplier._id).select("-password -passwordResetToken -passwordResetExpires");
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(supplier, res);
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInSupplier,
        accessToken,
        refreshToken
      },
      "Supplier logged in successfully"
    )
  );
});