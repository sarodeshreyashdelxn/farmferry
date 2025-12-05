import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Review from '../../models/review.model.js';
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import Order from '../../models/order.model.js';
import { createTestCustomer, createTestSupplier, createTestAdmin } from '../helpers.js';

describe('Review Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let adminAccessToken;
  let testCategory;
  let testProduct;
  let testOrder;
  let testReview;

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

    // Create a test order (delivered)
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
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'completed',
      deliveryStatus: 'delivered'
    });

    // Create a test review
    testReview = await Review.create({
      product: testProduct._id,
      customer: testCustomer._id,
      rating: 4,
      title: 'Great product',
      comment: 'This is a great product, very satisfied!',
      verified: true
    });
  });

  describe('Create Review', () => {
    const reviewData = {
      rating: 5,
      title: 'Excellent product',
      comment: 'One of the best products I have ever purchased!'
    };

    it('should create a new review as a customer who purchased the product', async () => {
      const data = {
        ...reviewData,
        productId: testProduct._id
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.product.toString()).toBe(testProduct._id.toString());
      expect(response.body.data.review.customer.toString()).toBe(testCustomer._id.toString());
      expect(response.body.data.review.rating).toBe(data.rating);
      expect(response.body.data.review.title).toBe(data.title);
      expect(response.body.data.review.verified).toBe(true); // Should be verified since customer purchased the product

      // Verify the database was updated
      const review = await Review.findById(response.body.data.review._id);
      expect(review).toBeTruthy();
      expect(review.rating).toBe(data.rating);

      // Verify product rating was updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.rating).toBeGreaterThan(0);
      expect(updatedProduct.numReviews).toBeGreaterThan(0);
    });

    it('should create an unverified review for a product not purchased', async () => {
      // Create a new product that the customer hasn't purchased
      const newProduct = await Product.create({
        name: 'Unpurchased Product',
        description: 'A product not purchased by the customer',
        price: 19.99,
        stock: 30,
        category: testCategory._id,
        supplier: testSupplier._id
      });

      const data = {
        ...reviewData,
        productId: newProduct._id
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.verified).toBe(false); // Should be unverified
    });

    it('should not allow a customer to review the same product twice', async () => {
      // First create a review
      await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProduct._id,
          rating: 4,
          title: 'First review',
          comment: 'My first review'
        });

      // Try to create another review for the same product
      const data = {
        ...reviewData,
        productId: testProduct._id
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already reviewed');
    });

    it('should not allow a supplier to create a review', async () => {
      const data = {
        ...reviewData,
        productId: testProduct._id
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(data);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should validate review data', async () => {
      // Missing rating
      const invalidData = {
        productId: testProduct._id,
        title: 'Invalid review',
        comment: 'This review is missing a rating'
      };

      const response = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Reviews', () => {
    it('should get all reviews for a product', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reviews');
      expect(response.body.data.reviews.length).toBeGreaterThan(0);
      expect(response.body.data.reviews[0].product.toString()).toBe(testProduct._id.toString());
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should get a single review by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/reviews/${testReview._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review._id.toString()).toBe(testReview._id.toString());
      expect(response.body.data.review.rating).toBe(testReview.rating);
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/reviews/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should get reviews by customer', async () => {
      const response = await request(app)
        .get('/api/v1/customers/reviews')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reviews');
      expect(response.body.data.reviews.length).toBeGreaterThan(0);
      expect(response.body.data.reviews[0].customer.toString()).toBe(testCustomer._id.toString());
    });
  });

  describe('Update Review', () => {
    it('should update a review as the review owner', async () => {
      const updateData = {
        rating: 3,
        title: 'Updated review',
        comment: 'I changed my mind about this product'
      };

      const response = await request(app)
        .put(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.rating).toBe(updateData.rating);
      expect(response.body.data.review.title).toBe(updateData.title);
      expect(response.body.data.review.comment).toBe(updateData.comment);

      // Verify the database was updated
      const updatedReview = await Review.findById(testReview._id);
      expect(updatedReview.rating).toBe(updateData.rating);

      // Verify product rating was updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.rating).toBe(updateData.rating); // Since there's only one review
    });

    it('should not allow a different customer to update another customer\'s review', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com'
      });

      const updateData = {
        rating: 2,
        title: 'Unauthorized update'
      };

      const response = await request(app)
        .put(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${anotherCustomer.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should allow an admin to update any review', async () => {
      const updateData = {
        rating: 4,
        title: 'Admin updated review',
        comment: 'This review was updated by an admin'
      };

      const response = await request(app)
        .put(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.rating).toBe(updateData.rating);
      expect(response.body.data.review.title).toBe(updateData.title);
    });
  });

  describe('Delete Review', () => {
    it('should delete a review as the review owner', async () => {
      const response = await request(app)
        .delete(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedReview = await Review.findById(testReview._id);
      expect(deletedReview).toBeNull();

      // Verify product rating was updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.numReviews).toBe(0);
    });

    it('should not allow a different customer to delete another customer\'s review', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com'
      });

      const response = await request(app)
        .delete(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${anotherCustomer.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should allow an admin to delete any review', async () => {
      const response = await request(app)
        .delete(`/api/v1/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedReview = await Review.findById(testReview._id);
      expect(deletedReview).toBeNull();
    });
  });

  describe('Review Helpfulness', () => {
    it('should mark a review as helpful', async () => {
      const response = await request(app)
        .post(`/api/v1/reviews/${testReview._id}/helpful`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.helpfulCount).toBe(1);
      expect(response.body.data.review.helpfulBy.length).toBe(1);
      expect(response.body.data.review.helpfulBy[0].toString()).toBe(testCustomer._id.toString());

      // Verify the database was updated
      const updatedReview = await Review.findById(testReview._id);
      expect(updatedReview.helpfulCount).toBe(1);
    });

    it('should not allow marking a review as helpful twice by the same user', async () => {
      // First mark as helpful
      await request(app)
        .post(`/api/v1/reviews/${testReview._id}/helpful`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      // Try to mark as helpful again
      const response = await request(app)
        .post(`/api/v1/reviews/${testReview._id}/helpful`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already marked');
    });

    it('should remove helpful mark from a review', async () => {
      // First mark as helpful
      await request(app)
        .post(`/api/v1/reviews/${testReview._id}/helpful`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      // Now remove the helpful mark
      const response = await request(app)
        .delete(`/api/v1/reviews/${testReview._id}/helpful`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.helpfulCount).toBe(0);
      expect(response.body.data.review.helpfulBy.length).toBe(0);

      // Verify the database was updated
      const updatedReview = await Review.findById(testReview._id);
      expect(updatedReview.helpfulCount).toBe(0);
    });
  });

  describe('Review Reporting', () => {
    it('should report a review', async () => {
      const reportData = {
        reason: 'inappropriate_content',
        details: 'This review contains inappropriate language'
      };

      const response = await request(app)
        .post(`/api/v1/reviews/${testReview._id}/report`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(reportData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.reported).toBe(true);
      expect(response.body.data.review.reportCount).toBe(1);
      expect(response.body.data.review.reports.length).toBe(1);
      expect(response.body.data.review.reports[0].reason).toBe(reportData.reason);

      // Verify the database was updated
      const updatedReview = await Review.findById(testReview._id);
      expect(updatedReview.reported).toBe(true);
      expect(updatedReview.reportCount).toBe(1);
    });

    it('should not allow reporting a review twice by the same user', async () => {
      // First report the review
      await request(app)
        .post(`/api/v1/reviews/${testReview._id}/report`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          reason: 'inappropriate_content',
          details: 'This review contains inappropriate language'
        });

      // Try to report again
      const response = await request(app)
        .post(`/api/v1/reviews/${testReview._id}/report`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          reason: 'spam',
          details: 'This is spam'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already reported');
    });
  });

  describe('Admin Review Management', () => {
    it('should get all reported reviews as admin', async () => {
      // First report a review
      await request(app)
        .post(`/api/v1/reviews/${testReview._id}/report`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          reason: 'inappropriate_content',
          details: 'This review contains inappropriate language'
        });

      const response = await request(app)
        .get('/api/v1/admin/reviews/reported')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reviews');
      expect(response.body.data.reviews.length).toBeGreaterThan(0);
      expect(response.body.data.reviews[0].reported).toBe(true);
    });

    it('should allow admin to approve or reject a review', async () => {
      // Create an unverified review
      const unverifiedReview = await Review.create({
        product: testProduct._id,
        customer: testCustomer._id,
        rating: 3,
        title: 'Unverified review',
        comment: 'This is an unverified review',
        verified: false
      });

      const updateData = {
        status: 'approved'
      };

      const response = await request(app)
        .put(`/api/v1/admin/reviews/${unverifiedReview._id}/moderate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data.review.status).toBe(updateData.status);

      // Verify the database was updated
      const updatedReview = await Review.findById(unverifiedReview._id);
      expect(updatedReview.status).toBe(updateData.status);
    });

    it('should not allow non-admins to moderate reviews', async () => {
      const updateData = {
        status: 'approved'
      };

      const response = await request(app)
        .put(`/api/v1/admin/reviews/${testReview._id}/moderate`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
