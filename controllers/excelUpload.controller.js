import ExcelJS from 'exceljs';
import Product from '../models/product.model.js';
import PreviewProduct from '../models/previewProduct.model.js';
import Category from '../models/category.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateProductTemplate, parseExcelFile } from '../utils/excelUtils.js';
import { processProductImages } from '../utils/imageUtils.js';
import mongoose from 'mongoose';
import { validateProductData} from '../utils/uploadValidation.js';
import { processProductsInBatches}  from '../services/product.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
// import Category from '../models/category.model.js';
// import validateExcelStructure}
// Generate Excel template
export const generateTemplate = asyncHandler(async (req, res) => {
  const { supplierId, type } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to access this supplier's template");
  }
  
  // Validate type parameter
  if (!['new', 'old'].includes(type)) {
    throw new ApiError(400, "Type must be 'new' or 'old'");
  }
  
  try {
    // Generate template using utility function
    const workbook = await generateProductTemplate(type, supplierId);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-products-template-${supplierId}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    // Use ApiError to ensure proper formatting for your error handler
    throw new ApiError(500, `Failed to generate template: ${error.message}`);
  }
});

// Parse uploaded Excel file
// Parse uploaded Excel file (continued from previous)
export const parseExcelUpload = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;

  // ✅ Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to upload products for this supplier");
  }

  if (!req.file) {
    throw new ApiError(400, "Excel file is required");
  }

  // ✅ Validate file type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    throw new ApiError(400, "Only Excel files (.xlsx) are allowed");
  }

  try {
    // ✅ Parse Excel
    const products = await parseExcelFile(req.file.buffer);

    if (products.length === 0) {
      throw new ApiError(400, "Excel file contains no product data");
    }

    // ✅ Clear previous previews for this supplier
    await PreviewProduct.deleteMany({ supplierId });

    const previewProducts = [];
    let validCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;

    // ✅ Process each product row
    for (const productData of products) {
      // 🔥 Skip instruction or empty rows
      if (
        (!productData.name || productData.name.toLowerCase().includes('instruction')) &&
        !productData.price &&
        !productData.categoryId &&
        !productData.categoryName
      ) {
        console.log(`Skipping row ${productData.excelRowIndex} → instruction/empty row`);
        skippedCount++;
        continue;
      }

      try {
        // Validate
        const { errors, validatedData } = await validateProductData(productData, supplierId);
        console.log("validatedData:", validatedData);

        // ✅ Check if images were provided in Excel (handle both string and array)
        const hasCustomImages = Array.isArray(productData.images) && productData.images.length > 0 ||
                               typeof productData.images === 'string' && productData.images.trim() !== '';

        let images = [];
        
        // ✅ ONLY process images if supplier explicitly provided them in Excel
        if (hasCustomImages && errors.length === 0) {
          try {
            images = await processProductImages(
              productData.images,
              !!validatedData._id,
              validatedData._id,
              validatedData.categoryId
            );
            console.log(`✅ Processed ${images.length} custom images for product: ${validatedData.name}`);
          } catch (imageError) {
            console.error(`❌ Image processing failed for ${validatedData.name}:`, imageError.message);
            // ✅ Add error but DON'T assign any fallback images
            errors.push(`Failed to process images: ${imageError.message}`);
          }
        }
        // ✅ NO else blocks - no category images, no default images

        // ✅ Build previewProduct
        const isUpdate = !!validatedData._id && mongoose.Types.ObjectId.isValid(validatedData._id);
        const previewProduct = {
          supplierId,
          name: validatedData.name,
          description: validatedData.description || '',
          price: validatedData.price,
          gst: validatedData.gst || 0,
          stockQuantity: validatedData.stockQuantity,
          unit: validatedData.unit || 'kg',
          categoryId: validatedData.categoryId || null,
          categoryName: validatedData.categoryName || '',
          images, // ✅ Will be empty array if no images provided by supplier
          excelRowIndex: validatedData.excelRowIndex,
          isUpdate,
          originalProductId: isUpdate ? validatedData._id : null,
          validationErrors: errors,
          status: errors.length === 0 ? 'valid' : 'invalid',
          hasCustomImage: hasCustomImages
        };

        previewProducts.push(previewProduct);

        if (errors.length === 0) validCount++;
        else invalidCount++;

      } catch (error) {
        console.error(`❌ Unexpected error processing product ${productData.name}:`, error);
        
        const previewProduct = {
          supplierId,
          name: productData.name || 'Unknown Product',
          description: productData.description || '',
          price: productData.price || 0,
          gst: productData.gst || 0,
          stockQuantity: productData.stockQuantity || 0,
          unit: productData.unit || 'kg',
          excelRowIndex: productData.excelRowIndex,
          images: [], // ✅ Empty array - no images assigned
          isUpdate: false,
          validationErrors: [`Unexpected error: ${error.message}`],
          status: 'invalid',
          hasCustomImage: false
        };
        previewProducts.push(previewProduct);
        invalidCount++;
      }
    }

    // ✅ Insert preview products in batches
    const batchSize = 100;
    for (let i = 0; i < previewProducts.length; i += batchSize) {
      const batch = previewProducts.slice(i, i + batchSize);
      await PreviewProduct.insertMany(batch);
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          processedRows: previewProducts.length,
          validRows: validCount,
          invalidRows: invalidCount,
          skippedRows: skippedCount,
          hasInvalidRows: invalidCount > 0
        },
        "Excel file processed successfully"
      )
    );

  } catch (error) {
    if (error.message.includes("Excel file must contain")) {
      throw new ApiError(400, error.message);
    }
    throw new ApiError(500, `Failed to process Excel file: ${error.message}`);
  }
});


// Get preview products
export const getPreviewProducts = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const { page = 1, limit = 50, status, sortBy = 'excelRowIndex', sortOrder = 'asc' } = req.query;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to view this supplier's preview products");
  }
  
  // Validate pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, "Limit must be a positive integer between 1 and 100");
  }
  
  // Validate sort parameters
  const validSortFields = ['excelRowIndex', 'name', 'price', 'status', 'createdAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'excelRowIndex';
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  
  // Build query
  const query = { supplierId };
  if (status && ['valid', 'invalid', 'pending'].includes(status)) {
    query.status = status;
  }
  
  // Calculate pagination
  const skip = (pageNum - 1) * limitNum;
  
  // Get preview products with pagination
  const previewProducts = await PreviewProduct.find(query)
    // .sort({ [sortField]: sortDirection })
    // .skip(skip)
    // .limit(limitNum);
  
    console.log("Preview Products:", previewProducts);
  // Get total count
  const totalProducts = await PreviewProduct.countDocuments(query);
  
  // Get counts by status
  const validCount = await PreviewProduct.countDocuments({ ...query, status: 'valid' });
  const invalidCount = await PreviewProduct.countDocuments({ ...query, status: 'invalid' });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        previewProducts,
        counts: {
          valid: validCount,
          invalid: invalidCount,
          total: totalProducts
        },
        pagination: {
          total: totalProducts,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalProducts / limitNum)
        }
      },
      "Preview products fetched successfully"
    )
  );
});

// Confirm upload and save products
export const confirmUpload = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const { processInvalid = false, batchSize = 50 } = req.body;

  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to confirm upload for this supplier");
  }

  const validatedBatchSize = Math.min(Math.max(parseInt(batchSize) || 50, 10), 200);

  try {
    const results = await processProductsInBatches(supplierId, processInvalid, validatedBatchSize);

    if (results.failed > 0) {
      console.error("Failed products:", results.errors); // 🔹 log detailed errors
    }

    const message =
      results.failed > 0
        ? "Products processed with some errors"
        : "Products processed successfully";

    return res.status(200).json(
      new ApiResponse(
        200,
        { results, failedProducts: results.errors },
        message
      )
    );
  } catch (error) {
    console.error("Confirm upload error:", error);
    throw new ApiError(500, `Failed to confirm upload: ${error.message}`);
  }
});


// Delete preview products
export const deletePreviewProducts = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to delete preview products for this supplier");
  }
  
  const result = await PreviewProduct.deleteMany({ supplierId });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { deletedCount: result.deletedCount },
      "Preview products cleared successfully"
    )
  );
});

// Get upload status and statistics
export const getUploadStatus = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to view upload status for this supplier");
  }
  
  // Get counts by status
  const validCount = await PreviewProduct.countDocuments({ supplierId, status: 'valid' });
  const invalidCount = await PreviewProduct.countDocuments({ supplierId, status: 'invalid' });
  const totalCount = await PreviewProduct.countDocuments({ supplierId });
  
  // Get latest upload timestamp
  const latestUpload = await PreviewProduct.findOne({ supplierId })
    .sort({ createdAt: -1 })
    .select('createdAt');
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        stats: {
          valid: validCount,
          invalid: invalidCount,
          total: totalCount,
          hasData: totalCount > 0
        },
        lastUpload: latestUpload?.createdAt || null
      },
      "Upload status fetched successfully"
    )
  );
});

// Update individual preview product
export const updatePreviewProduct = asyncHandler(async (req, res) => {
  const { supplierId, previewProductId } = req.params;
  const updates = req.body;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to update preview products for this supplier");
  }
  
  // Find the preview product
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId
  });
  
  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found");
  }
  
  // Validate updates
  const allowedUpdates = ['name', 'description', 'price', 'gst', 'stockQuantity', 'unit', 'categoryId', 'categoryName', 'images'];
  const isValidOperation = Object.keys(updates).every(update => allowedUpdates.includes(update));
  
  if (!isValidOperation) {
    throw new ApiError(400, "Invalid updates! Only allowed fields: " + allowedUpdates.join(', '));
  }
  
  // Apply updates
  Object.keys(updates).forEach(update => {
    previewProduct[update] = updates[update];
  });
  
  // Revalidate the product
  const { errors } = await validateProductData(
    {
      name: previewProduct.name,
      description: previewProduct.description,
      price: previewProduct.price,
      gst: previewProduct.gst,
      stockQuantity: previewProduct.stockQuantity,
      unit: previewProduct.unit,
      categoryId: previewProduct.categoryId,
      categoryName: previewProduct.categoryName,
      _id: previewProduct.originalProductId
    },
    supplierId
  );
  
  // Update validation status
  previewProduct.validationErrors = errors;
  previewProduct.status = errors.length === 0 ? 'valid' : 'invalid';
  
  // Save the updated preview product
  await previewProduct.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { previewProduct },
      "Preview product updated successfully"
    )
  );
});


// Upload image for preview product
export const uploadPreviewProductImage = asyncHandler(async (req, res) => {
  console.log('DEBUG uploadPreviewProductImage req.file:', req.file);
  console.log('DEBUG uploadPreviewProductImage req.params:', req.params);
  console.log('DEBUG uploadPreviewProductImage req.body:', req.body);

  const { supplierId, previewProductId } = req.params;
  
  // Validate required parameters
  if (!supplierId || !previewProductId) {
    throw new ApiError(400, "Supplier ID and Preview Product ID are required");
  }

  // Validate file exists
  if (!req.file) {
    throw new ApiError(400, "Image file is required");
  }

  // Check if preview product exists and belongs to the supplier
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId: supplierId
  });

  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found or access denied");
  }

  try {
    // Upload image to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, "preview-products");
    console.log('Cloudinary upload result:', uploadResult);

    if (!uploadResult || !uploadResult.url) {
      throw new ApiError(500, "Failed to upload image to Cloudinary");
    }

    // Create image object
    const newImage = {
      url: uploadResult.url,
      publicId: uploadResult.publicId || uploadResult.public_id,
      isMain: previewProduct.images.length === 0 // Set as main if it's the first image
    };

    // If there are existing images, set isMain to false for all and add new one as main
    let updatedImages = [];
    
    if (previewProduct.images.length > 0) {
      // Set all existing images to not main
      updatedImages = previewProduct.images.map(img => ({
        ...img.toObject ? img.toObject() : img,
        isMain: false
      }));
    }
    
    // Add new image as main
    updatedImages.unshift(newImage);

    // Update preview product with new image
    const updatedProduct = await PreviewProduct.findByIdAndUpdate(
      previewProductId,
      {
        $set: { images: updatedImages }
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!updatedProduct) {
      // If update fails, delete the uploaded image from Cloudinary
      if (uploadResult.publicId) {
        await deleteFromCloudinary(uploadResult.publicId);
      }
      throw new ApiError(500, "Failed to update preview product with image");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { 
          previewProduct: updatedProduct,
          image: newImage
        },
        "Image uploaded successfully"
      )
    );

  } catch (error) {
    console.error('Image upload error:', error);
    
    // Clean up: Delete from Cloudinary if upload failed after file was uploaded
    if (req.file && error.message.includes('Cloudinary')) {
      try {
        // You might need to extract publicId from the error or uploadResult
        // This is a fallback cleanup attempt
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    
    throw new ApiError(500, error.message || "Image upload failed");
  }
});

// Upload multiple images for preview product
export const uploadMultiplePreviewProductImages = asyncHandler(async (req, res) => {
  console.log('DEBUG uploadMultiplePreviewProductImages req.files:', req.files);
  console.log('DEBUG uploadMultiplePreviewProductImages req.params:', req.params);

  const { supplierId, previewProductId } = req.params;
  
  // Validate required parameters
  if (!supplierId || !previewProductId) {
    throw new ApiError(400, "Supplier ID and Preview Product ID are required");
  }

  // Validate files exist
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "At least one image file is required");
  }

  // Check if preview product exists and belongs to the supplier
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId: supplierId
  });

  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found or access denied");
  }

  try {
    // Upload all images to Cloudinary
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file, "preview-products")
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    console.log('Cloudinary upload results:', uploadResults);

    // Filter out failed uploads
    const successfulUploads = uploadResults.filter(result => result && result.url);
    console.log('Successful uploads:', successfulUploads);

    if (successfulUploads.length === 0) {
      throw new ApiError(500, "Failed to upload any images to Cloudinary");
    }

    // Create image objects
    const newImages = successfulUploads.map((result, index) => ({
      url: result.url,
      publicId: result.publicId || result.public_id,
      isMain: previewProduct.images.length === 0 && index === 0 // Set first as main if no existing images
    }));

    // Prepare updated images array
    let updatedImages = [...previewProduct.images];
    
    // If adding first images, set the first one as main
    if (updatedImages.length === 0 && newImages.length > 0) {
      newImages[0].isMain = true;
    }
    
    // Add new images to the beginning
    updatedImages = [...newImages, ...updatedImages];

    // Update preview product with new images
    const updatedProduct = await PreviewProduct.findByIdAndUpdate(
      previewProductId,
      {
        $set: { images: updatedImages }
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!updatedProduct) {
      // If update fails, delete all uploaded images from Cloudinary
      const deletePromises = successfulUploads
        .filter(img => img.publicId)
        .map(img => deleteFromCloudinary(img.publicId));
      
      await Promise.allSettled(deletePromises);
      throw new ApiError(500, "Failed to update preview product with images");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { 
          previewProduct: updatedProduct,
          uploadedImages: newImages,
          totalImages: updatedImages.length
        },
        `${successfulUploads.length} image(s) uploaded successfully`
      )
    );

  } catch (error) {
    console.error('Multiple images upload error:', error);
    throw new ApiError(500, error.message || "Multiple images upload failed");
  }
});

// Set main image for preview product
export const setMainPreviewProductImage = asyncHandler(async (req, res) => {
  console.log('DEBUG setMainPreviewProductImage req.params:', req.params);
  console.log('DEBUG setMainPreviewProductImage req.body:', req.body);

  const { supplierId, previewProductId, imageId } = req.params;
  
  // Validate required parameters
  if (!supplierId || !previewProductId || !imageId) {
    throw new ApiError(400, "Supplier ID, Preview Product ID, and Image ID are required");
  }

  // Check if preview product exists and belongs to the supplier
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId: supplierId
  });

  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found or access denied");
  }

  // Check if image exists in product
  const imageExists = previewProduct.images.some(img => 
    img._id.toString() === imageId || img.publicId === imageId
  );

  if (!imageExists) {
    throw new ApiError(404, "Image not found in this product");
  }

  // Update all images: set the specified one as main, others as not main
  const updatedImages = previewProduct.images.map(img => ({
    ...img.toObject ? img.toObject() : img,
    isMain: (img._id.toString() === imageId || img.publicId === imageId)
  }));

  const updatedProduct = await PreviewProduct.findByIdAndUpdate(
    previewProductId,
    {
      $set: { images: updatedImages }
    },
    { 
      new: true, 
      runValidators: true 
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        previewProduct: updatedProduct,
        mainImage: updatedImages.find(img => img.isMain)
      },
      "Main image set successfully"
    )
  );
});

// Delete image from preview product
export const deletePreviewProductImage = asyncHandler(async (req, res) => {
  console.log('DEBUG deletePreviewProductImage req.params:', req.params);

  const { supplierId, previewProductId, imageId } = req.params;
  
  // Validate required parameters
  if (!supplierId || !previewProductId || !imageId) {
    throw new ApiError(400, "Supplier ID, Preview Product ID, and Image ID are required");
  }

  // Check if preview product exists and belongs to the supplier
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId: supplierId
  });

  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found or access denied");
  }

  // Find the image to delete
  const imageToDelete = previewProduct.images.find(img => 
    img._id.toString() === imageId || img.publicId === imageId
  );

  if (!imageToDelete) {
    throw new ApiError(404, "Image not found in this product");
  }

  // Delete from Cloudinary if publicId exists
  if (imageToDelete.publicId) {
    try {
      await deleteFromCloudinary(imageToDelete.publicId);
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }
  }

  // Remove image from array
  const updatedImages = previewProduct.images.filter(img => 
    !(img._id.toString() === imageId || img.publicId === imageId)
  );

  // If we deleted the main image and there are other images, set the first one as main
  if (imageToDelete.isMain && updatedImages.length > 0) {
    updatedImages[0].isMain = true;
  }

  const updatedProduct = await PreviewProduct.findByIdAndUpdate(
    previewProductId,
    {
      $set: { images: updatedImages }
    },
    { 
      new: true, 
      runValidators: true 
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        previewProduct: updatedProduct,
        deletedImage: imageToDelete
      },
      "Image deleted successfully"
    )
  );
});

// Get preview product images
export const getPreviewProductImages = asyncHandler(async (req, res) => {
  console.log('DEBUG getPreviewProductImages req.params:', req.params);

  const { supplierId, previewProductId } = req.params;
  
  // Validate required parameters
  if (!supplierId || !previewProductId) {
    throw new ApiError(400, "Supplier ID and Preview Product ID are required");
  }

  // Check if preview product exists and belongs to the supplier
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId: supplierId
  }).select('images name');

  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found or access denied");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        images: previewProduct.images,
        productName: previewProduct.name,
        totalImages: previewProduct.images.length
      },
      "Images retrieved successfully"
    )
  );
});

// // Get upload status and statistics
// export const getUploadStatus = asyncHandler(async (req, res) => {
//   const { supplierId } = req.params;
  
//   // Validate supplier access
//   if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
//     throw new ApiError(403, "You are not authorized to view upload status for this supplier");
//   }
  
//   // Get counts by status
//   const validCount = await PreviewProduct.countDocuments({ supplierId, status: 'valid' });
//   const invalidCount = await PreviewProduct.countDocuments({ supplierId, status: 'invalid' });
//   const totalCount = await PreviewProduct.countDocuments({ supplierId });
  
//   // Get latest upload timestamp
//   const latestUpload = await PreviewProduct.findOne({ supplierId })
//     .sort({ createdAt: -1 })
//     .select('createdAt');
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { 
//         stats: {
//           valid: validCount,
//           invalid: invalidCount,
//           total: totalCount,
//           hasData: totalCount > 0
//         },
//         lastUpload: latestUpload?.createdAt || null
//       },
//       "Upload status fetched successfully"
//     )
//   );
// });