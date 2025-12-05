import mongoose from 'mongoose';
import Category from '../models/category.model.js';

const EXCEL_COLUMN_MAPPING = {
  // Required fields
  'Product Name': ['product_name', 'name', 'product', 'item_name', '_id'], // Added _id
  'Price': ['price', 'selling_price', 'cost', 'rate'],
  // In EXCEL_COLUMN_MAPPING
  'Stock': ['stock', 'quantity', 'available_stock', 'qty', 'stockquantity', 'stock_quantity', 'stockQuantity'],
  'Unit': ['unit', 'measurement_unit', 'uom', 'measurement'],
  
  // Optional fields
  'Description': ['description', 'desc', 'product_description', 'details'],
  'GST': ['gst', 'tax', 'tax_percentage', 'vat'],
  'Category': ['category', 'product_category', 'type', 'category_name', 'categoryId', 'categoryName'] // Added categoryId/categoryName
};

// Get value from Excel row using multiple possible column names
const getExcelValue = (row, possibleKeys) => {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
};

// Map Excel row to product schema
export const mapExcelToProduct = (row, supplierId, categoryId, rowNumber) => {
  return {
    _id: getExcelValue(row, ['_id', 'id', 'product_id']), // Map _id if needed
    name: getExcelValue(row, ['name', 'Product Name', 'product_name']) || '',
    description: getExcelValue(row, ['description', 'Description', 'desc']) || '',
    price: parseFloat(getExcelValue(row, ['price', 'Price', 'selling_price']) || 0),
    gst: parseFloat(getExcelValue(row, ['gst', 'GST', 'tax']) || 0),
    stockQuantity: parseInt(getExcelValue(row, ['stockQuantity', 'Stock', 'stock', 'quantity']) || 0),
    unit: (getExcelValue(row, ['unit', 'Unit', 'measurement_unit']) || 'kg').toLowerCase(),
    categoryId: getExcelValue(row, ['categoryId', 'Category ID']),
    categoryName: getExcelValue(row, ['categoryName', 'Category Name', 'Category']),
    images: [{
      url: '/default-product.jpg',
      publicId: 'default-product',
      isMain: true
    }],
    isActive: true
  };
};

// Validate product data (matches your existing validation)
export const validateProductData = async (productData, supplierId = null) => {
  const errors = [];
  const validatedData = { ...productData };

  // ✅ Required fields validation
  if (!validatedData.name || validatedData.name.trim().length === 0) {
    errors.push('Product name is required');
  } else if (validatedData.name.trim().length > 100) {
    errors.push('Product name must be less than 100 characters');
  }

  if (!validatedData.price || validatedData.price <= 0) {
    errors.push('Price must be greater than 0');
  } else if (validatedData.price > 1000000) {
    errors.push('Price cannot exceed 1,000,000');
  }

  // ✅ Stock validation
  if (validatedData.stockQuantity === undefined || validatedData.stockQuantity === null) {
    errors.push('Stock quantity is required');
  } else if (validatedData.stockQuantity < 0) {
    errors.push('Stock quantity cannot be negative');
  } else if (validatedData.stockQuantity > 1000000) {
    errors.push('Stock quantity cannot exceed 1,000,000');
  }

  // ✅ Unit validation against allowed values
  const validUnits = ["kg", "g", "liters", "ml", "pcs", "box", "dozen"];
  if (!validatedData.unit) {
    errors.push('Unit is required');
  } else if (!validUnits.includes(validatedData.unit)) {
    errors.push(`Unit must be one of: ${validUnits.join(', ')}`);
  }

  // ✅ GST validation
  if (validatedData.gst === undefined || validatedData.gst === null) {
    validatedData.gst = 0; // Set default
  } else if (validatedData.gst < 0 || validatedData.gst > 100) {
    errors.push('GST must be between 0 and 100');
  }

  // ✅ CRITICAL: Category validation against database
  let categoryId = validatedData.categoryId;
  let categoryName = validatedData.categoryName;

  if (categoryName && !categoryId) {
    // Try to find category by name
    const category = await Category.findOne({ 
      name: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
    });
    
    if (category) {
      categoryId = category._id.toString();
      validatedData.categoryId = categoryId;
    } else {
      errors.push(`Category '${categoryName}' not found`);
    }
  } else if (categoryId && !categoryName) {
    // Validate category ID exists
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      errors.push('Invalid category ID format');
    } else {
      const category = await Category.findById(categoryId);
      if (category) {
        categoryName = category.name;
        validatedData.categoryName = categoryName;
      } else {
        errors.push(`Category ID '${categoryId}' not found`);
      }
    }
  } else if (!categoryId && !categoryName) {
    errors.push('Either categoryId or categoryName is required');
  }

  // ✅ Product ID validation for updates
  if (validatedData._id) {
    if (!mongoose.Types.ObjectId.isValid(validatedData._id)) {
      errors.push('Invalid product ID format');
    } else if (supplierId) {
      // For updates, verify product belongs to this supplier
      const Product = await import('../models/product.model.js').then(m => m.default);
      const existingProduct = await Product.findOne({
        _id: validatedData._id,
        supplierId
      });
      
      if (!existingProduct) {
        errors.push(`Product with ID ${validatedData._id} not found or doesn't belong to this supplier`);
      }
    }
  }

  // ✅ Discount validation
  if (validatedData.discountedPrice && validatedData.discountedPrice > validatedData.price) {
    errors.push('Discounted price cannot be greater than regular price');
  }

  // ✅ Description length validation
  if (validatedData.description && validatedData.description.length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }

  // ✅ Image validation (optional but with limits)
  if (validatedData.images && validatedData.images.length > 10) {
    errors.push('Maximum 10 images allowed per product');
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedData
  };
};

// Additional validation for Excel structure
export const validateExcelStructure = (products) => {
  const errors = [];
  
  if (products.length === 0) {
    errors.push("Excel file contains no data rows");
    return errors;
  }
  
  // Check for required columns in the first product
  const firstProduct = products[0];
  
  if (!firstProduct.hasOwnProperty('name')) {
    errors.push("Excel file is missing the 'name' column");
  }
  
  if (!firstProduct.hasOwnProperty('price')) {
    errors.push("Excel file is missing the 'price' column");
  }
  
  if (!firstProduct.hasOwnProperty('stockQuantity')) {
    errors.push("Excel file is missing the 'stockQuantity' column");
  }
  
  return errors;
};