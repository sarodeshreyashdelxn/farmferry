import { uploadToCloudinary } from '../config/cloudinary.js';
import { v4 as uuidv4 } from 'uuid';
// Default product image
const DEFAULT_IMAGE_URL = 'https://res.cloudinary.com/your-cloud/image/upload/v1234567890/default-product.jpg';



/**
 * Processes image URLs from Excel and uploads new images to Cloudinary
 * @param {Array} imageUrls - Array of image URLs from Excel
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise<Array>} Array of image objects with url and publicId
 */
export const processProductImages = async (imageUrls = [], isUpdate = false) => {
  const processedImages = [];

  // If no images provided, use default image with generated publicId
  if (!imageUrls || imageUrls.length === 0) {
    return [{
      url: DEFAULT_IMAGE_URL,
      publicId: `default_${uuidv4()}`,
      isMain: true
    }];
  }

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const isMain = i === 0;

    try {
      if (imageUrl.includes('cloudinary.com') || imageUrl.startsWith('http')) {
        // External or existing Cloudinary URL: generate a new publicId
        processedImages.push({
          url: imageUrl,
          publicId: `external_${uuidv4()}`,
          isMain
        });
      } else {
        // Local file path or base64: upload to Cloudinary
        const uploaded = await uploadToCloudinary(imageUrl, 'products');
        processedImages.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          isMain
        });
      }
    } catch (error) {
      console.error(`Error processing image ${imageUrl}:`, error);
      // Fallback to default image with new publicId
      processedImages.push({
        url: DEFAULT_IMAGE_URL,
        publicId: `default_${uuidv4()}`,
        isMain
      });
    }
  }

  return processedImages;
};
