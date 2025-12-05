import Product from '../models/product.model.js';
import PreviewProduct from '../models/previewProduct.model.js';
import Category from '../models/category.model.js';
import mongoose from 'mongoose';

/**
 * Processes preview products into final products with proper error handling and cleanup
 */
export const processProductsInBatches = async (supplierId, processInvalid = false, batchSize = 50) => {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  // Build query with proper ObjectId conversion
  const query = { 
    supplierId: new mongoose.Types.ObjectId(supplierId) 
  };
  
  if (!processInvalid) {
    query.status = 'valid';
  }

  let hasMore = true;
  let skip = 0;

  // Process in batches to avoid memory issues
  while (hasMore) {
    try {
      // Get batch of preview products
      const previewProducts = await PreviewProduct.find(query)
        .sort({ excelRowIndex: 1 })
        .skip(skip)
        .limit(batchSize);

      if (previewProducts.length === 0) {
        hasMore = false;
        continue;
      }

      // Process each product in the batch
      for (const previewProduct of previewProducts) {
        try {
          // Skip invalid products unless explicitly requested
          if (previewProduct.status === 'invalid' && !processInvalid) {
            results.skipped++;
            continue;
          }

          if (previewProduct.isUpdate && previewProduct.originalProductId) {
            // ✅ UPDATE EXISTING PRODUCT
            const updatedProduct = await Product.findByIdAndUpdate(
              previewProduct.originalProductId,
              {
                name: previewProduct.name,
                description: previewProduct.description,
                price: previewProduct.price,
                gst: previewProduct.gst,
                stockQuantity: previewProduct.stockQuantity,
                unit: previewProduct.unit,
                categoryId: previewProduct.categoryId,
                images: previewProduct.images,
                updatedAt: new Date()
              },
              { 
                new: true, 
                runValidators: true, // ✅ CRITICAL: Run validations
                context: 'query' 
              }
            );

            if (updatedProduct) {
              results.updated++;
            } else {
              throw new Error('Product not found for update');
            }
          } else {
            // ✅ CREATE NEW PRODUCT
            const newProduct = await Product.create({
              supplierId: previewProduct.supplierId,
              name: previewProduct.name,
              description: previewProduct.description,
              price: previewProduct.price,
              gst: previewProduct.gst,
              stockQuantity: previewProduct.stockQuantity,
              unit: previewProduct.unit,
              categoryId: previewProduct.categoryId,
              images: previewProduct.images
            });

            if (newProduct) {
              results.created++;
            } else {
              throw new Error('Failed to create product');
            }
          }

          // ✅ DELETE FROM PREVIEWPRODUCT AFTER SUCCESSFUL PROCESSING
          await PreviewProduct.findByIdAndDelete(previewProduct._id);

        } catch (productError) {
          results.failed++;
          
          // Store detailed error information
          const errorMessage = `Row ${previewProduct.excelRowIndex}: ${previewProduct.name} - ${productError.message}`;
          results.errors.push(errorMessage);
          
          // Optional: Mark as failed in preview product instead of deleting
          await PreviewProduct.findByIdAndUpdate(
            previewProduct._id,
            { 
              status: 'failed',
              validationErrors: [...previewProduct.validationErrors, productError.message]
            }
          );
        }
      }

      // Move to next batch
      skip += batchSize;

      // Add small delay to prevent database overload
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (batchError) {
      results.failed++;
      results.errors.push(`Batch processing error: ${batchError.message}`);
      break; // Stop processing on critical errors
    }
  }

  return results;
};

/**
 * Alternative: Using MongoDB transactions for atomic operations
 */
export const processProductsWithTransaction = async (supplierId, processInvalid = false) => {
  const session = await mongoose.startSession();
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    await session.withTransaction(async () => {
      const query = { 
        supplierId: new mongoose.Types.ObjectId(supplierId) 
      };
      
      if (!processInvalid) {
        query.status = 'valid';
      }

      const previewProducts = await PreviewProduct.find(query).session(session);

      for (const previewProduct of previewProducts) {
        try {
          if (previewProduct.status === 'invalid' && !processInvalid) {
            results.skipped++;
            continue;
          }

          if (previewProduct.isUpdate && previewProduct.originalProductId) {
            await Product.findByIdAndUpdate(
              previewProduct.originalProductId,
              { /* update fields */ },
              { session, runValidators: true }
            );
            results.updated++;
          } else {
            await Product.create([{ /* new product */ }], { session });
            results.created++;
          }

          await PreviewProduct.findByIdAndDelete(previewProduct._id, { session });

        } catch (error) {
          results.failed++;
          results.errors.push(`Product error: ${error.message}`);
          throw error; // Rollback transaction on error
        }
      }
    });
  } catch (transactionError) {
    results.errors.push(`Transaction failed: ${transactionError.message}`);
  } finally {
    await session.endSession();
  }

  return results;
};