import Coupon from "../models/coupon.model.js";
import Cart from "../models/cart.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create a new coupon (Admin only)
export const createCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    type,
    value,
    minPurchase,
    maxDiscount,
    startDate,
    endDate,
    usageLimit,
    description,
    applicableCategories,
    applicableProducts,
    userRestrictions,
    isActive
  } = req.body;

  // Check if coupon code already exists
  const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (existingCoupon) {
    throw new ApiError(400, "Coupon code already exists");
  }

  // Create coupon
  const coupon = await Coupon.create({
    code: code.toUpperCase(),
    type,
    value,
    minPurchase,
    maxDiscount,
    startDate,
    endDate,
    usageLimit,
    description,
    applicableCategories,
    applicableProducts,
    userRestrictions,
    isActive,
    createdBy: req.user._id
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { coupon }, "Coupon created successfully"));
});

// Get all coupons with pagination (Admin only)
export const getAllCoupons = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  
  // Add filters based on query parameters
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }
  
  if (req.query.type) {
    filter.type = req.query.type;
  }

  if (req.query.search) {
    filter.$or = [
      { code: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  const coupons = await Coupon.find(filter)
    .populate('createdBy', 'name email')
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Coupon.countDocuments(filter);

  return res
    .status(200)
    .json(new ApiResponse(200, {
      coupons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCoupons: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    }, "Coupons retrieved successfully"));
});

// Get active coupons (Customer accessible)
export const getActiveCoupons = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const coupons = await Coupon.findValidCoupons()
    .select('-createdBy -applicableCategories -applicableProducts')
    .sort({ value: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Coupon.countDocuments({
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
    $expr: { $lt: ["$usedCount", "$usageLimit"] }
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {
      coupons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCoupons: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    }, "Active coupons retrieved successfully"));
});

// Get coupon by ID
export const getCouponById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const coupon = await Coupon.findById(id)
    .populate('createdBy', 'name email')
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'name');

  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { coupon }, "Coupon retrieved successfully"));
});

// Get coupon by code
export const getCouponByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const coupon = await Coupon.findOne({ code: code.toUpperCase() })
    .select('-createdBy -applicableCategories -applicableProducts');

  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { coupon }, "Coupon retrieved successfully"));
});

// Update coupon (Admin only)
export const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if coupon exists
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  // If updating code, check for duplicates
  if (updateData.code && updateData.code.toUpperCase() !== coupon.code) {
    const existingCoupon = await Coupon.findOne({ 
      code: updateData.code.toUpperCase(),
      _id: { $ne: id }
    });
    if (existingCoupon) {
      throw new ApiError(400, "Coupon code already exists");
    }
    updateData.code = updateData.code.toUpperCase();
  }

  const updatedCoupon = await Coupon.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('createdBy', 'name email')
   .populate('applicableCategories', 'name')
   .populate('applicableProducts', 'name');

  return res
    .status(200)
    .json(new ApiResponse(200, { coupon: updatedCoupon }, "Coupon updated successfully"));
});

// Delete coupon (Admin only)
export const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  await Coupon.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Coupon deleted successfully"));
});

// Validate coupon
export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body;

  if (!code) {
    throw new ApiError(400, "Coupon code is required");
  }

  if (!cartTotal || cartTotal <= 0) {
    throw new ApiError(400, "Valid cart total is required");
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) {
    throw new ApiError(404, "Invalid coupon code");
  }

  const validation = coupon.canBeUsed(cartTotal, req.user._id);
  if (!validation.valid) {
    throw new ApiError(400, validation.message);
  }

  const discount = coupon.calculateDiscount(cartTotal);

  return res
    .status(200)
    .json(new ApiResponse(200, {
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description
      },
      discount,
      finalAmount: cartTotal - discount
    }, "Coupon validated successfully"));
});

// Apply coupon to cart
export const applyCouponToCart = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw new ApiError(400, "Coupon code is required");
  }

  // Find user's cart
  const cart = await Cart.findOne({ customer: req.user._id }).populate({
    path: 'items.product',
    select: 'name price discountedPrice'
  });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  // Find coupon
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) {
    throw new ApiError(404, "Invalid coupon code");
  }

  // Validate coupon
  const validation = coupon.canBeUsed(cart.subtotal, req.user._id);
  if (!validation.valid) {
    throw new ApiError(400, validation.message);
  }

  // Calculate discount
  const discount = coupon.calculateDiscount(cart.subtotal);

  // Update cart with coupon
  cart.coupon = {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount
  };
  cart.discount = discount;

  await cart.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { 
      cart: {
        ...cart.toObject(),
        finalAmount: cart.subtotal - discount
      }
    }, "Coupon applied successfully"));
});

// Remove coupon from cart
export const removeCouponFromCart = asyncHandler(async (req, res) => {
  // Find user's cart
  const cart = await Cart.findOne({ customer: req.user._id }).populate({
    path: 'items.product',
    select: 'name price discountedPrice'
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  // Remove coupon from cart
  cart.coupon = undefined;
  cart.discount = 0;

  await cart.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { cart }, "Coupon removed successfully"));
});

// Get coupon usage statistics (Admin only)
export const getCouponStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new ApiError(404, "Coupon not found");
  }

  const stats = {
    totalUsage: coupon.usedCount,
    remainingUsage: coupon.usageLimit - coupon.usedCount,
    usagePercentage: ((coupon.usedCount / coupon.usageLimit) * 100).toFixed(2),
    isActive: coupon.isActive,
    isValid: coupon.isValid,
    daysRemaining: Math.ceil((coupon.endDate - new Date()) / (1000 * 60 * 60 * 24))
  };

  return res
    .status(200)
    .json(new ApiResponse(200, { coupon, stats }, "Coupon statistics retrieved successfully"));
});
