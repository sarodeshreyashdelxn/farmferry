import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateInvoicePDF, shouldGenerateInvoice } from './utils/invoiceGenerator.js';

// Load environment variables
dotenv.config();

// Mock order data for testing
const mockOrder = {
  orderId: 'TEST-ORDER-123',
  status: 'delivered',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'paid',
  subtotal: 500,
  discountAmount: 50,
  taxes: 25,
  deliveryCharge: 30,
  totalAmount: 505,
  deliveredAt: new Date(),
  createdAt: new Date(),
  items: [
    {
      product: {
        name: 'Fresh Tomatoes',
        price: 100,
        discountedPrice: 90
      },
      quantity: 2,
      price: 100,
      discountedPrice: 90,
      totalPrice: 180
    },
    {
      product: {
        name: 'Organic Carrots',
        price: 80,
        discountedPrice: 70
      },
      quantity: 1,
      price: 80,
      discountedPrice: 70,
      totalPrice: 70
    }
  ],
  deliveryAddress: {
    street: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India'
  }
};

const mockCustomer = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+91-9876543210'
};

const mockSupplier = {
  businessName: 'Fresh Farm Foods',
  email: 'contact@freshfarmfoods.com',
  phone: '+91-9876543211'
};

// Test function
async function testInvoiceGeneration() {
  try {
    console.log('🧪 Testing Invoice Generation...');
    
    // Test 1: Check if invoice should be generated
    console.log('\n1. Testing shouldGenerateInvoice function:');
    const shouldGenerate = shouldGenerateInvoice(mockOrder);
    console.log(`   Should generate invoice: ${shouldGenerate}`);
    
    // Test 2: Generate invoice
    console.log('\n2. Testing invoice generation:');
    const invoiceUrl = await generateInvoicePDF(mockOrder, mockCustomer, mockSupplier);
    console.log(`   Invoice URL: ${invoiceUrl}`);
    
    // Test 3: Test with different payment methods
    console.log('\n3. Testing different payment methods:');
    
    const onlineOrder = { ...mockOrder, paymentMethod: 'credit_card', paymentStatus: 'paid' };
    const shouldGenerateOnline = shouldGenerateInvoice(onlineOrder);
    console.log(`   Online payment (paid): ${shouldGenerateOnline}`);
    
    const pendingOrder = { ...mockOrder, status: 'pending' };
    const shouldGeneratePending = shouldGenerateInvoice(pendingOrder);
    console.log(`   Pending order: ${shouldGeneratePending}`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInvoiceGeneration(); 