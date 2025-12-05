import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Supplier from '../../models/supplier.model.js';
import Product from '../../models/product.model.js';
import Order from '../../models/order.model.js';
import Category from '../../models/category.model.js';
import { createTestSupplier, createTestCustomer, createTestAdmin } from '../helpers.js';

describe('Supplier Controller', () => {
  let testSupplier;
  let supplierAccessToken;
  let testCustomer;
  let customerAccessToken;
  let adminAccessToken;
  let testCategory;
  let testProduct;

  beforeEach(async () => {
    // Create test users
    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;
    supplierAccessToken = supplierData.accessToken;

    const customerData = await createTestCustomer();
    testCustomer = customerData.customer;
    customerAccessToken = customerData.accessToken;

    const adminData = await createTestAdmin();
    adminAccessToken = adminData.accessToken;

    // Create a test category
    testCategory = await Category.create({
      name: 'Test Category',
      description: 'Test category description'
    });

    // Create a test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price: 9.99,
      stock: 50,
      category: testCategory._id,
      supplier: testSupplier._id
    });
  });

  describe('Get Supplier Profile', () => {
    it('should get the supplier profile', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/profile')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('supplier');
      expect(response.body.data.supplier._id.toString()).toBe(testSupplier._id.toString());
      expect(response.body.data.supplier.email).toBe(testSupplier.email);
      expect(response.body.data.supplier.businessName).toBe(testSupplier.businessName);
    });

    it('should not get profile without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should not allow non-suppliers to access supplier profile', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/profile')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Supplier Profile', () => {
    it('should update the supplier profile', async () => {
      const updateData = {
        businessName: 'Updated Farm',
        phone: '9876543210',
        address: {
          street: '456 Farm Road',
          city: 'Farmville',
          state: 'Farmland',
          postalCode: '54321',
          country: 'Countryland'
        }
      };

      const response = await request(app)
        .put('/api/v1/suppliers/profile')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('supplier');
      expect(response.body.data.supplier.businessName).toBe(updateData.businessName);
      expect(response.body.data.supplier.phone).toBe(updateData.phone);
      expect(response.body.data.supplier.address.city).toBe(updateData.address.city);

      // Verify the database was updated
      const updatedSupplier = await Supplier.findById(testSupplier._id);
      expect(updatedSupplier.businessName).toBe(updateData.businessName);
    });

    it('should not update email to an existing email', async () => {
      // Create another supplier
      const anotherSupplier = await createTestSupplier({
        email: 'another.supplier@example.com',
        businessName: 'Another Farm'
      });

      const response = await request(app)
        .put('/api/v1/suppliers/profile')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send({ email: anotherSupplier.supplier.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Supplier Products', () => {
    it('should get all products for the supplier', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/products')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0]._id.toString()).toBe(testProduct._id.toString());
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get(`/api/v1/suppliers/products?category=${testCategory._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].category._id.toString()).toBe(testCategory._id.toString());
    });

    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/products?search=Test')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].name).toContain('Test');
    });
  });

  describe('Get Supplier Orders', () => {
    let testOrder;

    beforeEach(async () => {
      // Create a test order
      testOrder = await Order.create({
        customer: testCustomer._id,
        items: [
          {
            product: testProduct._id,
            name: testProduct.name,
            price: testProduct.price,
            quantity: 2,
            supplier: testSupplier._id
          }
        ],
        totalAmount: testProduct.price * 2,
        shippingAddress: {
          name: 'Home',
          street: '123 Main St',
          city: 'Cityville',
          state: 'Stateland',
          postalCode: '12345',
          country: 'Countryland'
        },
        status: 'pending',
        paymentMethod: 'cod',
        paymentStatus: 'pending'
      });
    });

    it('should get all orders for the supplier', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/orders')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data.orders[0].items[0].supplier.toString()).toBe(testSupplier._id.toString());
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/orders?status=pending')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data.orders[0].status).toBe('pending');
    });

    it('should get a single order by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/suppliers/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order._id.toString()).toBe(testOrder._id.toString());
      expect(response.body.data.order.items[0].supplier.toString()).toBe(testSupplier._id.toString());
    });

    it('should not allow supplier to view orders they are not part of', async () => {
      // Create another supplier
      const anotherSupplier = await createTestSupplier({
        email: 'another.supplier@example.com',
        businessName: 'Another Farm'
      });

      const response = await request(app)
        .get(`/api/v1/suppliers/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${anotherSupplier.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Supplier Analytics', () => {
    beforeEach(async () => {
      // Create multiple orders for better analytics
      for (let i = 0; i < 5; i++) {
        await Order.create({
          customer: testCustomer._id,
          items: [
            {
              product: testProduct._id,
              name: testProduct.name,
              price: testProduct.price,
              quantity: i + 1,
              supplier: testSupplier._id
            }
          ],
          totalAmount: testProduct.price * (i + 1),
          shippingAddress: {
            name: 'Home',
            street: '123 Main St',
            city: 'Cityville',
            state: 'Stateland',
            postalCode: '12345',
            country: 'Countryland'
          },
          status: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'][i],
          paymentMethod: 'cod',
          paymentStatus: i < 3 ? 'pending' : 'completed',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // Different dates
        });
      }
    });

    it('should get sales analytics', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/analytics/sales')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
      expect(response.body.data.totalSales).toBeGreaterThan(0);
    });

    it('should get order analytics', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/analytics/orders')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('ordersByStatus');
      expect(response.body.data.totalOrders).toBeGreaterThan(0);
      expect(Object.keys(response.body.data.ordersByStatus).length).toBeGreaterThan(0);
    });

    it('should get product analytics', async () => {
      const response = await request(app)
        .get('/api/v1/suppliers/analytics/products')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalProducts');
      expect(response.body.data).toHaveProperty('topSellingProducts');
      expect(response.body.data.totalProducts).toBeGreaterThan(0);
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/v1/suppliers/analytics/sales?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
    });
  });

  describe('Supplier Settings', () => {
    it('should update supplier settings', async () => {
      const settingsData = {
        notificationPreferences: {
          email: true,
          sms: false,
          app: true
        },
        deliverySettings: {
          freeShippingThreshold: 50,
          standardShippingFee: 5.99
        },
        returnPolicy: 'All returns must be initiated within 7 days of delivery.'
      };

      const response = await request(app)
        .put('/api/v1/suppliers/settings')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settings');
      expect(response.body.data.settings.notificationPreferences.email).toBe(settingsData.notificationPreferences.email);
      expect(response.body.data.settings.deliverySettings.freeShippingThreshold).toBe(settingsData.deliverySettings.freeShippingThreshold);
      expect(response.body.data.settings.returnPolicy).toBe(settingsData.returnPolicy);

      // Verify the database was updated
      const updatedSupplier = await Supplier.findById(testSupplier._id);
      expect(updatedSupplier.settings.notificationPreferences.email).toBe(settingsData.notificationPreferences.email);
    });

    it('should get supplier settings', async () => {
      // First update settings
      const settingsData = {
        notificationPreferences: {
          email: true,
          sms: false,
          app: true
        }
      };

      await request(app)
        .put('/api/v1/suppliers/settings')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(settingsData);

      // Now get settings
      const response = await request(app)
        .get('/api/v1/suppliers/settings')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settings');
      expect(response.body.data.settings.notificationPreferences.email).toBe(settingsData.notificationPreferences.email);
    });
  });

  describe('Get Supplier by ID (Public)', () => {
    it('should get public supplier profile', async () => {
      const response = await request(app)
        .get(`/api/v1/suppliers/${testSupplier._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('supplier');
      expect(response.body.data.supplier._id.toString()).toBe(testSupplier._id.toString());
      expect(response.body.data.supplier.businessName).toBe(testSupplier.businessName);
      
      // Should not expose sensitive information
      expect(response.body.data.supplier).not.toHaveProperty('password');
      expect(response.body.data.supplier).not.toHaveProperty('refreshToken');
    });

    it('should return 404 for non-existent supplier', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/suppliers/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
