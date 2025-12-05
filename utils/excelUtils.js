import ExcelJS from 'exceljs';
// import Category from '../models/category.model.js';
import Category from '../models/category.model.js';

/**
 * Generates Excel template for product upload
 * @param {string} type - 'new' for empty template, 'old' for pre-filled
 * @param {string} supplierId - Supplier ID
 * @returns {Promise<ExcelJS.Workbook>} Excel workbook
 */
export const generateProductTemplate = async (type, supplierId) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');
  
  // Define columns
  worksheet.columns = [
    { header: '_id', key: '_id', width: 30 },
    { header: 'name', key: 'name', width: 30, note: 'Required field' },
    { header: 'description', key: 'description', width: 50 },
    { header: 'price', key: 'price', width: 15, note: 'Required field, must be number' },
    { header: 'gst', key: 'gst', width: 10, note: 'Must be between 0-100' },
    { header: 'stockQuantity', key: 'stockQuantity', width: 15, note: 'Required field, must be number' },
    { header: 'unit', key: 'unit', width: 10, note: 'kg, g, liters, ml, pcs, box, dozen' },
    { header: 'categoryId', key: 'categoryId', width: 30 },
    { header: 'categoryName', key: 'categoryName', width: 20 },
    { header: 'images', key: 'images', width: 50, note: 'Comma-separated URLs. First image will be main image' }
  ];
  
  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Add data validation for units
  worksheet.dataValidations.add('G2:G1000', {
    type: 'list',
    allowBlank: true,
    formulae: ['"kg,g,liters,ml,pcs,box,dozen"']
  });
  
  // Add data validation for GST (0-100)
  worksheet.dataValidations.add('E2:E1000', {
    type: 'decimal',
    operator: 'between',
    formulae: [0, 100],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Invalid GST',
    error: 'GST must be between 0 and 100'
  });
  
  // Get categories for dropdown
  const categories = await Category.find({});
  const categoryNames = categories.map(cat => cat.name);
  
  // Add data validation for category names
  worksheet.dataValidations.add('I2:I1000', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${categoryNames.join(',')}"`]
  });
  
  // For "old" template, populate with existing products
  if (type === 'old' && supplierId) {
    const Product = await import('../models/product.model.js').then(m => m.default);
    const existingProducts = await Product.find({ supplierId })
      .populate('categoryId', 'name');
    
    existingProducts.forEach((product, index) => {
      worksheet.addRow({
        _id: product._id.toString(),
        name: product.name,
        description: product.description || '',
        price: product.price,
        gst: product.gst || 0,
        stockQuantity: product.stockQuantity,
        unit: product.unit,
        categoryId: product.categoryId?._id?.toString() || '',
        categoryName: product.categoryId?.name || '',
        images: product.images.map(img => img.url).join(', ')
      });
    });
  }
  
  // Add instructions
  worksheet.addRow([]);
  worksheet.addRow(['Instructions:']);
  worksheet.addRow(['- Leave _id empty for new products']);
  worksheet.addRow(['- Provide either categoryId or categoryName']);
  worksheet.addRow(['- For updates, include the _id from existing products']);
  worksheet.addRow(['- Images should be comma-separated URLs']);
  worksheet.addRow(['- First image will be set as the main image']);
  
  return workbook;
};

/**
 * Parses Excel file and extracts product data
 * @param {Buffer} fileBuffer - Excel file buffer
 * @returns {Promise<Array>} Array of product objects
 */
export const parseExcelFile = async (fileBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel file must contain at least one worksheet');
  }
  
  const products = [];
  const headers = {};
  
  // Get header row to map columns
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[cell.value?.toString().toLowerCase().trim()] = colNumber;
  });
  
  // Process each data row
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    const product = {
      excelRowIndex: rowNumber,
      validationErrors: []
    };
    
    // Extract data based on header mapping
    if (headers._id) {
      const idValue = row.getCell(headers._id).value;
      product._id = idValue ? idValue.toString().trim() : null;
    }
    
    if (headers.name) {
      product.name = row.getCell(headers.name).value?.toString().trim() || '';
    }
    
    if (headers.description) {
      product.description = row.getCell(headers.description).value?.toString().trim() || '';
    }
    
    if (headers.price) {
      const priceValue = row.getCell(headers.price).value;
      product.price = typeof priceValue === 'number' ? priceValue : parseFloat(priceValue) || 0;
    }
    
    if (headers.gst) {
      const gstValue = row.getCell(headers.gst).value;
      product.gst = typeof gstValue === 'number' ? gstValue : parseFloat(gstValue) || 0;
    }
    
    if (headers.stockquantity) {
      const stockValue = row.getCell(headers.stockquantity).value;
      product.stockQuantity = typeof stockValue === 'number' ? stockValue : parseInt(stockValue) || 0;
    }
    
    if (headers.unit) {
      product.unit = row.getCell(headers.unit).value?.toString().trim() || 'kg';
    }
    
    if (headers.categoryid) {
      product.categoryId = row.getCell(headers.categoryid).value?.toString().trim() || '';
    }
    
    if (headers.categoryname) {
      product.categoryName = row.getCell(headers.categoryname).value?.toString().trim() || '';
    }
    
    if (headers.images) {
      const imagesValue = row.getCell(headers.images).value?.toString().trim() || '';
      product.images = imagesValue.split(',').map(url => url.trim()).filter(url => url);
    }
    
    products.push(product);
  });
  
  return products;
};