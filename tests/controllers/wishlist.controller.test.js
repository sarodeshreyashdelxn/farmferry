import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Customer from '../../models/customer.model.js';
import Product from '../../models/product.model.js';
import { 
  createTestCustomer, 
  createTestSupplier,
  createTestAdmin
} from '../helpers.js';

describe('Wishlist Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let testAdmin;
  let adminAccessToken;
  let testProduct;

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

    // Create a test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price: 9.99,
      stock: 50,
      category: new mongoose.Types.ObjectId(),
      supplier: testSupplier._id
    });
  });

  describe('Add to Wishlist', () => {
    it('should add a product to customer wishlist', async () => {
      const response = await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist).toContainEqual(expect.objectContaining({
        _id: testProduct._id.toString()
      }));

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.wishlist).toContainEqual(testProduct._id);
    });

    it('should not add a product to wishlist if it already exists', async () => {
      // First add the product
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      // Try to add it again
      const response = await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already in wishlist');
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: nonExistentId });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should not allow non-customers to add to wishlist', async () => {
      const response = await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send({ productId: testProduct._id });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Wishlist', () => {
    it('should get customer wishlist', async () => {
      // First add a product to wishlist
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      const response = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist.length).toBeGreaterThan(0);
      expect(response.body.data.wishlist[0]._id.toString()).toBe(testProduct._id.toString());
      expect(response.body.data.wishlist[0]).toHaveProperty('name');
      expect(response.body.data.wishlist[0]).toHaveProperty('price');
    });

    it('should return empty wishlist if no products are added', async () => {
      const response = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist.length).toBe(0);
    });

    it('should not allow non-customers to view wishlist', async () => {
      const response = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Remove from Wishlist', () => {
    it('should remove a product from customer wishlist', async () => {
      // First add a product to wishlist
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      const response = await request(app)
        .delete(`/api/v1/wishlist/remove/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist).not.toContainEqual(expect.objectContaining({
        _id: testProduct._id.toString()
      }));

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.wishlist).not.toContainEqual(testProduct._id);
    });

    it('should return 404 if product is not in wishlist', async () => {
      const response = await request(app)
        .delete(`/api/v1/wishlist/remove/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found in wishlist');
    });

    it('should not allow non-customers to remove from wishlist', async () => {
      const response = await request(app)
        .delete(`/api/v1/wishlist/remove/${testProduct._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Clear Wishlist', () => {
    it('should clear the entire wishlist', async () => {
      // Add multiple products to wishlist
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      // Create another product
      const anotherProduct = await Product.create({
        name: 'Another Product',
        description: 'Another product description',
        price: 19.99,
        stock: 30,
        category: new mongoose.Types.ObjectId(),
        supplier: testSupplier._id
      });

      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: anotherProduct._id });

      const response = await request(app)
        .delete('/api/v1/wishlist/clear')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist.length).toBe(0);

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.wishlist.length).toBe(0);
    });

    it('should not allow non-customers to clear wishlist', async () => {
      const response = await request(app)
        .delete('/api/v1/wishlist/clear')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Check if Product is in Wishlist', () => {
    it('should check if a product is in the wishlist', async () => {
      // First add a product to wishlist
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      const response = await request(app)
        .get(`/api/v1/wishlist/check/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('inWishlist');
      expect(response.body.data.inWishlist).toBe(true);
    });

    it('should return false if product is not in wishlist', async () => {
      const response = await request(app)
        .get(`/api/v1/wishlist/check/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('inWishlist');
      expect(response.body.data.inWishlist).toBe(false);
    });

    it('should not allow non-customers to check wishlist', async () => {
      const response = await request(app)
        .get(`/api/v1/wishlist/check/${testProduct._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Move to Cart', () => {
    it('should move a product from wishlist to cart', async () => {
      // First add a product to wishlist
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      const moveData = {
        productId: testProduct._id,
        quantity: 2
      };

      const response = await request(app)
        .post('/api/v1/wishlist/move-to-cart')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(moveData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data).toHaveProperty('wishlist');
      
      // Product should be in cart
      expect(response.body.data.cart.items).toContainEqual(expect.objectContaining({
        product: testProduct._id.toString(),
        quantity: moveData.quantity
      }));
      
      // Product should not be in wishlist
      expect(response.body.data.wishlist).not.toContainEqual(expect.objectContaining({
        _id: testProduct._id.toString()
      }));

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.wishlist).not.toContainEqual(testProduct._id);
    });

    it('should return 404 if product is not in wishlist', async () => {
      const moveData = {
        productId: testProduct._id,
        quantity: 2
      };

      const response = await request(app)
        .post('/api/v1/wishlist/move-to-cart')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(moveData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found in wishlist');
    });

    it('should not allow non-customers to move to cart', async () => {
      const moveData = {
        productId: testProduct._id,
        quantity: 2
      };

      const response = await request(app)
        .post('/api/v1/wishlist/move-to-cart')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(moveData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Wishlist Count', () => {
    it('should get the count of products in wishlist', async () => {
      // Add multiple products to wishlist
      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: testProduct._id });

      // Create another product
      const anotherProduct = await Product.create({
        name: 'Another Product',
        description: 'Another product description',
        price: 19.99,
        stock: 30,
        category: new mongoose.Types.ObjectId(),
        supplier: testSupplier._id
      });

      await request(app)
        .post('/api/v1/wishlist/add')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ productId: anotherProduct._id });

      const response = await request(app)
        .get('/api/v1/wishlist/count')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data.count).toBe(2);
    });

    it('should return zero if wishlist is empty', async () => {
      const response = await request(app)
        .get('/api/v1/wishlist/count')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data.count).toBe(0);
    });

    it('should not allow non-customers to get wishlist count', async () => {
      const response = await request(app)
        .get('/api/v1/wishlist/count')
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
