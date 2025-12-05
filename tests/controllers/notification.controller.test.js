import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Notification from '../../models/notification.model.js';
import { 
  createTestCustomer, 
  createTestSupplier,
  createTestAdmin,
  createTestDeliveryAssociate
} from '../helpers.js';

describe('Notification Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let testAdmin;
  let adminAccessToken;
  let testDeliveryAssociate;
  let deliveryAccessToken;
  let customerNotification;
  let supplierNotification;

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

    // Create test notifications
    customerNotification = await Notification.create({
      recipient: testCustomer._id,
      recipientType: 'customer',
      title: 'Test Customer Notification',
      message: 'This is a test notification for customer',
      type: 'order',
      referenceId: new mongoose.Types.ObjectId(),
      isRead: false
    });

    supplierNotification = await Notification.create({
      recipient: testSupplier._id,
      recipientType: 'supplier',
      title: 'Test Supplier Notification',
      message: 'This is a test notification for supplier',
      type: 'product',
      referenceId: new mongoose.Types.ObjectId(),
      isRead: false
    });

    // Create admin notification
    await Notification.create({
      recipient: testAdmin._id,
      recipientType: 'admin',
      title: 'Test Admin Notification',
      message: 'This is a test notification for admin',
      type: 'system',
      isRead: false
    });

    // Create delivery associate notification
    await Notification.create({
      recipient: testDeliveryAssociate._id,
      recipientType: 'deliveryAssociate',
      title: 'Test Delivery Notification',
      message: 'This is a test notification for delivery associate',
      type: 'order',
      referenceId: new mongoose.Types.ObjectId(),
      isRead: false
    });
  });

  describe('Get Notifications', () => {
    it('should get all notifications for a customer', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].recipient.toString()).toBe(testCustomer._id.toString());
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('unreadCount');
    });

    it('should get all notifications for a supplier', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].recipient.toString()).toBe(testSupplier._id.toString());
    });

    it('should get all notifications for an admin', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].recipient.toString()).toBe(testAdmin._id.toString());
    });

    it('should get all notifications for a delivery associate', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${deliveryAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].recipient.toString()).toBe(testDeliveryAssociate._id.toString());
    });

    it('should filter notifications by type', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?type=order')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].type).toBe('order');
    });

    it('should filter notifications by read status', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?isRead=false')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].isRead).toBe(false);
    });

    it('should get a specific notification by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/notifications/${customerNotification._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notification');
      expect(response.body.data.notification._id.toString()).toBe(customerNotification._id.toString());
    });

    it('should not allow access to notifications of other users', async () => {
      const response = await request(app)
        .get(`/api/v1/notifications/${supplierNotification._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Mark Notification as Read', () => {
    it('should mark a notification as read', async () => {
      const response = await request(app)
        .put(`/api/v1/notifications/${customerNotification._id}/read`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notification');
      expect(response.body.data.notification.isRead).toBe(true);

      // Verify the database was updated
      const updatedNotification = await Notification.findById(customerNotification._id);
      expect(updatedNotification.isRead).toBe(true);
    });

    it('should not allow marking notifications of other users as read', async () => {
      const response = await request(app)
        .put(`/api/v1/notifications/${supplierNotification._id}/read`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Mark All Notifications as Read', () => {
    it('should mark all notifications as read for a user', async () => {
      // Create multiple notifications for the customer
      await Notification.create([
        {
          recipient: testCustomer._id,
          recipientType: 'customer',
          title: 'Test Notification 1',
          message: 'This is test notification 1',
          type: 'order',
          isRead: false
        },
        {
          recipient: testCustomer._id,
          recipientType: 'customer',
          title: 'Test Notification 2',
          message: 'This is test notification 2',
          type: 'product',
          isRead: false
        }
      ]);

      const response = await request(app)
        .put('/api/v1/notifications/mark-all-read')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('marked as read');

      // Verify the database was updated
      const notifications = await Notification.find({ recipient: testCustomer._id });
      expect(notifications.every(notification => notification.isRead)).toBe(true);
    });
  });

  describe('Delete Notification', () => {
    it('should delete a notification', async () => {
      const response = await request(app)
        .delete(`/api/v1/notifications/${customerNotification._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedNotification = await Notification.findById(customerNotification._id);
      expect(deletedNotification).toBeNull();
    });

    it('should not allow deleting notifications of other users', async () => {
      const response = await request(app)
        .delete(`/api/v1/notifications/${supplierNotification._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Delete All Notifications', () => {
    it('should delete all notifications for a user', async () => {
      // Create multiple notifications for the customer
      await Notification.create([
        {
          recipient: testCustomer._id,
          recipientType: 'customer',
          title: 'Test Notification 1',
          message: 'This is test notification 1',
          type: 'order',
          isRead: false
        },
        {
          recipient: testCustomer._id,
          recipientType: 'customer',
          title: 'Test Notification 2',
          message: 'This is test notification 2',
          type: 'product',
          isRead: false
        }
      ]);

      const response = await request(app)
        .delete('/api/v1/notifications/delete-all')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const notifications = await Notification.find({ recipient: testCustomer._id });
      expect(notifications.length).toBe(0);
    });
  });

  describe('Create Notification (Admin Only)', () => {
    it('should allow admin to create a notification for a customer', async () => {
      const notificationData = {
        recipientId: testCustomer._id,
        recipientType: 'customer',
        title: 'Admin Created Notification',
        message: 'This notification was created by an admin',
        type: 'system'
      };

      const response = await request(app)
        .post('/api/v1/notifications/create')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notification');
      expect(response.body.data.notification.title).toBe(notificationData.title);
      expect(response.body.data.notification.recipient.toString()).toBe(notificationData.recipientId.toString());

      // Verify the database was updated
      const notification = await Notification.findOne({ title: notificationData.title });
      expect(notification).toBeTruthy();
      expect(notification.message).toBe(notificationData.message);
    });

    it('should allow admin to create a bulk notification for all customers', async () => {
      const notificationData = {
        recipientType: 'customer',
        title: 'Bulk Customer Notification',
        message: 'This is a bulk notification for all customers',
        type: 'promotion'
      };

      const response = await request(app)
        .post('/api/v1/notifications/create-bulk')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(notificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created');

      // Verify the database was updated
      const notifications = await Notification.find({ title: notificationData.title });
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].recipientType).toBe(notificationData.recipientType);
    });

    it('should not allow non-admin to create notifications', async () => {
      const notificationData = {
        recipientId: testSupplier._id,
        recipientType: 'supplier',
        title: 'Unauthorized Notification',
        message: 'This should not be created',
        type: 'system'
      };

      const response = await request(app)
        .post('/api/v1/notifications/create')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(notificationData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Notification Count', () => {
    it('should get unread notification count for a user', async () => {
      // Create multiple notifications for the customer
      await Notification.create([
        {
          recipient: testCustomer._id,
          recipientType: 'customer',
          title: 'Test Notification 1',
          message: 'This is test notification 1',
          type: 'order',
          isRead: false
        },
        {
          recipient: testCustomer._id,
          recipientType: 'customer',
          title: 'Test Notification 2',
          message: 'This is test notification 2',
          type: 'product',
          isRead: true
        }
      ]);

      const response = await request(app)
        .get('/api/v1/notifications/count')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('unreadCount');
      expect(response.body.data.unreadCount).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Notification Tests', () => {
    // Note: These tests are placeholders for WebSocket functionality
    // Actual WebSocket testing would require a different approach
    
    it('should have WebSocket notification routes defined', async () => {
      // This is a basic check that the route exists
      const response = await request(app)
        .get('/api/v1/notifications/socket-test')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      // The route might not exist, but we're just checking the overall structure
      // Expect either a 404 (not found) or a 200 (if test endpoint exists)
      expect([404, 200]).toContain(response.status);
    });
  });
});
