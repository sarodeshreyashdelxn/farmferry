import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api/v1';

// Test data - replace with actual values
const testData = {
  supplierToken: 'YOUR_SUPPLIER_JWT_TOKEN_HERE', // Replace with actual supplier token
  categoryId: 'YOUR_CATEGORY_ID_HERE', // Replace with actual category ID
  productData: {
    name: 'Test Product with GST',
    description: 'A test product to verify GST functionality',
    price: 100,
    gst: 18, // 18% GST
    stockQuantity: 50,
    unit: 'kg',
    sku: 'TEST-GST-001',
    barcode: '1234567890123'
  }
};

async function testCreateProductWithGST() {
  try {
    console.log('Testing createProduct with GST...');
    console.log('Product Data:', testData.productData);
    
    const response = await axios.post(
      `${BASE_URL}/products`,
      testData.productData,
      {
        headers: {
          'Authorization': `Bearer ${testData.supplierToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Product created successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Return the created product ID for update testing
    return response.data.data.product._id;
    
  } catch (error) {
    console.error('❌ Error creating product:', error.response?.data || error.message);
    return null;
  }
}

async function testUpdateProductGST(productId) {
  try {
    console.log('\nTesting updateProduct with GST change...');
    console.log('Product ID:', productId);
    
    const updateData = {
      gst: 12, // Change GST to 12%
      price: 120 // Also update price
    };
    
    console.log('Update Data:', updateData);
    
    const response = await axios.post(
      `${BASE_URL}/products/${productId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${testData.supplierToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Product updated successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error updating product:', error.response?.data || error.message);
  }
}

async function testGSTValidation() {
  console.log('\n=== Testing GST Validation ===\n');
  
  // Test 1: Invalid GST (negative)
  console.log('Test 1: Negative GST (should fail)');
  testData.productData.gst = -5;
  testData.productData.name = 'Test Product - Negative GST';
  await testCreateProductWithGST();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Invalid GST (over 100%)
  console.log('Test 2: GST over 100% (should fail)');
  testData.productData.gst = 150;
  testData.productData.name = 'Test Product - High GST';
  await testCreateProductWithGST();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Valid GST (0%)
  console.log('Test 3: Zero GST (should succeed)');
  testData.productData.gst = 0;
  testData.productData.name = 'Test Product - Zero GST';
  const productId1 = await testCreateProductWithGST();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Valid GST (standard rates)
  console.log('Test 4: Standard GST rates (should succeed)');
  testData.productData.gst = 5;
  testData.productData.name = 'Test Product - 5% GST';
  const productId2 = await testCreateProductWithGST();
  
  if (productId2) {
    console.log('\n' + '='.repeat(50) + '\n');
    console.log('Test 5: Update GST on existing product');
    await testUpdateProductGST(productId2);
  }
}

async function testAllScenarios() {
  console.log('=== Testing GST Product Functionality ===\n');
  
  // Test basic GST functionality
  console.log('Basic GST Test:');
  testData.productData.gst = 18;
  testData.productData.name = 'Basic GST Test Product';
  const productId = await testCreateProductWithGST();
  
  if (productId) {
    console.log('\n' + '='.repeat(50) + '\n');
    await testUpdateProductGST(productId);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test validation scenarios
  await testGSTValidation();
}

// Run tests
if (require.main === module) {
  testAllScenarios();
}

export { testCreateProductWithGST, testUpdateProductGST, testGSTValidation }; 