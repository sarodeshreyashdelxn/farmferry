import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import Customer from '../../models/customer.model.js';
import Supplier from '../../models/supplier.model.js';
import { 
  createTestCustomer, 
  createTestSupplier,
  createTestAdmin,
  createTestDeliveryAssociate
} from '../helpers.js';

describe('Analytics Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let testAdmin;
  let adminAccessToken;
  let testDeliveryAssociate;
  let deliveryAccessToken;
  let testProduct;
  let testOrder;

  beforeEach(async () => {
    // Create test users
    const customerData = await createTestCustomer();
    testCustomer = customerData.customer;
    customerAccessToken = customerData.accessToken;

    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;
    supplierAccessToken = supplierData.accessToken;

    const adminData = await createTestAdmin();
    testAdmin = adminData.admin;
    adminAccessToken = adminData.accessToken;

    const deliveryData = await createTestDeliveryAssociate();
    testDeliveryAssociate = deliveryData.deliveryAssociate;
    deliveryAccessToken = deliveryData.accessToken;

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price: 9.99,
      stock: 50,
      category: new mongoose.Types.ObjectId(),
      supplier: testSupplier._id
    });

    // Create test order
    testOrder = await Order.create({
      customer: testCustomer._id,
      items: [
        {
          product: testProduct._id,
          quantity: 2,
          price: testProduct.price,
          name: testProduct.name
        }
      ],
      totalAmount: 19.98,
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'card',
      deliveryAssociate: testDeliveryAssociate._id
    });

    // Create more orders with different dates for testing date range filters
    const pastDates = [
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 14 days ago
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) // 30 days ago
    ];

    for (let i = 0; i < pastDates.length; i++) {
      await Order.create({
        customer: testCustomer._id,
        items: [
          {
            product: testProduct._id,
            quantity: i + 1,
            price: testProduct.price,
            name: testProduct.name
          }
        ],
        totalAmount: testProduct.price * (i + 1),
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        status: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'][i % 5],
        paymentStatus: ['pending', 'paid', 'failed', 'refunded'][i % 4],
        paymentMethod: ['card', 'upi', 'cod'][i % 3],
        deliveryAssociate: testDeliveryAssociate._id,
        createdAt: pastDates[i]
      });
    }
  });

  describe('Sales Analytics', () => {
    it('should get sales analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/sales')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
      expect(response.body.data).toHaveProperty('averageOrderValue');
      expect(response.body.data).toHaveProperty('salesByPaymentMethod');
    });

    it('should filter sales analytics by date range', async () => {
      const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // 10 days ago
      const endDate = new Date(); // today

      const response = await request(app)
        .get(`/api/v1/analytics/sales?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
      
      // Only orders within the date range should be included
      const ordersInRange = await Order.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });
      expect(response.body.data.totalOrders).toBe(ordersInRange);
    });

    it('should get sales analytics for supplier (limited to their products)', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/sales')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
      
      // The sales data should only include the supplier's products
      const supplierOrders = await Order.countDocuments({
        'items.product': { $in: await Product.find({ supplier: testSupplier._id }).distinct('_id') }
      });
      expect(response.body.data.totalOrders).toBeLessThanOrEqual(supplierOrders);
    });

    it('should not allow customers to access sales analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/sales')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Product Analytics', () => {
    it('should get product analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/products')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topSellingProducts');
      expect(response.body.data).toHaveProperty('productsByCategory');
      expect(response.body.data).toHaveProperty('lowStockProducts');
    });

    it('should get product analytics for supplier (limited to their products)', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/products')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topSellingProducts');
      
      // The product data should only include the supplier's products
      response.body.data.topSellingProducts.forEach(product => {
        expect(product.supplier.toString()).toBe(testSupplier._id.toString());
      });
    });

    it('should filter product analytics by date range', async () => {
      const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // 10 days ago
      const endDate = new Date(); // today

      const response = await request(app)
        .get(`/api/v1/analytics/products?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topSellingProducts');
    });

    it('should not allow customers to access product analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/products')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Customer Analytics', () => {
    it('should get customer analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCustomers');
      expect(response.body.data).toHaveProperty('newCustomersByPeriod');
      expect(response.body.data).toHaveProperty('topCustomers');
      expect(response.body.data).toHaveProperty('customerRetentionRate');
    });

    it('should filter customer analytics by date range', async () => {
      const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // 10 days ago
      const endDate = new Date(); // today

      const response = await request(app)
        .get(`/api/v1/analytics/customers?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCustomers');
      expect(response.body.data).toHaveProperty('newCustomersByPeriod');
    });

    it('should not allow suppliers to access customer analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow customers to access customer analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Supplier Analytics', () => {
    it('should get supplier analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/suppliers')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSuppliers');
      expect(response.body.data).toHaveProperty('newSuppliersByPeriod');
      expect(response.body.data).toHaveProperty('topSuppliers');
      expect(response.body.data).toHaveProperty('suppliersByRegion');
    });

    it('should get supplier analytics for a specific supplier (their own data)', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/suppliers/me')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('topSellingProducts');
      
      // The supplier data should only include the supplier's own data
      if (response.body.data.supplierInfo) {
        expect(response.body.data.supplierInfo._id.toString()).toBe(testSupplier._id.toString());
      }
    });

    it('should filter supplier analytics by date range', async () => {
      const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // 10 days ago
      const endDate = new Date(); // today

      const response = await request(app)
        .get(`/api/v1/analytics/suppliers?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSuppliers');
      expect(response.body.data).toHaveProperty('newSuppliersByPeriod');
    });

    it('should not allow customers to access supplier analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/suppliers')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Delivery Analytics', () => {
    it('should get delivery analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/delivery')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalDeliveries');
      expect(response.body.data).toHaveProperty('deliveriesByStatus');
      expect(response.body.data).toHaveProperty('averageDeliveryTime');
      expect(response.body.data).toHaveProperty('topDeliveryAssociates');
    });

    it('should get delivery analytics for a delivery associate (their own data)', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/delivery/me')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalDeliveries');
      expect(response.body.data).toHaveProperty('deliveriesByStatus');
      expect(response.body.data).toHaveProperty('averageDeliveryTime');
      
      // The delivery data should only include the delivery associate's own data
      if (response.body.data.deliveryAssociateInfo) {
        expect(response.body.data.deliveryAssociateInfo._id.toString()).toBe(testDeliveryAssociate._id.toString());
      }
    });

    it('should filter delivery analytics by date range', async () => {
      const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // 10 days ago
      const endDate = new Date(); // today

      const response = await request(app)
        .get(`/api/v1/analytics/delivery?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalDeliveries');
      expect(response.body.data).toHaveProperty('deliveriesByStatus');
    });

    it('should not allow customers to access delivery analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/delivery')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Dashboard Analytics', () => {
    it('should get dashboard analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('salesSummary');
      expect(response.body.data).toHaveProperty('userSummary');
      expect(response.body.data).toHaveProperty('orderSummary');
      expect(response.body.data).toHaveProperty('recentOrders');
      expect(response.body.data).toHaveProperty('topProducts');
    });

    it('should get dashboard analytics for supplier', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('salesSummary');
      expect(response.body.data).toHaveProperty('orderSummary');
      expect(response.body.data).toHaveProperty('recentOrders');
      expect(response.body.data).toHaveProperty('topProducts');
      
      // The dashboard data should only include the supplier's own data
      if (response.body.data.recentOrders && response.body.data.recentOrders.length > 0) {
        response.body.data.recentOrders.forEach(order => {
          expect(order.items.some(item => 
            item.product && item.product.supplier && 
            item.product.supplier.toString() === testSupplier._id.toString()
          )).toBe(true);
        });
      }
    });

    it('should get dashboard analytics for delivery associate', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliverySummary');
      expect(response.body.data).toHaveProperty('recentDeliveries');
      
      // The dashboard data should only include the delivery associate's own data
      if (response.body.data.recentDeliveries && response.body.data.recentDeliveries.length > 0) {
        response.body.data.recentDeliveries.forEach(delivery => {
          expect(delivery.deliveryAssociate.toString()).toBe(testDeliveryAssociate._id.toString());
        });
      }
    });

    it('should filter dashboard analytics by date range', async () => {
      const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10); // 10 days ago
      const endDate = new Date(); // today

      const response = await request(app)
        .get(`/api/v1/analytics/dashboard?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('salesSummary');
      expect(response.body.data).toHaveProperty('userSummary');
      expect(response.body.data).toHaveProperty('orderSummary');
    });

    it('should not allow customers to access dashboard analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Report Generation', () => {
    it('should generate a sales report for admin', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/reports/sales')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          endDate: new Date(), // today
          format: 'json'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      expect(response.body.data.report).toHaveProperty('totalSales');
      expect(response.body.data.report).toHaveProperty('totalOrders');
      expect(response.body.data.report).toHaveProperty('salesByDay');
    });

    it('should generate a product report for admin', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/reports/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          endDate: new Date(), // today
          format: 'json'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      expect(response.body.data.report).toHaveProperty('topSellingProducts');
      expect(response.body.data.report).toHaveProperty('productsByCategory');
    });

    it('should generate a customer report for admin', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/reports/customers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          endDate: new Date(), // today
          format: 'json'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      expect(response.body.data.report).toHaveProperty('totalCustomers');
      expect(response.body.data.report).toHaveProperty('newCustomers');
      expect(response.body.data.report).toHaveProperty('topCustomers');
    });

    it('should not allow suppliers to generate admin reports', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/reports/customers')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send({
          startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          endDate: new Date(), // today
          format: 'json'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should allow suppliers to generate their own sales report', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/reports/supplier-sales')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send({
          startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
          endDate: new Date(), // today
          format: 'json'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      expect(response.body.data.report).toHaveProperty('totalSales');
      expect(response.body.data.report).toHaveProperty('totalOrders');
      expect(response.body.data.report).toHaveProperty('salesByDay');
    });
  });
});
