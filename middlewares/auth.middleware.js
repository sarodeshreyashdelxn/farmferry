import jwt from "jsonwebtoken";
import Customer from "../models/customer.model.js";
import Supplier from "../models/supplier.model.js";
import Admin from "../models/admin.model.js";
import SuperAdmin from "../models/superadmin.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Verify JWT token and attach user to request
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // Get token from authorization header or cookies
    const token = req.cookies?.accessToken || 
                  req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized - No token provided");
    }

    // Verify token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'fallback_access_token_secret');

    // Find user based on token info
    let user;
    if (decodedToken.role === "superadmin") {
      user = await SuperAdmin.findById(decodedToken.id).select("-password");
    } else if (decodedToken.role === "admin") {
      user = await Admin.findById(decodedToken.id).select("-password");
    } else if (decodedToken.role === "supplier") {
      user = await Supplier.findById(decodedToken.id).select("-password");
    } else if (decodedToken.role === "deliveryAssociate") {
      const DeliveryAssociate = (await import("../models/deliveryAssociate.model.js")).default;
      user = await DeliveryAssociate.findById(decodedToken.id).select("-password -passwordResetToken -passwordResetExpires");
    } else {
      user = await Customer.findById(decodedToken.id).select("-password");
    }

    if (!user) {
      throw new ApiError(401, "Invalid token - User not found");
    }

    // Attach user and role to request object
    req.user = user;
    req.role = decodedToken.role;
    
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid token");
    }
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Token expired");
    }
    throw new ApiError(401, error.message || "Invalid token");
  }
});

/**
 * Check if user has required role
 * @param  {...string} roles - Allowed roles
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      throw new ApiError(
        403, 
        `Role: ${req.role} is not allowed to access this resource`
      );
    }
    next();
  };
};

/**
 * Check if supplier is verified
 */
export const isVerifiedSupplier = asyncHandler(async (req, res, next) => {
  if (req.role !== "supplier") {
    return next();
  }
  
  if (req.user.status !== "approved") {
    throw new ApiError(403, "Your account is not verified yet. Please wait for admin approval.");
  }
  
  next();
});
