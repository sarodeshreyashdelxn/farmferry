import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:9000/api/v1';

async function testReviewRoutes() {
  try {
    console.log('🧪 Testing Review Routes...');
    
    // Test 1: Check if admin routes are accessible
    console.log('\n1. Testing admin routes accessibility...');
    const response1 = await fetch(`${BASE_URL}/admin/profile`);
    console.log('Admin profile route status:', response1.status);
    
    // Test 2: Check if reviews route exists
    console.log('\n2. Testing reviews route...');
    const response2 = await fetch(`${BASE_URL}/admin/reviews`);
    console.log('Reviews route status:', response2.status);
    
    // Test 3: Check if reviews stats route exists
    console.log('\n3. Testing reviews stats route...');
    const response3 = await fetch(`${BASE_URL}/admin/reviews/stats`);
    console.log('Reviews stats route status:', response3.status);
    
    console.log('\n✅ Route testing completed');
  } catch (error) {
    console.error('❌ Error testing routes:', error.message);
  }
}

testReviewRoutes(); 