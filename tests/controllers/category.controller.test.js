import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Category from '../../models/category.model.js';
import { createTestAdmin, createTestSupplier, createTestCustomer } from '../helpers.js';

describe('Category Controller', () => {
  let testAdmin;
  let adminAccessToken;
  let supplierAccessToken;
  let customerAccessToken;
  let testCategory;

  beforeEach(async () => {
    // Create test users
    const adminData = await createTestAdmin();
    testAdmin = adminData.admin;
    adminAccessToken = adminData.accessToken;

    const supplierData = await createTestSupplier();
    supplierAccessToken = supplierData.accessToken;

    const customerData = await createTestCustomer();
    customerAccessToken = customerData.accessToken;

    // Create a test category
    testCategory = await Category.create({
      name: 'Test Category',
      description: 'Test category description'
    });
  });

  describe('Create Category', () => {
    const categoryData = {
      name: 'Organic Vegetables',
      description: 'Fresh organic vegetables from local farms',
      imageUrl: 'https://example.com/images/organic-vegetables.jpg'
    };

    it('should create a new category as admin', async () => {
      const response = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(categoryData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('category');
      expect(response.body.data.category.name).toBe(categoryData.name);
      expect(response.body.data.category.description).toBe(categoryData.description);

      // Verify the database was updated
      const category = await Category.findById(response.body.data.category._id);
      expect(category).toBeTruthy();
      expect(category.name).toBe(categoryData.name);
    });

    it('should not allow suppliers to create categories', async () => {
      const response = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(categoryData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow customers to create categories', async () => {
      const response = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(categoryData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not create a category with duplicate name', async () => {
      const duplicateData = {
        name: testCategory.name, // Duplicate name
        description: 'Another description'
      };

      const response = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(duplicateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('Get Categories', () => {
    it('should get all categories', async () => {
      const response = await request(app)
        .get('/api/v1/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('categories');
      expect(response.body.data.categories.length).toBeGreaterThan(0);
      expect(response.body.data.categories[0].name).toBe(testCategory.name);
    });

    it('should get a single category by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/categories/${testCategory._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('category');
      expect(response.body.data.category._id.toString()).toBe(testCategory._id.toString());
      expect(response.body.data.category.name).toBe(testCategory.name);
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/categories/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Category', () => {
    it('should update a category as admin', async () => {
      const updateData = {
        name: 'Updated Category',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('category');
      expect(response.body.data.category.name).toBe(updateData.name);
      expect(response.body.data.category.description).toBe(updateData.description);

      // Verify the database was updated
      const updatedCategory = await Category.findById(testCategory._id);
      expect(updatedCategory.name).toBe(updateData.name);
    });

    it('should not allow suppliers to update categories', async () => {
      const updateData = {
        name: 'Supplier Updated Category'
      };

      const response = await request(app)
        .put(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow customers to update categories', async () => {
      const updateData = {
        name: 'Customer Updated Category'
      };

      const response = await request(app)
        .put(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not update to a duplicate category name', async () => {
      // Create another category first
      const anotherCategory = await Category.create({
        name: 'Another Category',
        description: 'Another category description'
      });

      const updateData = {
        name: anotherCategory.name // Duplicate name
      };

      const response = await request(app)
        .put(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('Delete Category', () => {
    it('should delete a category as admin', async () => {
      const response = await request(app)
        .delete(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify the database was updated
      const deletedCategory = await Category.findById(testCategory._id);
      expect(deletedCategory).toBeNull();
    });

    it('should not allow suppliers to delete categories', async () => {
      const response = await request(app)
        .delete(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${supplierAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow customers to delete categories', async () => {
      const response = await request(app)
        .delete(`/api/v1/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/v1/categories/${fakeId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Get Products by Category', () => {
    it('should get products by category', async () => {
      const response = await request(app)
        .get(`/api/v1/categories/${testCategory._id}/products`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      // Initially there should be no products
      expect(response.body.data.products.length).toBe(0);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/categories/${fakeId}/products`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
