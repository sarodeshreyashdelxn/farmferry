import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import Supplier from '../../models/supplier.model.js';
import { 
  createTestCustomer, 
  createTestSupplier,
  createTestAdmin 
} from '../helpers.js';

describe('Search Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let supplierAccessToken;
  let testAdmin;
  let adminAccessToken;
  let testCategory;
  let testProducts = [];

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

    // Create a test category
    testCategory = await Category.create({
      name: 'Test Category',
      description: 'Test category description'
    });

    // Create multiple test products with different attributes for search testing
    const productData = [
      {
        name: 'Organic Apples',
        description: 'Fresh organic apples from local farms',
        price: 5.99,
        stock: 100,
        category: testCategory._id,
        supplier: testSupplier._id,
        tags: ['organic', 'fruit', 'local'],
        isOrganic: true
      },
      {
        name: 'Farm Fresh Carrots',
        description: 'Locally grown carrots, perfect for salads',
        price: 3.49,
        stock: 150,
        category: testCategory._id,
        supplier: testSupplier._id,
        tags: ['vegetable', 'local'],
        isOrganic: false
      },
      {
        name: 'Organic Bananas',
        description: 'Imported organic bananas',
        price: 4.99,
        stock: 80,
        category: testCategory._id,
        supplier: testSupplier._id,
        tags: ['organic', 'fruit', 'imported'],
        isOrganic: true
      },
      {
        name: 'Premium Honey',
        description: 'Pure honey from local beekeepers',
        price: 12.99,
        stock: 50,
        category: testCategory._id,
        supplier: testSupplier._id,
        tags: ['honey', 'local', 'premium'],
        isOrganic: true
      },
      {
        name: 'Fresh Tomatoes',
        description: 'Vine-ripened tomatoes',
        price: 2.99,
        stock: 120,
        category: testCategory._id,
        supplier: testSupplier._id,
        tags: ['vegetable', 'local'],
        isOrganic: false
      }
    ];

    for (const product of productData) {
      const createdProduct = await Product.create(product);
      testProducts.push(createdProduct);
    }
  });

  describe('Search Products', () => {
    it('should search products by keyword', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=organic');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // All returned products should contain "organic" in name or description
      response.body.data.products.forEach(product => {
        const matchesName = product.name.toLowerCase().includes('organic');
        const matchesDescription = product.description.toLowerCase().includes('organic');
        const matchesTags = product.tags.includes('organic');
        expect(matchesName || matchesDescription || matchesTags).toBe(true);
      });
    });

    it('should filter products by category', async () => {
      // Create another category
      const anotherCategory = await Category.create({
        name: 'Another Category',
        description: 'Another category description'
      });

      // Create a product in the new category
      await Product.create({
        name: 'Product in Another Category',
        description: 'This product is in another category',
        price: 9.99,
        stock: 50,
        category: anotherCategory._id,
        supplier: testSupplier._id
      });

      const response = await request(app)
        .get(`/api/v1/search?category=${anotherCategory._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBe(1);
      expect(response.body.data.products[0].category._id.toString()).toBe(anotherCategory._id.toString());
    });

    it('should filter products by supplier', async () => {
      // Create another supplier
      const anotherSupplierData = await createTestSupplier({
        email: 'another.supplier@example.com',
        name: 'Another Supplier'
      });
      const anotherSupplier = anotherSupplierData.supplier;

      // Create a product from the new supplier
      await Product.create({
        name: 'Product from Another Supplier',
        description: 'This product is from another supplier',
        price: 9.99,
        stock: 50,
        category: testCategory._id,
        supplier: anotherSupplier._id
      });

      const response = await request(app)
        .get(`/api/v1/search?supplier=${anotherSupplier._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBe(1);
      expect(response.body.data.products[0].supplier._id.toString()).toBe(anotherSupplier._id.toString());
    });

    it('should filter products by price range', async () => {
      const minPrice = 4.00;
      const maxPrice = 10.00;

      const response = await request(app)
        .get(`/api/v1/search?minPrice=${minPrice}&maxPrice=${maxPrice}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // All returned products should be within the price range
      response.body.data.products.forEach(product => {
        expect(product.price).toBeGreaterThanOrEqual(minPrice);
        expect(product.price).toBeLessThanOrEqual(maxPrice);
      });
    });

    it('should filter products by tags', async () => {
      const response = await request(app)
        .get('/api/v1/search?tags=organic,fruit');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // All returned products should have at least one of the specified tags
      response.body.data.products.forEach(product => {
        const hasOrganic = product.tags.includes('organic');
        const hasFruit = product.tags.includes('fruit');
        expect(hasOrganic || hasFruit).toBe(true);
      });
    });

    it('should filter products by organic status', async () => {
      const response = await request(app)
        .get('/api/v1/search?isOrganic=true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // All returned products should be organic
      response.body.data.products.forEach(product => {
        expect(product.isOrganic).toBe(true);
      });
    });

    it('should sort products by price ascending', async () => {
      const response = await request(app)
        .get('/api/v1/search?sort=price');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // Products should be sorted by price in ascending order
      for (let i = 1; i < response.body.data.products.length; i++) {
        expect(response.body.data.products[i].price).toBeGreaterThanOrEqual(response.body.data.products[i-1].price);
      }
    });

    it('should sort products by price descending', async () => {
      const response = await request(app)
        .get('/api/v1/search?sort=-price');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // Products should be sorted by price in descending order
      for (let i = 1; i < response.body.data.products.length; i++) {
        expect(response.body.data.products[i].price).toBeLessThanOrEqual(response.body.data.products[i-1].price);
      }
    });

    it('should paginate search results', async () => {
      const page = 1;
      const limit = 2;

      const response = await request(app)
        .get(`/api/v1/search?page=${page}&limit=${limit}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.products.length).toBeLessThanOrEqual(limit);
      expect(response.body.data.pagination.currentPage).toBe(page);
      expect(response.body.data.pagination.limit).toBe(limit);
      expect(response.body.data.pagination.totalProducts).toBeGreaterThan(0);
    });

    it('should combine multiple search parameters', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=organic&minPrice=4.00&sort=-price&isOrganic=true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBeGreaterThan(0);
      
      // Products should match all criteria
      response.body.data.products.forEach(product => {
        const matchesKeyword = product.name.toLowerCase().includes('organic') || 
                              product.description.toLowerCase().includes('organic') ||
                              product.tags.includes('organic');
        expect(matchesKeyword).toBe(true);
        expect(product.price).toBeGreaterThanOrEqual(4.00);
        expect(product.isOrganic).toBe(true);
      });
      
      // Products should be sorted by price in descending order
      for (let i = 1; i < response.body.data.products.length; i++) {
        expect(response.body.data.products[i].price).toBeLessThanOrEqual(response.body.data.products[i-1].price);
      }
    });
  });

  describe('Search Suppliers', () => {
    beforeEach(async () => {
      // Update supplier with additional information
      await Supplier.findByIdAndUpdate(testSupplier._id, {
        businessName: 'Organic Farm Supplies',
        description: 'We provide the best organic produce',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749] // San Francisco coordinates
        },
        tags: ['organic', 'local', 'farm-to-table']
      });

      // Create additional suppliers for testing
      await Supplier.create({
        name: 'Local Vegetable Farm',
        email: 'local.veg@example.com',
        password: '$2a$10$EncryptedPasswordHash',
        businessName: 'Local Vegetable Supplies',
        description: 'Fresh local vegetables',
        location: {
          type: 'Point',
          coordinates: [-122.4184, 37.7739] // Near San Francisco
        },
        tags: ['vegetable', 'local']
      });

      await Supplier.create({
        name: 'Premium Fruit Supplier',
        email: 'premium.fruit@example.com',
        password: '$2a$10$EncryptedPasswordHash',
        businessName: 'Premium Fruit Imports',
        description: 'Exotic and premium fruits',
        location: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128] // New York coordinates
        },
        tags: ['fruit', 'premium', 'imported']
      });
    });

    it('should search suppliers by keyword', async () => {
      const response = await request(app)
        .get('/api/v1/search/suppliers?q=organic');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suppliers');
      expect(response.body.data.suppliers.length).toBeGreaterThan(0);
      
      // All returned suppliers should contain "organic" in name, businessName, or description
      response.body.data.suppliers.forEach(supplier => {
        const matchesName = supplier.name.toLowerCase().includes('organic');
        const matchesBusinessName = supplier.businessName.toLowerCase().includes('organic');
        const matchesDescription = supplier.description.toLowerCase().includes('organic');
        const matchesTags = supplier.tags.includes('organic');
        expect(matchesName || matchesBusinessName || matchesDescription || matchesTags).toBe(true);
      });
    });

    it('should filter suppliers by tags', async () => {
      const response = await request(app)
        .get('/api/v1/search/suppliers?tags=local');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suppliers');
      expect(response.body.data.suppliers.length).toBeGreaterThan(0);
      
      // All returned suppliers should have the specified tag
      response.body.data.suppliers.forEach(supplier => {
        expect(supplier.tags).toContain('local');
      });
    });

    it('should find suppliers by location', async () => {
      const latitude = 37.7749;
      const longitude = -122.4194;
      const maxDistance = 10000; // 10 km

      const response = await request(app)
        .get(`/api/v1/search/suppliers/nearby?latitude=${latitude}&longitude=${longitude}&maxDistance=${maxDistance}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suppliers');
      expect(response.body.data.suppliers.length).toBeGreaterThan(0);
      
      // Suppliers should include distance field
      expect(response.body.data.suppliers[0]).toHaveProperty('distance');
    });

    it('should sort suppliers by distance', async () => {
      const latitude = 37.7749;
      const longitude = -122.4194;
      const maxDistance = 10000; // 10 km

      const response = await request(app)
        .get(`/api/v1/search/suppliers/nearby?latitude=${latitude}&longitude=${longitude}&maxDistance=${maxDistance}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suppliers');
      
      // Suppliers should be sorted by distance
      for (let i = 1; i < response.body.data.suppliers.length; i++) {
        expect(response.body.data.suppliers[i].distance).toBeGreaterThanOrEqual(response.body.data.suppliers[i-1].distance);
      }
    });

    it('should paginate supplier search results', async () => {
      const page = 1;
      const limit = 2;

      const response = await request(app)
        .get(`/api/v1/search/suppliers?page=${page}&limit=${limit}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suppliers');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.suppliers.length).toBeLessThanOrEqual(limit);
      expect(response.body.data.pagination.currentPage).toBe(page);
      expect(response.body.data.pagination.limit).toBe(limit);
    });
  });

  describe('Search Categories', () => {
    beforeEach(async () => {
      // Create additional categories for testing
      await Category.create([
        {
          name: 'Fruits',
          description: 'All types of fruits'
        },
        {
          name: 'Vegetables',
          description: 'Fresh vegetables'
        },
        {
          name: 'Dairy Products',
          description: 'Milk and dairy products'
        },
        {
          name: 'Organic Foods',
          description: 'Certified organic food products'
        }
      ]);
    });

    it('should search categories by keyword', async () => {
      const response = await request(app)
        .get('/api/v1/search/categories?q=organic');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('categories');
      expect(response.body.data.categories.length).toBeGreaterThan(0);
      
      // All returned categories should contain "organic" in name or description
      response.body.data.categories.forEach(category => {
        const matchesName = category.name.toLowerCase().includes('organic');
        const matchesDescription = category.description.toLowerCase().includes('organic');
        expect(matchesName || matchesDescription).toBe(true);
      });
    });

    it('should paginate category search results', async () => {
      const page = 1;
      const limit = 2;

      const response = await request(app)
        .get(`/api/v1/search/categories?page=${page}&limit=${limit}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('categories');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.categories.length).toBeLessThanOrEqual(limit);
      expect(response.body.data.pagination.currentPage).toBe(page);
      expect(response.body.data.pagination.limit).toBe(limit);
    });
  });

  describe('Autocomplete', () => {
    it('should provide autocomplete suggestions for products', async () => {
      const response = await request(app)
        .get('/api/v1/search/autocomplete?q=organ');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      
      // All returned suggestions should contain the query string
      response.body.data.suggestions.forEach(suggestion => {
        expect(suggestion.toLowerCase()).toContain('organ');
      });
    });

    it('should limit the number of autocomplete suggestions', async () => {
      const limit = 2;
      const response = await request(app)
        .get(`/api/v1/search/autocomplete?q=a&limit=${limit}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data.suggestions.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('Search Analytics', () => {
    it('should record search query', async () => {
      // Perform a search
      await request(app)
        .get('/api/v1/search?q=organic')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      // Check if the search was recorded (admin only endpoint)
      const response = await request(app)
        .get('/api/v1/search/analytics')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('topSearches');
      expect(response.body.data).toHaveProperty('searchesByDate');
      
      // The search query should be in the top searches
      const organicFound = response.body.data.topSearches.some(item => item.query === 'organic');
      expect(organicFound).toBe(true);
    });

    it('should not allow non-admin to access search analytics', async () => {
      const response = await request(app)
        .get('/api/v1/search/analytics')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
