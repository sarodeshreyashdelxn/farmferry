import Review from "../models/review.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";

// Create a review
export const createReview = asyncHandler(async (req, res) => {
  const { productId, orderId, rating, title, comment } = req.body;
  
  // Validate required fields
  if (!productId || !rating) {
    throw new ApiError(400, "Product ID and rating are required");
  }
  
  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  
  // If order ID is provided, verify that the customer has purchased this product
  if (orderId) {
    const order = await Order.findOne({
      _id: orderId,
      customer: req.user._id,
      status: "delivered",
      "items.product": productId
    });
    
    if (!order) {
      throw new ApiError(400, "You can only review products you have purchased and received");
    }
  }
  
  // Check if customer has already reviewed this product
  const existingReview = await Review.findOne({
    product: productId,
    customer: req.user._id
  });
  
  if (existingReview) {
    throw new ApiError(400, "You have already reviewed this product");
  }
  
  // Create review object
  const reviewData = {
    product: productId,
    customer: req.user._id,
    rating: Number(rating),
    title,
    comment,
    images: [],
    isVerified: !!orderId // Verify review if order ID is provided
  };
  
  // Add order ID if provided
  if (orderId) {
    reviewData.order = orderId;
  }
  
  // Handle image uploads
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.path, "reviews")
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    const successfulUploads = uploadResults.filter(result => result);
    
    // Add successful uploads to review images
    reviewData.images = successfulUploads.map(result => ({
      url: result.secure_url,
      publicId: result.public_id
    }));
  }
  
  // Create review
  const review = await Review.create(reviewData);
  
  // Populate customer details
  await review.populate("customer", "firstName lastName profileImage");
  
  return res.status(201).json(
    new ApiResponse(
      201,
      { review },
      "Review submitted successfully"
    )
  );
});

// Get product reviews
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, sort = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;
  
  // Validate product ID
  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  
  // Build query
  const query = {
    product: productId,
    isVisible: true
  };
  
  // Filter by rating if provided
  if (rating) {
    query.rating = Number(rating);
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  if (sort === "helpful") {
    sortOptions.helpfulCount = order === "asc" ? 1 : -1;
  } else {
    sortOptions[sort] = order === "asc" ? 1 : -1;
  }
  
  // Get reviews with pagination
  const reviews = await Review.find(query)
    .populate("customer", "firstName lastName profileImage")
    .populate("customerReply.customer", "firstName lastName profileImage")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalReviews = await Review.countDocuments(query);
  
  // Get rating distribution
  const ratingDistribution = await Review.aggregate([
    { $match: { product: product._id, isVisible: true } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
  
  // Format rating distribution
  const distribution = {
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0
  };
  
  ratingDistribution.forEach(item => {
    distribution[item._id] = item.count;
  });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        reviews,
        pagination: {
          total: totalReviews,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalReviews / parseInt(limit))
        },
        summary: {
          averageRating: product.averageRating,
          totalReviews: product.totalReviews,
          distribution
        }
      },
      "Product reviews fetched successfully"
    )
  );
});

// Update review
export const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, title, comment } = req.body;
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Check if user is the author of this review
  if (review.customer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this review");
  }
  
  // Update fields if provided
  if (rating) {
    if (rating < 1 || rating > 5) {
      throw new ApiError(400, "Rating must be between 1 and 5");
    }
    review.rating = Number(rating);
  }
  
  if (title !== undefined) review.title = title;
  if (comment !== undefined) review.comment = comment;
  
  // Handle image uploads
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.path, "reviews")
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    const successfulUploads = uploadResults.filter(result => result);
    
    // Add successful uploads to review images
    const newImages = successfulUploads.map(result => ({
      url: result.secure_url,
      publicId: result.public_id
    }));
    
    review.images = [...review.images, ...newImages];
  }
  
  // Save review
  await review.save();
  
  // Populate customer details
  await review.populate("customer", "firstName lastName profileImage");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      "Review updated successfully"
    )
  );
});

// Delete review
export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Check if user is the author of this review or an admin
  const isAuthor = review.customer.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  
  if (!isAuthor && !isAdmin) {
    throw new ApiError(403, "You are not authorized to delete this review");
  }
  
  // Delete review images from cloudinary
  if (review.images && review.images.length > 0) {
    const deletePromises = review.images.map(image => 
      deleteFromCloudinary(image.publicId)
    );
    
    await Promise.all(deletePromises);
  }
  
  // Delete review
  await Review.findByIdAndDelete(id);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Review deleted successfully"
    )
  );
});

// Delete review image
export const deleteReviewImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.params;
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Check if user is the author of this review
  if (review.customer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this review");
  }
  
  // Find image
  const imageIndex = review.images.findIndex(img => img._id.toString() === imageId);
  
  if (imageIndex === -1) {
    throw new ApiError(404, "Image not found");
  }
  
  // Delete image from cloudinary
  await deleteFromCloudinary(review.images[imageIndex].publicId);
  
  // Remove image from review
  review.images.splice(imageIndex, 1);
  
  // Save review
  await review.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { images: review.images },
      "Review image deleted successfully"
    )
  );
});

// Mark review as helpful
export const markReviewAsHelpful = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Increment helpful count
  review.helpfulCount += 1;
  
  // Save review
  await review.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { helpfulCount: review.helpfulCount },
      "Review marked as helpful"
    )
  );
});

// Report review
export const reportReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!reason) {
    throw new ApiError(400, "Reason is required");
  }
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Increment report count
  review.reportCount += 1;
  
  // If report count exceeds threshold, hide review
  if (review.reportCount >= 5) {
    review.isVisible = false;
  }
  
  // Save review
  await review.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Review reported successfully"
    )
  );
});

// Admin: Toggle review visibility
export const toggleReviewVisibility = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isVisible } = req.body;
  
  if (isVisible === undefined) {
    throw new ApiError(400, "Visibility status is required");
  }
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Update visibility
  review.isVisible = isVisible;
  
  // Save review
  await review.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      `Review ${isVisible ? 'visible' : 'hidden'} successfully`
    )
  );
});

// Supplier: Reply to review
export const replyToReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  if (!content) {
    throw new ApiError(400, "Reply content is required");
  }
  
  // Find review
  const review = await Review.findById(id).populate("product");
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Check if user is the supplier of the product or an admin
  const isSupplier = 
    req.user.role === "supplier" && 
    review.product.supplierId.toString() === req.user._id.toString();
  
  const isAdmin = req.user.role === "admin";
  
  if (!isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to reply to this review");
  }
  
  // Add reply
  review.reply = {
    content,
    createdAt: new Date(),
    createdBy: req.user._id,
    createdByModel: req.user.role === "supplier" ? "Supplier" : "Admin"
  };
  
  // Save review
  await review.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      "Reply added successfully"
    )
  );
});

// Customer: Reply to admin/seller response
export const addCustomerReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  if (!content) {
    throw new ApiError(400, "Reply content is required");
  }
  
  // Find review
  const review = await Review.findById(id);
  
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  
  // Check if user is the author of this review
  if (review.customer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only reply to responses on your own reviews");
  }
  
  // Check if there's already a seller reply
  if (!review.reply) {
    throw new ApiError(400, "You can only reply to seller responses");
  }
  
  // Check if customer has already replied
  if (review.customerReply) {
    throw new ApiError(400, "You have already replied to this response");
  }
  
  // Add customer reply
  review.customerReply = {
    content,
    createdAt: new Date(),
    customer: req.user._id
  };
  
  // Save review
  await review.save();
  
  // Populate customer details
  await review.populate("customer", "firstName lastName profileImage");
  await review.populate("customerReply.customer", "firstName lastName profileImage");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { review },
      "Customer reply added successfully"
    )
  );
});
