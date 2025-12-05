import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { createTestSupplier, createTestCustomer, createTestAdmin } from '../helpers.js';

describe('Product Controller', () => {
  let testSupplier;
  let supplierAccessToken;
  let customerAccessToken;
  let adminAccessToken;
  let testCategory;

  beforeEach(async () => {
    // Create test users
    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;
    supplierAccessToken = supplierData.accessToken;

    const customerData = await createTestCustomer();
    customerAccessToken = customerData.accessToken;

    const adminData = await createTestAdmin();
    adminAccessToken = adminData.accessToken;

    // Create a test category
    testCategory = await Category.create({
      name: 'Test Category',
      description: 'Test category description'
    });
  });

  describe('Create Product', () => {
    const productData = {
      name: 'Organic Tomatoes',
      description: 'Fresh organic tomatoes',
      price: 2.99,
      stock: 100,
      category: '', // Will be set in the test
      variations: [
        {
          name: 'Size',
          options: ['Small', 'Medium', 'Large']
        },
        {
          name: 'Color',
          options: ['Red', 'Yellow']
        }
      ],
      attributes: [
        {
          name: 'Organic',
          value: 'Yes'
        },
        {
          name: 'Farm',
          value: 'Local Farm'
        }
      ]
    };

    it('should create a new product as a supplier', async () => {
      const data = { ...productData, category: testCategory._id };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(data);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data.product.name).toBe(data.name);
      expect(response.body.data.product.supplier.toString()).toBe(testSupplier._id.toString());
      expect(response.body.data.product.category.toString()).toBe(testCategory._id.toString());

      // Verify the database was updated
      const product = await Product.findById(response.body.data.product._id);
      expect(product).toBeTruthy();
      expect(product.name).toBe(data.name);
    });

    it('should not allow a customer to create a product', async () => {
      const data = { ...productData, category: testCategory._id };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(data);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Products', () => {
    let testProduct;

    beforeEach(async () => {
      // Create a test product
      testProduct = await Product.create({
        name: 'Test Product',
        description: 'Test product description',
        price: 9.99,
        stock: 50,
        category: testCategory._id,
        supplier: testSupplier._id,
        variations: [
          {
            name: 'Size',
            options: ['Small', 'Medium', 'Large']
          }
        ],
        attributes: [
          {
            name: 'Organic',
            value: 'Yes'
          }
        ]
      });
    });

    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/v1/products');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should get a single product by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${testProduct._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data.product._id.toString()).toBe(testProduct._id.toString());
      expect(response.body.data.product.name).toBe(testProduct.name);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/products/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should get products by category', async () => {
      const response = await request(app)
        .get(`/api/v1/products?category=${testCategory._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].category._id.toString()).toBe(testCategory._id.toString());
    });

    it('should get products by supplier', async () => {
      const response = await request(app)
        .get(`/api/v1/products?supplier=${testSupplier._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].supplier._id.toString()).toBe(testSupplier._id.toString());
    });

    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/v1/products?search=Test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].name).toContain('Test');
    });
  });

  describe('Update Product', () => {
    let testProduct;

    beforeEach(async () => {
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

    it('should update a product as the supplier owner', async () => {
      const updateData = {
        name: 'Updated Product',
        price: 14.99,
        stock: 75
      };

      const response = await request(app)
        .put(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data.product.name).toBe(updateData.name);
      expect(response.body.data.product.price).toBe(updateData.price);
      expect(response.body.data.product.stock).toBe(updateData.stock);

      // Verify the database was updated
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.name).toBe(updateData.name);
    });

    it('should allow an admin to update any product', async () => {
      const updateData = {
        name: 'Admin Updated Product',
        price: 19.99
      };

      const response = await request(app)
        .put(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data.product.name).toBe(updateData.name);
    });

    it('should not allow a customer to update a product', async () => {
      const updateData = {
        name: 'Customer Updated Product'
      };

      const response = await request(app)
        .put(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow a different supplier to update another supplier\'s product', async () => {
      // Create another supplier
      const anotherSupplier = await createTestSupplier({
        email: 'another.supplier@example.com',
        businessName: 'Another Farm'
      });

      const updateData = {
        name: 'Other Supplier Updated Product'
      };

      const response = await request(app)
        .put(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${anotherSupplier.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Delete Product', () => {
    let testProduct;

    beforeEach(async () => {
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

    it('should delete a product as the supplier owner', async () => {
      const response = await request(app)
        .delete(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedProduct = await Product.findById(testProduct._id);
      expect(deletedProduct).toBeNull();
    });

    it('should allow an admin to delete any product', async () => {
      const response = await request(app)
        .delete(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedProduct = await Product.findById(testProduct._id);
      expect(deletedProduct).toBeNull();
    });

    it('should not allow a customer to delete a product', async () => {
      const response = await request(app)
        .delete(`/api/v1/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
