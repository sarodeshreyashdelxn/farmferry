import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";

// Create a new product
export const createProduct = asyncHandler(async (req, res) => {
  console.log('DEBUG createProduct req.files:', req.files);
  console.log('DEBUG createProduct req.body:', req.body);
  const { 
    name, 
    description, 
    price, 
    gst,
    stockQuantity, 
    categoryId, 
    unit, 
    discountedPrice,
    sku,
    barcode,
    expiryDate,
    manufactureDate,
    variations
  } = req.body;
  
  // Validate required fields
  if (!name || !price || !stockQuantity || !categoryId) {
    throw new ApiError(400, "Name, price, stock quantity, and category are required");
  }
  
  // Check if category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, "Category not found");
  }
  
  // Create product object
  const productData = {
    supplierId: req.user._id,
    categoryId,
    name,
    description,
    price: Number(price),
    gst: gst ? Number(gst) : 0,
    stockQuantity: Number(stockQuantity),
    unit: unit || "kg",
    images: []
  };
  
  // Add optional fields if provided
  if (discountedPrice) productData.discountedPrice = Number(discountedPrice);
  if (sku) productData.sku = sku;
  if (barcode) productData.barcode = barcode;
  if (expiryDate) productData.expiryDate = new Date(expiryDate);
  if (manufactureDate) productData.manufactureDate = new Date(manufactureDate);
  
  // Add variations if provided
  if (variations && Array.isArray(variations)) {
    try {
      productData.variations = JSON.parse(variations);
    } catch (error) {
      // If parsing fails, assume it's already an array
      productData.variations = variations;
    }
  }
  
  // Handle image uploads
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file, "products")
    );
    const uploadResults = await Promise.all(uploadPromises);
    console.log('Cloudinary upload results:', uploadResults);

    // Filter out failed uploads
    let successfulUploads = uploadResults.filter(result => result && result.url);
    console.log('Successful uploads:', successfulUploads);

    // Fallback: If Cloudinary upload fails, use local file path (for dev only)
    if (successfulUploads.length === 0 && req.files.length > 0) {
      successfulUploads = req.files.map(file => ({
        url: file.path, // or use a public URL if you serve /public/uploads
        publicId: file.filename
      }));
      console.log('Fallback to local file paths:', successfulUploads);
    }

    if (successfulUploads.length === 0) {
      throw new ApiError(500, "Failed to upload product images");
    }

    // Add successful uploads to product images
    productData.images = successfulUploads.map(result => ({
      url: result.url,
      publicId: result.publicId || result.public_id
    }));
  }
  
  // Create product
  const product = await Product.create(productData);
  
  return res.status(201).json(
    new ApiResponse(
      201,
      { product },
      "Product created successfully"
    )
  );
});

// Get all products
export const getAllProducts = asyncHandler(async (req, res) => {
  const { 
    search, 
    category, 
    supplier, 
    minPrice, 
    maxPrice, 
    inStock,
    featured,
    trending,
    hasActiveOffer,
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = { isActive: true };
  
  // Search by name
  if (search) {
    queryOptions.name = { $regex: search, $options: "i" };
  }
  
  // Filter by category
  if (category) {
    queryOptions.categoryId = category;
  }
  
  // Filter by supplier
  if (supplier) {
    queryOptions.supplierId = supplier;
  }
  
  // Filter by price range
  if (minPrice || maxPrice) {
    queryOptions.price = {};
    if (minPrice) queryOptions.price.$gte = Number(minPrice);
    if (maxPrice) queryOptions.price.$lte = Number(maxPrice);
  }
  
  // Filter by stock
  if (inStock === "true") {
    queryOptions.stockQuantity = { $gt: 0 };
  }
  
  // Filter by featured
  if (featured === "true") {
    queryOptions.isFeatured = true;
  }
  
  // Filter by trending
  if (trending === "true") {
    queryOptions.isTrending = true;
  }
  
  // Filter by active offers
  if (hasActiveOffer === "true") {
    queryOptions.hasActiveOffer = true;
    queryOptions.offerPercentage = { $gt: 0 }; // Ensure offer percentage is greater than 0
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  
  // Handle special sort cases
  if (sort === "price" && order === "asc") {
    sortOptions.price = 1;
  } else if (sort === "price" && order === "desc") {
    sortOptions.price = -1;
  } else if (sort === "rating") {
    sortOptions.averageRating = order === "asc" ? 1 : -1;
  } else {
    // Default sort
    sortOptions[sort] = order === "asc" ? 1 : -1;
  }
  
  // Get products with pagination
  const products = await Product.find(queryOptions)
    .populate("categoryId", "name")
    .populate("supplierId", "businessName")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalProducts = await Product.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products,
        pagination: {
          total: totalProducts,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalProducts / parseInt(limit))
        }
      },
      "Products fetched successfully"
    )
  );
});

// Get product by ID
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const product = await Product.findById(id)
    .populate("categoryId", "name")
    .populate("supplierId", "businessName logo");
  
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { product },
      "Product fetched successfully"
    )
  );
});

// Update product
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    description, 
    price, 
    gst,
    stockQuantity, 
    categoryId, 
    unit, 
    discountedPrice,
    sku,
    barcode,
    expiryDate,
    manufactureDate,
    variations,
    isActive,
    isFeatured,
    isTrending
  } = req.body;
  
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ status: 'error', message: 'Product not found' });
  }
  
  // Check if user is the supplier of this product
  if (product.supplierId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not the owner of this product and cannot update it.");
  }
  
  // Check if category exists if provided
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }
  }
  
  // Update fields if provided
  if (name) product.name = name;
  if (description) product.description = description;
  if (price) product.price = Number(price);
  if (gst !== undefined) product.gst = Number(gst);
  if (stockQuantity) product.stockQuantity = Number(stockQuantity);
  if (categoryId) product.categoryId = categoryId;
  if (unit) product.unit = unit;
  if (discountedPrice) product.discountedPrice = Number(discountedPrice);
  if (sku) product.sku = sku;
  if (barcode) product.barcode = barcode;
  if (expiryDate) product.expiryDate = new Date(expiryDate);
  if (manufactureDate) product.manufactureDate = new Date(manufactureDate);
  if (isActive !== undefined) product.isActive = isActive === "true";
  if (isFeatured !== undefined) product.isFeatured = isFeatured === "true";
  if (isTrending !== undefined) product.isTrending = isTrending === "true";
  
  // Update variations if provided
  if (variations) {
    try {
      product.variations = JSON.parse(variations);
    } catch (error) {
      // If parsing fails, assume it's already an array
      product.variations = variations;
    }
  }
  
  // Handle image uploads
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file, "products")
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    const successfulUploads = uploadResults.filter(result => result);
    
    if (successfulUploads.length === 0 && req.files.length > 0) {
      throw new ApiError(500, "Failed to upload product images");
    }
    
    // Add successful uploads to product images
    const newImages = successfulUploads.map(result => ({
      url: result.secure_url,
      publicId: result.public_id
    }));
    
    product.images = [...product.images, ...newImages];
  }
  
  // Save product
  await product.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { product },
      "Product updated successfully"
    )
  );
});

// Delete product image
export const deleteProductImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.params;
  
  // Find product
  const product = await Product.findById(id);
  
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  
  // Check if user is the supplier of this product
  if (product.supplierId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this product");
  }
  
  // Find image
  const imageIndex = product.images.findIndex(img => img._id.toString() === imageId);
  
  if (imageIndex === -1) {
    throw new ApiError(404, "Image not found");
  }
  
  // Delete image from cloudinary
  await deleteFromCloudinary(product.images[imageIndex].publicId);
  
  // Remove image from product
  product.images.splice(imageIndex, 1);
  
  // Save product
  await product.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { images: product.images },
      "Product image deleted successfully"
    )
  );
});

// Delete product
export const deleteProduct = asyncHandler(async (req, res) => {
  console.log('DELETE PRODUCT: role:', req.role, 'user:', req.user && req.user._id);
  const { id } = req.params;
  
  // Find product
  const product = await Product.findById(id);
  
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  
  // Allow admin to delete any product, supplier can only delete their own
  if (req.role !== 'admin' && product.supplierId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this product");
  }
  
  // Delete all product images from cloudinary
  const deletePromises = product.images.map(image => 
    deleteFromCloudinary(image.publicId)
  );
  
  await Promise.all(deletePromises);
  
  // Delete product
  await Product.findByIdAndDelete(id);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Product deleted successfully"
    )
  );
});

export const getMyProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get products with pagination
  const products = await Product.find({ supplierId: req.user._id })
    .populate("categoryId", "name")
    .populate("supplierId", "businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalProducts = await Product.countDocuments({ supplierId: req.user._id });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products,
        pagination: {
          total: totalProducts,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalProducts / parseInt(limit))
        }
      },
      "Products fetched successfully"
    )
  );
});

export const getProductsBySupplier = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get products with pagination
  const products = await Product.find({ supplierId })
    .populate("categoryId", "name")
    .populate("supplierId", "businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalProducts = await Product.countDocuments({ supplierId });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products,
        pagination: {
          total: totalProducts,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalProducts / parseInt(limit))
        }
      },
      "Products fetched successfully"
    )
  );
});

// Add offer to product
export const addOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { offerPercentage, offerStartDate, offerEndDate } = req.body;
  
  // Validate required fields
  if (!offerPercentage) {
    throw new ApiError(400, "Offer percentage is required");
  }
  
  // Validate offer percentage range (0-100)
  const percentage = Number(offerPercentage);
  if (isNaN(percentage) || percentage < 0 || percentage > 100) {
    throw new ApiError(400, "Offer percentage must be between 0 and 100");
  }
  
  // Find product
  const product = await Product.findById(id);
  
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  
  // Check if user is the supplier of this product
  if (product.supplierId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to add offers to this product");
  }
  
  // Validate dates if provided
  let startDate = null;
  let endDate = null;
  
  if (offerStartDate) {
    startDate = new Date(offerStartDate);
    if (isNaN(startDate.getTime())) {
      throw new ApiError(400, "Invalid offer start date");
    }
  }
  
  if (offerEndDate) {
    endDate = new Date(offerEndDate);
    if (isNaN(endDate.getTime())) {
      throw new ApiError(400, "Invalid offer end date");
    }
  }
  
  // Check if end date is after start date
  if (startDate && endDate && endDate <= startDate) {
    throw new ApiError(400, "Offer end date must be after start date");
  }
  
  // Calculate discounted price
  const discountedPrice = product.price - (product.price * percentage / 100);
  
  // Update product with offer details
  product.offerPercentage = percentage;
  product.discountedPrice = Math.round(discountedPrice * 100) / 100; // Round to 2 decimal places
  product.offerStartDate = startDate;
  product.offerEndDate = endDate;
  product.hasActiveOffer = true;
  
  // Save product
  await product.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        product: {
          _id: product._id,
          name: product.name,
          originalPrice: product.price,
          offerPercentage: product.offerPercentage,
          discountedPrice: product.discountedPrice,
          offerStartDate: product.offerStartDate,
          offerEndDate: product.offerEndDate,
          hasActiveOffer: product.hasActiveOffer
        }
      },
      "Offer added successfully"
    )
  );
});


