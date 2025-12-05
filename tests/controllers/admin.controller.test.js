import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Admin from '../../models/admin.model.js';
import Customer from '../../models/customer.model.js';
import Supplier from '../../models/supplier.model.js';
import DeliveryAssociate from '../../models/deliveryAssociate.model.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import { 
  createTestAdmin, 
  createTestCustomer, 
  createTestSupplier,
  createTestDeliveryAssociate 
} from '../helpers.js';

describe('Admin Controller', () => {
  let testAdmin;
  let adminAccessToken;
  let testCustomer;
  let testSupplier;
  let testDeliveryAssociate;
  let customerAccessToken;

  beforeEach(async () => {
    // Create test users
    const adminData = await createTestAdmin();
    testAdmin = adminData.admin;
    adminAccessToken = adminData.accessToken;

    const customerData = await createTestCustomer();
    testCustomer = customerData.customer;
    customerAccessToken = customerData.accessToken;

    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;

    const deliveryData = await createTestDeliveryAssociate();
    testDeliveryAssociate = deliveryData.deliveryAssociate;
  });

  describe('Get Admin Profile', () => {
    it('should get the admin profile', async () => {
      const response = await request(app)
        .get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('admin');
      expect(response.body.data.admin._id.toString()).toBe(testAdmin._id.toString());
      expect(response.body.data.admin.email).toBe(testAdmin.email);
      expect(response.body.data.admin.name).toBe(testAdmin.name);
    });

    it('should not get profile without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/admin/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should not allow non-admins to access admin profile', async () => {
      const response = await request(app)
        .get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Admin Profile', () => {
    it('should update the admin profile', async () => {
      const updateData = {
        name: 'Updated Admin',
        phone: '9876543210'
      };

      const response = await request(app)
        .put('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('admin');
      expect(response.body.data.admin.name).toBe(updateData.name);
      expect(response.body.data.admin.phone).toBe(updateData.phone);

      // Verify the database was updated
      const updatedAdmin = await Admin.findById(testAdmin._id);
      expect(updatedAdmin.name).toBe(updateData.name);
    });

    it('should not update email to an existing email', async () => {
      // Create another admin
      const anotherAdmin = await createTestAdmin({
        email: 'another.admin@example.com',
        name: 'Another Admin'
      });

      const response = await request(app)
        .put('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ email: anotherAdmin.admin.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Management', () => {
    describe('Get Users', () => {
      it('should get all customers', async () => {
        const response = await request(app)
          .get('/api/v1/admin/customers')
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('customers');
        expect(response.body.data.customers.length).toBeGreaterThan(0);
        expect(response.body.data).toHaveProperty('pagination');
      });

      it('should get all suppliers', async () => {
        const response = await request(app)
          .get('/api/v1/admin/suppliers')
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('suppliers');
        expect(response.body.data.suppliers.length).toBeGreaterThan(0);
        expect(response.body.data).toHaveProperty('pagination');
      });

      it('should get all delivery associates', async () => {
        const response = await request(app)
          .get('/api/v1/admin/delivery-associates')
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('deliveryAssociates');
        expect(response.body.data.deliveryAssociates.length).toBeGreaterThan(0);
        expect(response.body.data).toHaveProperty('pagination');
      });

      it('should get a specific customer by ID', async () => {
        const response = await request(app)
          .get(`/api/v1/admin/customers/${testCustomer._id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('customer');
        expect(response.body.data.customer._id.toString()).toBe(testCustomer._id.toString());
      });

      it('should get a specific supplier by ID', async () => {
        const response = await request(app)
          .get(`/api/v1/admin/suppliers/${testSupplier._id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('supplier');
        expect(response.body.data.supplier._id.toString()).toBe(testSupplier._id.toString());
      });

      it('should get a specific delivery associate by ID', async () => {
        const response = await request(app)
          .get(`/api/v1/admin/delivery-associates/${testDeliveryAssociate._id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('deliveryAssociate');
        expect(response.body.data.deliveryAssociate._id.toString()).toBe(testDeliveryAssociate._id.toString());
      });
    });

    describe('Update User Status', () => {
      it('should update a customer status (block/unblock)', async () => {
        const updateData = {
          isActive: false // Block the customer
        };

        const response = await request(app)
          .put(`/api/v1/admin/customers/${testCustomer._id}/status`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('customer');
        expect(response.body.data.customer.isActive).toBe(updateData.isActive);

        // Verify the database was updated
        const updatedCustomer = await Customer.findById(testCustomer._id);
        expect(updatedCustomer.isActive).toBe(updateData.isActive);
      });

      it('should update a supplier status (block/unblock)', async () => {
        const updateData = {
          isActive: false // Block the supplier
        };

        const response = await request(app)
          .put(`/api/v1/admin/suppliers/${testSupplier._id}/status`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('supplier');
        expect(response.body.data.supplier.isActive).toBe(updateData.isActive);

        // Verify the database was updated
        const updatedSupplier = await Supplier.findById(testSupplier._id);
        expect(updatedSupplier.isActive).toBe(updateData.isActive);
      });

      it('should update a delivery associate status (block/unblock)', async () => {
        const updateData = {
          isActive: false // Block the delivery associate
        };

        const response = await request(app)
          .put(`/api/v1/admin/delivery-associates/${testDeliveryAssociate._id}/status`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('deliveryAssociate');
        expect(response.body.data.deliveryAssociate.isActive).toBe(updateData.isActive);

        // Verify the database was updated
        const updatedDeliveryAssociate = await DeliveryAssociate.findById(testDeliveryAssociate._id);
        expect(updatedDeliveryAssociate.isActive).toBe(updateData.isActive);
      });
    });

    describe('Delete User', () => {
      it('should delete a customer', async () => {
        const response = await request(app)
          .delete(`/api/v1/admin/customers/${testCustomer._id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');

        // Verify the database was updated
        const deletedCustomer = await Customer.findById(testCustomer._id);
        expect(deletedCustomer).toBeNull();
      });

      it('should delete a supplier', async () => {
        const response = await request(app)
          .delete(`/api/v1/admin/suppliers/${testSupplier._id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');

        // Verify the database was updated
        const deletedSupplier = await Supplier.findById(testSupplier._id);
        expect(deletedSupplier).toBeNull();
      });

      it('should delete a delivery associate', async () => {
        const response = await request(app)
          .delete(`/api/v1/admin/delivery-associates/${testDeliveryAssociate._id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');

        // Verify the database was updated
        const deletedDeliveryAssociate = await DeliveryAssociate.findById(testDeliveryAssociate._id);
        expect(deletedDeliveryAssociate).toBeNull();
      });
    });
  });

  describe('Order Management', () => {
    let testOrder;

    beforeEach(async () => {
      // Create a test product
      const testProduct = await Product.create({
        name: 'Test Product',
        description: 'Test product description',
        price: 9.99,
        stock: 50,
        category: new mongoose.Types.ObjectId(),
        supplier: testSupplier._id
      });

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

    it('should get all orders', async () => {
      const response = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should get a specific order by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order._id.toString()).toBe(testOrder._id.toString());
    });

    it('should update order status', async () => {
      const updateData = {
        status: 'processing'
      };

      const response = await request(app)
        .put(`/api/v1/admin/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.status).toBe(updateData.status);

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe(updateData.status);
    });

    it('should update payment status', async () => {
      const updateData = {
        paymentStatus: 'completed'
      };

      const response = await request(app)
        .put(`/api/v1/admin/orders/${testOrder._id}/payment-status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.paymentStatus).toBe(updateData.paymentStatus);

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentStatus).toBe(updateData.paymentStatus);
    });
  });

  describe('Dashboard Analytics', () => {
    beforeEach(async () => {
      // Create multiple orders for better analytics
      const testProduct = await Product.create({
        name: 'Test Product',
        description: 'Test product description',
        price: 9.99,
        stock: 50,
        category: new mongoose.Types.ObjectId(),
        supplier: testSupplier._id
      });

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
        .get('/api/v1/admin/analytics/sales')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
      expect(response.body.data.totalSales).toBeGreaterThan(0);
    });

    it('should get user analytics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/users')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCustomers');
      expect(response.body.data).toHaveProperty('totalSuppliers');
      expect(response.body.data).toHaveProperty('totalDeliveryAssociates');
      expect(response.body.data).toHaveProperty('userGrowth');
      expect(response.body.data.totalCustomers).toBeGreaterThan(0);
      expect(response.body.data.totalSuppliers).toBeGreaterThan(0);
      expect(response.body.data.totalDeliveryAssociates).toBeGreaterThan(0);
    });

    it('should get order analytics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('ordersByStatus');
      expect(response.body.data.totalOrders).toBeGreaterThan(0);
      expect(Object.keys(response.body.data.ordersByStatus).length).toBeGreaterThan(0);
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/v1/admin/analytics/sales?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('salesByPeriod');
    });
  });

  describe('Admin Settings', () => {
    it('should update site settings', async () => {
      const settingsData = {
        siteName: 'FarmFerry Test',
        contactEmail: 'test@farmferry.com',
        supportPhone: '1234567890',
        maintenanceMode: false,
        defaultCommissionRate: 10
      };

      const response = await request(app)
        .put('/api/v1/admin/settings/site')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settings');
      expect(response.body.data.settings.siteName).toBe(settingsData.siteName);
      expect(response.body.data.settings.contactEmail).toBe(settingsData.contactEmail);
    });

    it('should get site settings', async () => {
      // First update settings
      const settingsData = {
        siteName: 'FarmFerry Test',
        contactEmail: 'test@farmferry.com'
      };

      await request(app)
        .put('/api/v1/admin/settings/site')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(settingsData);

      // Now get settings
      const response = await request(app)
        .get('/api/v1/admin/settings/site')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settings');
      expect(response.body.data.settings.siteName).toBe(settingsData.siteName);
    });

    it('should update payment settings', async () => {
      const settingsData = {
        paymentGateways: {
          stripe: {
            enabled: true,
            testMode: true
          },
          paypal: {
            enabled: false
          }
        },
        currencyCode: 'USD',
        currencySymbol: '$'
      };

      const response = await request(app)
        .put('/api/v1/admin/settings/payment')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settings');
      expect(response.body.data.settings.paymentGateways.stripe.enabled).toBe(settingsData.paymentGateways.stripe.enabled);
      expect(response.body.data.settings.currencyCode).toBe(settingsData.currencyCode);
    });
  });

  describe('Create Admin', () => {
    it('should allow super admin to create a new admin', async () => {
      // First make the test admin a super admin
      await Admin.findByIdAndUpdate(testAdmin._id, { role: 'super_admin' });

      const newAdminData = {
        name: 'New Admin',
        email: 'new.admin@example.com',
        password: 'Password123!',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/v1/admin/create')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newAdminData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('admin');
      expect(response.body.data.admin.name).toBe(newAdminData.name);
      expect(response.body.data.admin.email).toBe(newAdminData.email);
      expect(response.body.data.admin.role).toBe(newAdminData.role);

      // Verify the database was updated
      const newAdmin = await Admin.findOne({ email: newAdminData.email });
      expect(newAdmin).toBeTruthy();
      expect(newAdmin.name).toBe(newAdminData.name);
    });

    it('should not allow regular admin to create a new admin', async () => {
      // Ensure the test admin is a regular admin
      await Admin.findByIdAndUpdate(testAdmin._id, { role: 'admin' });

      const newAdminData = {
        name: 'New Admin',
        email: 'new.admin@example.com',
        password: 'Password123!',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/v1/admin/create')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newAdminData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not create admin with duplicate email', async () => {
      // First make the test admin a super admin
      await Admin.findByIdAndUpdate(testAdmin._id, { role: 'super_admin' });

      const newAdminData = {
        name: 'Duplicate Admin',
        email: testAdmin.email, // Duplicate email
        password: 'Password123!',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/v1/admin/create')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newAdminData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });
});
