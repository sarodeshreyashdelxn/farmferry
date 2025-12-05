import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Coupon from '../../models/coupon.model.js';
import { 
  createTestAdmin, 
  createTestCustomer, 
  createTestSupplier 
} from '../helpers.js';

describe('Coupon Controller', () => {
  let testAdmin;
  let adminAccessToken;
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let testCoupon;

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
    supplierAccessToken = supplierData.accessToken;

    // Create a test coupon
    testCoupon = await Coupon.create({
      code: 'TEST10',
      type: 'percentage',
      value: 10,
      minPurchase: 50,
      maxDiscount: 100,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
      createdBy: testAdmin._id
    });
  });

  describe('Create Coupon', () => {
    it('should allow admin to create a new coupon', async () => {
      const couponData = {
        code: 'NEW20',
        type: 'percentage',
        value: 20,
        minPurchase: 100,
        maxDiscount: 200,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: 50,
        isActive: true
      };

      const response = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(couponData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupon');
      expect(response.body.data.coupon.code).toBe(couponData.code);
      expect(response.body.data.coupon.value).toBe(couponData.value);

      // Verify the database was updated
      const newCoupon = await Coupon.findOne({ code: couponData.code });
      expect(newCoupon).toBeTruthy();
      expect(newCoupon.type).toBe(couponData.type);
    });

    it('should not allow duplicate coupon codes', async () => {
      const couponData = {
        code: 'TEST10', // Already exists
        type: 'percentage',
        value: 15,
        minPurchase: 75,
        maxDiscount: 150,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: 50,
        isActive: true
      };

      const response = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(couponData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate coupon data', async () => {
      const invalidCouponData = {
        code: 'INVALID',
        type: 'percentage',
        value: 120, // Invalid percentage (> 100)
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(invalidCouponData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not allow non-admin to create coupons', async () => {
      const couponData = {
        code: 'CUSTOMER10',
        type: 'percentage',
        value: 10,
        minPurchase: 50,
        maxDiscount: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: 100,
        isActive: true
      };

      const response = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(couponData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Coupons', () => {
    it('should allow admin to get all coupons', async () => {
      const response = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupons');
      expect(response.body.data.coupons.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should allow customers to get active coupons', async () => {
      const response = await request(app)
        .get('/api/v1/coupons/active')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupons');
      expect(response.body.data.coupons.length).toBeGreaterThan(0);
      expect(response.body.data.coupons[0].isActive).toBe(true);
    });

    it('should get a specific coupon by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/coupons/${testCoupon._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupon');
      expect(response.body.data.coupon._id.toString()).toBe(testCoupon._id.toString());
      expect(response.body.data.coupon.code).toBe(testCoupon.code);
    });

    it('should get a specific coupon by code', async () => {
      const response = await request(app)
        .get(`/api/v1/coupons/code/${testCoupon.code}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupon');
      expect(response.body.data.coupon.code).toBe(testCoupon.code);
    });

    it('should return 404 for non-existent coupon code', async () => {
      const response = await request(app)
        .get('/api/v1/coupons/code/NONEXISTENT')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Coupon', () => {
    it('should allow admin to update a coupon', async () => {
      const updateData = {
        value: 15,
        minPurchase: 75,
        maxDiscount: 150,
        isActive: false
      };

      const response = await request(app)
        .put(`/api/v1/coupons/${testCoupon._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupon');
      expect(response.body.data.coupon.value).toBe(updateData.value);
      expect(response.body.data.coupon.minPurchase).toBe(updateData.minPurchase);
      expect(response.body.data.coupon.isActive).toBe(updateData.isActive);

      // Verify the database was updated
      const updatedCoupon = await Coupon.findById(testCoupon._id);
      expect(updatedCoupon.value).toBe(updateData.value);
      expect(updatedCoupon.isActive).toBe(updateData.isActive);
    });

    it('should not allow changing coupon code to existing code', async () => {
      // Create another coupon
      await Coupon.create({
        code: 'ANOTHER20',
        type: 'percentage',
        value: 20,
        minPurchase: 100,
        maxDiscount: 200,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: 50,
        usedCount: 0,
        isActive: true,
        createdBy: testAdmin._id
      });

      const updateData = {
        code: 'ANOTHER20' // Already exists
      };

      const response = await request(app)
        .put(`/api/v1/coupons/${testCoupon._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should not allow non-admin to update coupons', async () => {
      const updateData = {
        value: 25,
        isActive: false
      };

      const response = await request(app)
        .put(`/api/v1/coupons/${testCoupon._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Delete Coupon', () => {
    it('should allow admin to delete a coupon', async () => {
      const response = await request(app)
        .delete(`/api/v1/coupons/${testCoupon._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedCoupon = await Coupon.findById(testCoupon._id);
      expect(deletedCoupon).toBeNull();
    });

    it('should not allow non-admin to delete coupons', async () => {
      const response = await request(app)
        .delete(`/api/v1/coupons/${testCoupon._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent coupon', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/v1/coupons/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Validate Coupon', () => {
    it('should validate a valid coupon', async () => {
      const response = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code,
          cartTotal: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('coupon');
      expect(response.body.data).toHaveProperty('discount');
      expect(response.body.data.coupon.code).toBe(testCoupon.code);
      expect(response.body.data.discount).toBe(10); // 10% of 100
    });

    it('should not validate an inactive coupon', async () => {
      // Make the coupon inactive
      await Coupon.findByIdAndUpdate(testCoupon._id, { isActive: false });

      const response = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code,
          cartTotal: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('inactive');
    });

    it('should not validate an expired coupon', async () => {
      // Make the coupon expired
      await Coupon.findByIdAndUpdate(testCoupon._id, {
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      });

      const response = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code,
          cartTotal: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    it('should not validate a coupon with insufficient cart total', async () => {
      const response = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code,
          cartTotal: 40 // Below minPurchase of 50
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('minimum purchase');
    });

    it('should respect maxDiscount for percentage coupons', async () => {
      const response = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code,
          cartTotal: 2000 // 10% would be 200, but maxDiscount is 100
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('discount');
      expect(response.body.data.discount).toBe(100); // Capped at maxDiscount
    });

    it('should handle fixed amount coupons correctly', async () => {
      // Create a fixed amount coupon
      const fixedCoupon = await Coupon.create({
        code: 'FIXED25',
        type: 'fixed',
        value: 25,
        minPurchase: 50,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
        createdBy: testAdmin._id
      });

      const response = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: fixedCoupon.code,
          cartTotal: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('discount');
      expect(response.body.data.discount).toBe(25); // Fixed amount
    });
  });

  describe('Apply Coupon to Cart', () => {
    it('should apply a valid coupon to the cart', async () => {
      const response = await request(app)
        .post('/api/v1/coupons/apply')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart).toHaveProperty('coupon');
      expect(response.body.data.cart.coupon.code).toBe(testCoupon.code);
      expect(response.body.data.cart).toHaveProperty('discount');
    });

    it('should not apply an invalid coupon to the cart', async () => {
      const response = await request(app)
        .post('/api/v1/coupons/apply')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: 'INVALID'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should not apply a coupon if cart total is below minimum purchase', async () => {
      // Create a cart with low total
      await request(app)
        .post('/api/v1/cart/clear')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      const response = await request(app)
        .post('/api/v1/coupons/apply')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('minimum purchase');
    });

    it('should remove applied coupon from cart', async () => {
      // First apply a coupon
      await request(app)
        .post('/api/v1/coupons/apply')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          code: testCoupon.code
        });

      // Then remove it
      const response = await request(app)
        .delete('/api/v1/coupons/remove')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.coupon).toBeUndefined();
      expect(response.body.data.cart.discount).toBe(0);
    });
  });
});
