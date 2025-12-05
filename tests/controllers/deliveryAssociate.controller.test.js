import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import DeliveryAssociate from '../../models/deliveryAssociate.model.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import { 
  createTestDeliveryAssociate, 
  createTestCustomer, 
  createTestSupplier,
  createTestAdmin 
} from '../helpers.js';

describe('Delivery Associate Controller', () => {
  let testDeliveryAssociate;
  let deliveryAccessToken;
  let testCustomer;
  let testSupplier;
  let adminAccessToken;
  let testOrder;

  beforeEach(async () => {
    // Create test users
    const deliveryData = await createTestDeliveryAssociate();
    testDeliveryAssociate = deliveryData.deliveryAssociate;
    deliveryAccessToken = deliveryData.accessToken;

    const customerData = await createTestCustomer();
    testCustomer = customerData.customer;

    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;

    const adminData = await createTestAdmin();
    adminAccessToken = adminData.accessToken;

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
      status: 'processing',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deliveryAssociate: testDeliveryAssociate._id
    });
  });

  describe('Get Delivery Associate Profile', () => {
    it('should get the delivery associate profile', async () => {
      const response = await request(app)
        .get('/api/v1/delivery-associates/profile')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveryAssociate');
      expect(response.body.data.deliveryAssociate._id.toString()).toBe(testDeliveryAssociate._id.toString());
      expect(response.body.data.deliveryAssociate.email).toBe(testDeliveryAssociate.email);
      expect(response.body.data.deliveryAssociate.name).toBe(testDeliveryAssociate.name);
    });

    it('should not get profile without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/delivery-associates/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Delivery Associate Profile', () => {
    it('should update the delivery associate profile', async () => {
      const updateData = {
        name: 'Updated Delivery Associate',
        phone: '9876543210',
        vehicleType: 'car',
        vehicleNumber: 'ABC123'
      };

      const response = await request(app)
        .put('/api/v1/delivery-associates/profile')
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveryAssociate');
      expect(response.body.data.deliveryAssociate.name).toBe(updateData.name);
      expect(response.body.data.deliveryAssociate.phone).toBe(updateData.phone);
      expect(response.body.data.deliveryAssociate.vehicleType).toBe(updateData.vehicleType);
      expect(response.body.data.deliveryAssociate.vehicleNumber).toBe(updateData.vehicleNumber);

      // Verify the database was updated
      const updatedDeliveryAssociate = await DeliveryAssociate.findById(testDeliveryAssociate._id);
      expect(updatedDeliveryAssociate.name).toBe(updateData.name);
    });

    it('should not update email to an existing email', async () => {
      // Create another delivery associate
      const anotherDeliveryAssociate = await createTestDeliveryAssociate({
        email: 'another.delivery@example.com',
        name: 'Another Delivery'
      });

      const response = await request(app)
        .put('/api/v1/delivery-associates/profile')
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send({ email: anotherDeliveryAssociate.deliveryAssociate.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Location', () => {
    it('should update the delivery associate location', async () => {
      const locationData = {
        latitude: 37.7749,
        longitude: -122.4194
      };

      const response = await request(app)
        .put('/api/v1/delivery-associates/location')
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send(locationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveryAssociate');
      expect(response.body.data.deliveryAssociate.location.coordinates[0]).toBe(locationData.longitude);
      expect(response.body.data.deliveryAssociate.location.coordinates[1]).toBe(locationData.latitude);

      // Verify the database was updated
      const updatedDeliveryAssociate = await DeliveryAssociate.findById(testDeliveryAssociate._id);
      expect(updatedDeliveryAssociate.location.coordinates[0]).toBe(locationData.longitude);
      expect(updatedDeliveryAssociate.location.coordinates[1]).toBe(locationData.latitude);
    });

    it('should validate location data', async () => {
      // Invalid latitude (outside range)
      const invalidLocationData = {
        latitude: 100, // Invalid (> 90)
        longitude: -122.4194
      };

      const response = await request(app)
        .put('/api/v1/delivery-associates/location')
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send(invalidLocationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Availability', () => {
    it('should update the delivery associate availability', async () => {
      const availabilityData = {
        isAvailable: true
      };

      const response = await request(app)
        .put('/api/v1/delivery-associates/availability')
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send(availabilityData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveryAssociate');
      expect(response.body.data.deliveryAssociate.isAvailable).toBe(availabilityData.isAvailable);

      // Verify the database was updated
      const updatedDeliveryAssociate = await DeliveryAssociate.findById(testDeliveryAssociate._id);
      expect(updatedDeliveryAssociate.isAvailable).toBe(availabilityData.isAvailable);
    });
  });

  describe('Get Assigned Orders', () => {
    it('should get all orders assigned to the delivery associate', async () => {
      const response = await request(app)
        .get('/api/v1/delivery-associates/orders')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data.orders[0].deliveryAssociate.toString()).toBe(testDeliveryAssociate._id.toString());
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/v1/delivery-associates/orders?status=processing')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data.orders[0].status).toBe('processing');
    });

    it('should get a specific order by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/delivery-associates/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order._id.toString()).toBe(testOrder._id.toString());
      expect(response.body.data.order.deliveryAssociate.toString()).toBe(testDeliveryAssociate._id.toString());
    });

    it('should not allow delivery associate to view orders not assigned to them', async () => {
      // Create another delivery associate
      const anotherDeliveryAssociate = await createTestDeliveryAssociate({
        email: 'another.delivery@example.com',
        name: 'Another Delivery'
      });

      const response = await request(app)
        .get(`/api/v1/delivery-associates/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${anotherDeliveryAssociate.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Order Delivery Status', () => {
    it('should update the delivery status of an assigned order', async () => {
      const updateData = {
        deliveryStatus: 'in_transit'
      };

      const response = await request(app)
        .put(`/api/v1/delivery-associates/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
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

    it('should mark order as delivered and update order status', async () => {
      const updateData = {
        deliveryStatus: 'delivered'
      };

      const response = await request(app)
        .put(`/api/v1/delivery-associates/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.deliveryStatus).toBe(updateData.deliveryStatus);
      expect(response.body.data.order.status).toBe('delivered');

      // Verify the database was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.deliveryStatus).toBe(updateData.deliveryStatus);
      expect(updatedOrder.status).toBe('delivered');
    });

    it('should not allow invalid delivery status transitions', async () => {
      // First update to delivered
      await request(app)
        .put(`/api/v1/delivery-associates/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send({ deliveryStatus: 'delivered' });

      // Try to update back to in_transit (invalid transition)
      const updateData = {
        deliveryStatus: 'in_transit'
      };

      const response = await request(app)
        .put(`/api/v1/delivery-associates/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${deliveryAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('transition');
    });

    it('should not allow delivery associate to update orders not assigned to them', async () => {
      // Create another delivery associate
      const anotherDeliveryAssociate = await createTestDeliveryAssociate({
        email: 'another.delivery@example.com',
        name: 'Another Delivery'
      });

      const updateData = {
        deliveryStatus: 'in_transit'
      };

      const response = await request(app)
        .put(`/api/v1/delivery-associates/orders/${testOrder._id}/delivery-status`)
        .set('Authorization', `Bearer ${anotherDeliveryAssociate.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Delivery Analytics', () => {
    beforeEach(async () => {
      // Create multiple orders with different statuses
      const testProduct = await Product.create({
        name: 'Another Test Product',
        description: 'Another test product description',
        price: 19.99,
        stock: 30,
        category: new mongoose.Types.ObjectId(),
        supplier: testSupplier._id
      });

      for (let i = 0; i < 3; i++) {
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
          status: 'delivered',
          paymentMethod: 'cod',
          paymentStatus: 'completed',
          deliveryAssociate: testDeliveryAssociate._id,
          deliveryStatus: 'delivered',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Different dates
          deliveredAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000) // 2 hours after creation
        });
      }
    });

    it('should get delivery analytics', async () => {
      const response = await request(app)
        .get('/api/v1/delivery-associates/analytics')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalDeliveries');
      expect(response.body.data).toHaveProperty('deliveriesByStatus');
      expect(response.body.data).toHaveProperty('deliveriesByPeriod');
      expect(response.body.data.totalDeliveries).toBeGreaterThan(0);
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/v1/delivery-associates/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalDeliveries');
      expect(response.body.data).toHaveProperty('deliveriesByPeriod');
    });
  });

  describe('Find Nearby Delivery Associates', () => {
    beforeEach(async () => {
      // Update the test delivery associate location
      await DeliveryAssociate.findByIdAndUpdate(testDeliveryAssociate._id, {
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749] // San Francisco coordinates
        },
        isAvailable: true
      });

      // Create another delivery associate with a nearby location
      await DeliveryAssociate.create({
        name: 'Nearby Associate',
        email: 'nearby@example.com',
        password: '$2a$10$EncryptedPasswordHash',
        phone: '9876543210',
        vehicleType: 'bike',
        vehicleNumber: 'XYZ789',
        location: {
          type: 'Point',
          coordinates: [-122.4184, 37.7739] // Very close to San Francisco coordinates
        },
        isAvailable: true
      });

      // Create another delivery associate with a far location
      await DeliveryAssociate.create({
        name: 'Far Associate',
        email: 'far@example.com',
        password: '$2a$10$EncryptedPasswordHash',
        phone: '5432109876',
        vehicleType: 'car',
        vehicleNumber: 'ABC456',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128] // New York coordinates (far away)
        },
        isAvailable: true
      });
    });

    it('should find nearby delivery associates', async () => {
      const queryParams = {
        latitude: 37.7749,
        longitude: -122.4194,
        maxDistance: 10000 // 10 km
      };

      const response = await request(app)
        .get(`/api/v1/delivery-associates/nearby?latitude=${queryParams.latitude}&longitude=${queryParams.longitude}&maxDistance=${queryParams.maxDistance}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveryAssociates');
      expect(response.body.data.deliveryAssociates.length).toBe(2); // Should find 2 associates (test and nearby)
      
      // The first one should be the closest
      const distances = response.body.data.deliveryAssociates.map(da => da.distance);
      expect(distances[0]).toBeLessThan(distances[1]);
    });

    it('should only find available delivery associates', async () => {
      // Make the test delivery associate unavailable
      await DeliveryAssociate.findByIdAndUpdate(testDeliveryAssociate._id, {
        isAvailable: false
      });

      const queryParams = {
        latitude: 37.7749,
        longitude: -122.4194,
        maxDistance: 10000 // 10 km
      };

      const response = await request(app)
        .get(`/api/v1/delivery-associates/nearby?latitude=${queryParams.latitude}&longitude=${queryParams.longitude}&maxDistance=${queryParams.maxDistance}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deliveryAssociates');
      expect(response.body.data.deliveryAssociates.length).toBe(1); // Should only find the nearby associate
      expect(response.body.data.deliveryAssociates[0].name).toBe('Nearby Associate');
    });

    it('should validate location parameters', async () => {
      // Invalid latitude
      const response = await request(app)
        .get('/api/v1/delivery-associates/nearby?latitude=100&longitude=-122.4194&maxDistance=10000')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not allow unauthorized access', async () => {
      const queryParams = {
        latitude: 37.7749,
        longitude: -122.4194,
        maxDistance: 10000
      };

      const response = await request(app)
        .get(`/api/v1/delivery-associates/nearby?latitude=${queryParams.latitude}&longitude=${queryParams.longitude}&maxDistance=${queryParams.maxDistance}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
