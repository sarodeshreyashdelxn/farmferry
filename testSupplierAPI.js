// Test script to verify supplier business names API
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:9000/api/v1';

async function testSupplierAPI() {
  try {
    console.log('Testing supplier business names API...');
    
    const response = await fetch(`${API_BASE_URL}/supplier-payments/business-names`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data) {
      console.log(`✅ Success! Found ${data.data.length} suppliers:`);
      data.data.forEach((supplier, index) => {
        console.log(`${index + 1}. ${supplier.businessName} (ID: ${supplier._id})`);
      });
    } else {
      console.log('❌ No suppliers found or API returned error');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testSupplierAPI(); 