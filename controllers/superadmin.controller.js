import SuperAdmin from '../models/superadmin.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

// Login SuperAdmin
export const loginSuperAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Find SuperAdmin by email
  const superadmin = await SuperAdmin.findOne({ email: email.toLowerCase() });
  
  if (!superadmin) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Check password
  const isPasswordValid = await superadmin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Update last login
  superadmin.lastLogin = new Date();
  await superadmin.save();

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(superadmin, res);

  // Remove password from response
  const loggedInSuperAdmin = await SuperAdmin.findById(superadmin._id).select("-password");

  return res.status(200).json(
    new ApiResponse(200, {
      superadmin: loggedInSuperAdmin,
      accessToken,
      refreshToken
    }, "SuperAdmin logged in successfully")
  );
});

// Get SuperAdmin Profile
export const getSuperAdminProfile = asyncHandler(async (req, res) => {
  const superadmin = await SuperAdmin.findById(req.user.id).select("-password");
  
  if (!superadmin) {
    throw new ApiError(404, "SuperAdmin not found");
  }

  return res.status(200).json(
    new ApiResponse(200, superadmin, "SuperAdmin profile retrieved successfully")
  );
});

// Update SuperAdmin Profile
export const updateSuperAdminProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, location, company } = req.body;

  const superadmin = await SuperAdmin.findById(req.user.id);
  
  if (!superadmin) {
    throw new ApiError(404, "SuperAdmin not found");
  }

  // Update fields
  if (name) superadmin.name = name;
  if (email) superadmin.email = email.toLowerCase();
  if (phone) superadmin.phone = phone;
  if (location) superadmin.location = location;
  if (company) superadmin.company = company;

  await superadmin.save();

  const updatedSuperAdmin = await SuperAdmin.findById(superadmin._id).select("-password");

  return res.status(200).json(
    new ApiResponse(200, updatedSuperAdmin, "SuperAdmin profile updated successfully")
  );
});

// Change SuperAdmin Password
export const changeSuperAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  const superadmin = await SuperAdmin.findById(req.user.id);
  
  if (!superadmin) {
    throw new ApiError(404, "SuperAdmin not found");
  }

  // Verify current password
  const isCurrentPasswordValid = await superadmin.isPasswordCorrect(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  // Update password
  superadmin.password = newPassword;
  await superadmin.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Password changed successfully")
  );
});

// Upload SuperAdmin Avatar
export const uploadSuperAdminAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar file is required");
  }

  const superadmin = await SuperAdmin.findById(req.user.id);
  
  if (!superadmin) {
    throw new ApiError(404, "SuperAdmin not found");
  }

  // Update avatar URL (assuming file is uploaded to public/uploads)
  const avatarUrl = `/uploads/${req.file.filename}`;
  superadmin.avatar = avatarUrl;
  await superadmin.save();

  // Return only the avatar path in the response
  return res.status(200).json(
    new ApiResponse(200, { avatar: avatarUrl }, "Avatar uploaded successfully")
  );
});

// Logout SuperAdmin
export const logoutSuperAdmin = asyncHandler(async (req, res) => {
  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res.status(200).json(
    new ApiResponse(200, {}, "SuperAdmin logged out successfully")
  );
}); 