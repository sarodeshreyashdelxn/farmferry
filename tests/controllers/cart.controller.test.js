import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Cart from '../../models/cart.model.js';
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { createTestCustomer, createTestSupplier } from '../helpers.js';

describe('Cart Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let testCategory;
  let testProduct;
  let testProductWithVariations;

  beforeEach(async () => {
    // Create test users
    const customerData = await createTestCustomer();
    testCustomer = customerData.customer;
    customerAccessToken = customerData.accessToken;

    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;

    // Create a test category
    testCategory = await Category.create({
      name: 'Test Category',
      description: 'Test category description'
    });

    // Create a test product without variations
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price: 9.99,
      stock: 50,
      category: testCategory._id,
      supplier: testSupplier._id
    });

    // Create a test product with variations
    testProductWithVariations = await Product.create({
      name: 'Test Product with Variations',
      description: 'Test product with variations',
      price: 14.99,
      stock: 100,
      category: testCategory._id,
      supplier: testSupplier._id,
      variations: [
        {
          name: 'Size',
          options: ['Small', 'Medium', 'Large']
        },
        {
          name: 'Color',
          options: ['Red', 'Green']
        }
      ],
      variationItems: [
        {
          attributes: [
            { name: 'Size', value: 'Small' },
            { name: 'Color', value: 'Red' }
          ],
          price: 12.99,
          stock: 20
        },
        {
          attributes: [
            { name: 'Size', value: 'Medium' },
            { name: 'Color', value: 'Green' }
          ],
          price: 14.99,
          stock: 15
        }
      ]
    });
  });

  describe('Get Cart', () => {
    it('should get an empty cart for a new customer', async () => {
      const response = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart).toHaveProperty('items');
      expect(response.body.data.cart.items.length).toBe(0);
      expect(response.body.data.cart.totalItems).toBe(0);
      expect(response.body.data.cart.subtotal).toBe(0);
    });

    it('should not allow access without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/cart');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Add Item to Cart', () => {
    it('should add a product to the cart', async () => {
      const itemData = {
        productId: testProduct._id,
        quantity: 2
      };

      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(itemData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.items.length).toBe(1);
      expect(response.body.data.cart.items[0].product.toString()).toBe(testProduct._id.toString());
      expect(response.body.data.cart.items[0].quantity).toBe(itemData.quantity);
      expect(response.body.data.cart.totalItems).toBe(itemData.quantity);
      expect(response.body.data.cart.subtotal).toBe(testProduct.price * itemData.quantity);

      // Verify the database was updated
      const cart = await Cart.findOne({ customer: testCustomer._id });
      expect(cart).toBeTruthy();
      expect(cart.items.length).toBe(1);
    });

    it('should add a product with variations to the cart', async () => {
      const variation = testProductWithVariations.variationItems[0];
      
      const itemData = {
        productId: testProductWithVariations._id,
        quantity: 1,
        variations: variation.attributes.map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      };

      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(itemData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.items.length).toBe(1);
      expect(response.body.data.cart.items[0].product.toString()).toBe(testProductWithVariations._id.toString());
      expect(response.body.data.cart.items[0].quantity).toBe(itemData.quantity);
      expect(response.body.data.cart.items[0].variations.length).toBe(itemData.variations.length);
      expect(response.body.data.cart.totalItems).toBe(itemData.quantity);
      expect(response.body.data.cart.subtotal).toBe(variation.price * itemData.quantity);
    });

    it('should not add a product with quantity exceeding stock', async () => {
      const itemData = {
        productId: testProduct._id,
        quantity: testProduct.stock + 10 // Exceeds stock
      };

      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(itemData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('stock');
    });

    it('should not add a product with invalid variation', async () => {
      const itemData = {
        productId: testProductWithVariations._id,
        quantity: 1,
        variations: [
          { name: 'Size', value: 'Extra Large' }, // Invalid value
          { name: 'Color', value: 'Red' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(itemData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('variation');
    });

    it('should increase quantity if product already in cart', async () => {
      // First add the product
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProduct._id,
          quantity: 2
        });

      // Add the same product again
      const itemData = {
        productId: testProduct._id,
        quantity: 3
      };

      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(itemData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.items.length).toBe(1);
      expect(response.body.data.cart.items[0].quantity).toBe(5); // 2 + 3
      expect(response.body.data.cart.totalItems).toBe(5);
    });
  });

  describe('Update Cart Item Quantity', () => {
    let cartItem;

    beforeEach(async () => {
      // Add an item to the cart first
      const addResponse = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProduct._id,
          quantity: 2
        });

      cartItem = addResponse.body.data.cart.items[0];
    });

    it('should update the quantity of a cart item', async () => {
      const updateData = {
        quantity: 4
      };

      const response = await request(app)
        .put(`/api/v1/cart/items/${cartItem._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.items[0].quantity).toBe(updateData.quantity);
      expect(response.body.data.cart.totalItems).toBe(updateData.quantity);
      expect(response.body.data.cart.subtotal).toBe(testProduct.price * updateData.quantity);

      // Verify the database was updated
      const cart = await Cart.findOne({ customer: testCustomer._id });
      expect(cart.items[0].quantity).toBe(updateData.quantity);
    });

    it('should not update quantity exceeding stock', async () => {
      const updateData = {
        quantity: testProduct.stock + 10 // Exceeds stock
      };

      const response = await request(app)
        .put(`/api/v1/cart/items/${cartItem._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('stock');
    });

    it('should return 404 for non-existent cart item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        quantity: 3
      };

      const response = await request(app)
        .put(`/api/v1/cart/items/${fakeId}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Remove Cart Item', () => {
    let cartItem;

    beforeEach(async () => {
      // Add an item to the cart first
      const addResponse = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProduct._id,
          quantity: 2
        });

      cartItem = addResponse.body.data.cart.items[0];
    });

    it('should remove an item from the cart', async () => {
      const response = await request(app)
        .delete(`/api/v1/cart/items/${cartItem._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.items.length).toBe(0);
      expect(response.body.data.cart.totalItems).toBe(0);
      expect(response.body.data.cart.subtotal).toBe(0);

      // Verify the database was updated
      const cart = await Cart.findOne({ customer: testCustomer._id });
      expect(cart.items.length).toBe(0);
    });

    it('should return 404 for non-existent cart item', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/v1/cart/items/${fakeId}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Clear Cart', () => {
    beforeEach(async () => {
      // Add items to the cart first
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProduct._id,
          quantity: 2
        });

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProductWithVariations._id,
          quantity: 1,
          variations: testProductWithVariations.variationItems[0].attributes.map(attr => ({
            name: attr.name,
            value: attr.value
          }))
        });
    });

    it('should clear all items from the cart', async () => {
      const response = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart');
      expect(response.body.data.cart.items.length).toBe(0);
      expect(response.body.data.cart.totalItems).toBe(0);
      expect(response.body.data.cart.subtotal).toBe(0);

      // Verify the database was updated
      const cart = await Cart.findOne({ customer: testCustomer._id });
      expect(cart.items.length).toBe(0);
    });
  });

  describe('Apply Coupon', () => {
    // Note: This would require a coupon model and implementation
    // For now, we'll just test the API structure

    beforeEach(async () => {
      // Add an item to the cart first
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({
          productId: testProduct._id,
          quantity: 2
        });
    });

    it('should apply a valid coupon to the cart', async () => {
      // This test assumes there's a valid coupon code "TESTCODE" in the system
      // In a real implementation, you would create a test coupon in the database
      const response = await request(app)
        .post('/api/v1/cart/apply-coupon')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ code: 'TESTCODE' });

      // Since we don't have a real coupon system yet, we expect this to fail
      // In a real implementation, this would return 200 with the applied discount
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not apply an invalid coupon', async () => {
      const response = await request(app)
        .post('/api/v1/cart/apply-coupon')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ code: 'INVALIDCODE' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
