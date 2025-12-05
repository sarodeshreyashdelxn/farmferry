import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api/v1';

// Test data - replace with actual values
const testData = {
  supplierToken: 'YOUR_SUPPLIER_JWT_TOKEN_HERE', // Replace with actual supplier token
  productId: 'YOUR_PRODUCT_ID_HERE', // Replace with actual product ID
  offerData: {
    offerPercentage: 15, // 15% discount
    offerStartDate: '2024-01-15T00:00:00.000Z', // Optional
    offerEndDate: '2024-02-15T23:59:59.000Z' // Optional
  }
};

async function testAddOffer() {
  try {
    console.log('Testing addOffer API...');
    console.log('Product ID:', testData.productId);
    console.log('Offer Data:', testData.offerData);
    
    const response = await axios.post(
      `${BASE_URL}/products/${testData.productId}/offer`,
      testData.offerData,
      {
        headers: {
          'Authorization': `Bearer ${testData.supplierToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Test different scenarios
async function testScenarios() {
  console.log('=== Testing Add Offer API ===\n');
  
  // Test 1: Basic offer without dates
  console.log('Test 1: Basic 10% offer without dates');
  testData.offerData = {
    offerPercentage: 10
  };
  await testAddOffer();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Offer with date range
  console.log('Test 2: 20% offer with date range');
  testData.offerData = {
    offerPercentage: 20,
    offerStartDate: '2024-01-20T00:00:00.000Z',
    offerEndDate: '2024-02-20T23:59:59.000Z'
  };
  await testAddOffer();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Invalid percentage
  console.log('Test 3: Invalid percentage (should fail)');
  testData.offerData = {
    offerPercentage: 150 // Invalid: > 100%
  };
  await testAddOffer();
}

// Run tests
if (require.main === module) {
  testScenarios();
}

export { testAddOffer, testScenarios }; 