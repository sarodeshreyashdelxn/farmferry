import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { 
  createTestCustomer, 
  createTestSupplier, 
  createTestAdmin,
  createTestDeliveryAssociate
} from '../helpers.js';

describe('Order Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let adminAccessToken;
  let deliveryAssociateAccessToken;
  let testCategory;
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
    adminAccessToken = adminData.accessToken;

    const deliveryData = await createTestDeliveryAssociate();
    deliveryAssociateAccessToken = deliveryData.accessToken;

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

  describe('Create Order', () => {
    const orderData = {
      items: [], // Will be filled in the test
      shippingAddress: {
        name: 'Home',
        street: '123 Main St',
        city: 'Cityville',
        state: 'Stateland',
        postalCode: '12345',
        country: 'Countryland'
      },
      paymentMethod: 'cod'
    };

    it('should create a new order', async () => {
      const data = {
        ...orderData,
        items: [
          {
            product: testProduct._id,
            quantity: 2
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.customer.toString()).toBe(testCustomer._id.toString());
      expect(response.body.data.order.items.length).toBe(1);
      expect(response.body.data.order.items[0].product.toString()).toBe(testProduct._id.toString());
      expect(response.body.data.order.items[0].quantity).toBe(2);
      expect(response.body.data.order.totalAmount).toBe(testProduct.price * 2);
      expect(response.body.data.order.status).toBe('pending');

      // Verify the database was updated
      const order = await Order.findById(response.body.data.order._id);
      expect(order).toBeTruthy();
      expect(order.status).toBe('pending');

      // Verify product stock was updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.stock).toBe(testProduct.stock - 2);
    });

    it('should not create an order with insufficient stock', async () => {
      const data = {
        ...orderData,
        items: [
          {
            product: testProduct._id,
            quantity: testProduct.stock + 10 // Exceeds stock
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('stock');
    });

    it('should not create an order with invalid product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const data = {
        ...orderData,
        items: [
          {
            product: fakeId,
            quantity: 2
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should not allow non-customers to create orders', async () => {
      const data = {
        ...orderData,
        items: [
          {
            product: testProduct._id,
            quantity: 2
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(data);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Orders', () => {
    it('should get all orders as admin', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should not allow non-admins to get all orders', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should get a single order by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order._id.toString()).toBe(testOrder._id.toString());
      expect(response.body.data.order.customer._id.toString()).toBe(testCustomer._id.toString());
    });

    it('should allow suppliers to view their orders', async () => {
      const response = await request(app)
        .get(`/api/v1/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
    });

    it('should not allow customers to view other customers\' orders', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com'
      });

      const response = await request(app)
        .get(`/api/v1/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${anotherCustomer.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Order Status', () => {
    it('should allow supplier to update order status', async () => {
      const updateData = {
        status: 'processing'
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.status).toBe(updateData.status);

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe(updateData.status);
      expect(updatedOrder.statusHistory.length).toBeGreaterThan(0);
      expect(updatedOrder.statusHistory[0].status).toBe(updateData.status);
    });

    it('should allow admin to update order status', async () => {
      const updateData = {
        status: 'processing'
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.status).toBe(updateData.status);
    });

    it('should allow customer to cancel their order', async () => {
      const updateData = {
        status: 'cancelled'
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.status).toBe(updateData.status);

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe(updateData.status);
    });

    it('should not allow invalid status transitions', async () => {
      // First update to processing
      await request(app)
        .put(`/api/v1/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send({ status: 'processing' });

      // Try to update back to pending (invalid transition)
      const updateData = {
        status: 'pending'
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('transition');
    });
  });

  describe('Assign Delivery Associate', () => {
    it('should assign a delivery associate to an order', async () => {
      // Create a delivery associate
      const deliveryData = await createTestDeliveryAssociate();
      const deliveryAssociate = deliveryData.deliveryAssociate;

      const updateData = {
        deliveryAssociateId: deliveryAssociate._id
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/assign-delivery`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.deliveryAssociate.toString()).toBe(deliveryAssociate._id.toString());

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.deliveryAssociate.toString()).toBe(deliveryAssociate._id.toString());
    });

    it('should not assign a delivery associate to a cancelled order', async () => {
      // First cancel the order
      await request(app)
        .put(`/api/v1/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ status: 'cancelled' });

      // Create a delivery associate
      const deliveryData = await createTestDeliveryAssociate();
      const deliveryAssociate = deliveryData.deliveryAssociate;

      const updateData = {
        deliveryAssociateId: deliveryAssociate._id
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/assign-delivery`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cancelled');
    });

    it('should not allow customers to assign delivery associates', async () => {
      // Create a delivery associate
      const deliveryData = await createTestDeliveryAssociate();
      const deliveryAssociate = deliveryData.deliveryAssociate;

      const updateData = {
        deliveryAssociateId: deliveryAssociate._id
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/assign-delivery`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Delivery Status', () => {
    it('should update delivery status as delivery associate', async () => {
      // First assign a delivery associate
      const deliveryData = await createTestDeliveryAssociate();
      const deliveryAssociate = deliveryData.deliveryAssociate;

      await Order.findByIdAndUpdate(testOrder._id, {
        deliveryAssociate: deliveryAssociate._id,
        status: 'shipped'
      });

      const updateData = {
        deliveryStatus: 'in_transit'
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${deliveryData.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.deliveryStatus).toBe(updateData.deliveryStatus);

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.deliveryStatus).toBe(updateData.deliveryStatus);
      expect(updatedOrder.deliveryStatusHistory.length).toBeGreaterThan(0);
      expect(updatedOrder.deliveryStatusHistory[0].status).toBe(updateData.deliveryStatus);
    });

    it('should not allow delivery status update for unassigned delivery associate', async () => {
      // Create a different delivery associate
      const anotherDelivery = await createTestDeliveryAssociate({
        email: 'another.delivery@example.com'
      });

      // First assign a delivery associate
      const deliveryData = await createTestDeliveryAssociate();
      const deliveryAssociate = deliveryData.deliveryAssociate;

      await Order.findByIdAndUpdate(testOrder._id, {
        deliveryAssociate: deliveryAssociate._id,
        status: 'shipped'
      });

      const updateData = {
        deliveryStatus: 'in_transit'
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${anotherDelivery.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow invalid delivery status transitions', async () => {
      // First assign a delivery associate
      const deliveryData = await createTestDeliveryAssociate();
      const deliveryAssociate = deliveryData.deliveryAssociate;

      await Order.findByIdAndUpdate(testOrder._id, {
        deliveryAssociate: deliveryAssociate._id,
        status: 'shipped',
        deliveryStatus: 'delivered' // Already delivered
      });

      const updateData = {
        deliveryStatus: 'in_transit' // Can't go back to in_transit
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${deliveryData.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('transition');
    });
  });
});
