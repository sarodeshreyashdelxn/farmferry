import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from './models/customer.model.js';
import Supplier from './models/supplier.model.js';
import DeliveryAssociate from './models/deliveryAssociate.model.js';
import Product from './models/product.model.js';
import Order from './models/order.model.js';
import { connectDB } from "./config/database.js";

dotenv.config();

async function seed() {
  await connectDB();
  console.log('Connected to DB');

  // 1. Create Customer
  const customer = await Customer.create({
    firstName: 'Test',
    lastName: 'Customer',
    email: 'testcustomer1@example.com',
    password: 'Test@1234',
    phone: '+10000000001',
    addresses: [{
      type: 'home',
      street: '123 Test St',
      city: 'Testville',
      state: 'TestState',
      postalCode: '12345',
      country: 'Testland',
      isDefault: true
    }]
  });

  // 2. Create Supplier
  const supplier = await Supplier.create({
    businessName: 'Test Supplier',
    email: 'testsupplier1@example.com',
    password: 'Test@1234',
    phone: '+10000000002',
    address: {
      street: '456 Supplier Rd',
      city: 'Supplytown',
      state: 'SupplyState',
      postalCode: '54321',
      country: 'Testland',
    },
    status: 'approved',
    documents: [],
    isVerified: true
  });

  // 3. Create Delivery Associate
  const deliveryAssociate = await DeliveryAssociate.create({
    name: 'Test Delivery',
    email: 'testdelivery1@example.com',
    password: 'Test@1234',
    phone: '+10000000003',
    gender: 'other',
    address: {
      street: '789 Delivery Ln',
      city: 'Deliverycity',
      state: 'DeliveryState',
      postalCode: '67890',
      country: 'Testland',
    },
    isVerified: true,
    isActive: true,
    isOnline: true,
    currentLocation: {
      type: 'Point',
      coordinates: [77.5946, 12.9716] // Bangalore coords
    }
  });

  // 4. Create Product
  const product = await Product.create({
    supplierId: supplier._id,
    categoryId: "68483e35ec3e172819b95a11", // You may want to create a category if required
    name: 'Test Product',
    description: 'A product for testing',
    price: 100,
    stockQuantity: 50,
    unit: 'kg',
    images: [{ url: '', publicId: 'test', isMain: true }],
    isActive: true
  });

  // 5. Create Order
  const order = await Order.create({
    customer: customer._id,
    supplier: supplier._id,
    items: [{
      product: product._id,
      quantity: 2,
      price: 100,
      discountedPrice: 90,
      totalPrice: 180
    }],
    subtotal: 180,
    totalAmount: 200,
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'pending',
    status: 'pending',
    deliveryAddress: {
      street: '123 Test St',
      city: 'Testville',
      state: 'TestState',
      postalCode: '12345',
      country: 'Testland',
      phone: '+10000000001'
    },
    deliveryAssociate: {
      associate: deliveryAssociate._id,
      assignedAt: new Date(),
      status: 'assigned'
    },
    estimatedDeliveryDate: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
  });

  // Generate tokens
  const customerToken = customer.generateAccessToken();
  const deliveryToken = deliveryAssociate.generateAccessToken();
  const supplierToken = supplier.generateAccessToken();

  console.log('--- Seeded Test Data ---');
  console.log('Customer:', customer._id, customer.email, customerToken);
  console.log('Supplier:', supplier._id, supplier.email, supplierToken);
  console.log('Delivery Associate:', deliveryAssociate._id, deliveryAssociate.email, deliveryToken);
  console.log('Product:', product._id, product.name);
  console.log('Order:', order._id, order.orderId);
  console.log('--- Tokens ---');
  console.log('Customer Token:', customerToken);
  console.log('Delivery Associate Token:', deliveryToken);
  console.log('Supplier Token:', supplierToken);

  await mongoose.disconnect();
  console.log('Disconnected from DB');
}

seed().catch(err => {
  console.error('Seed error:', err);
  mongoose.disconnect();
}); 