import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Customer from '../../models/customer.model.js';
import { createTestCustomer } from '../helpers.js';

describe('Customer Controller', () => {
  let testCustomer;
  let accessToken;

  beforeEach(async () => {
    // Create a test customer before each test
    const result = await createTestCustomer();
    testCustomer = result.customer;
    accessToken = result.accessToken;
  });

  describe('Get Customer Profile', () => {
    it('should get the customer profile', async () => {
      const response = await request(app)
        .get('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('customer');
      expect(response.body.data.customer._id.toString()).toBe(testCustomer._id.toString());
      expect(response.body.data.customer.email).toBe(testCustomer.email);
    });

    it('should not get profile without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/customers/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Update Customer Profile', () => {
    it('should update the customer profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Customer',
        phone: '9876543210'
      };

      const response = await request(app)
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('customer');
      expect(response.body.data.customer.firstName).toBe(updateData.firstName);
      expect(response.body.data.customer.lastName).toBe(updateData.lastName);
      expect(response.body.data.customer.phone).toBe(updateData.phone);

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.firstName).toBe(updateData.firstName);
    });

    it('should not update email to an existing email', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com'
      });

      const response = await request(app)
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: anotherCustomer.customer.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Customer Addresses', () => {
    const newAddress = {
      name: 'Home',
      street: '123 Main St',
      city: 'Cityville',
      state: 'Stateland',
      postalCode: '12345',
      country: 'Countryland',
      isDefault: true
    };

    it('should add a new address', async () => {
      const response = await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newAddress);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('addresses');
      expect(response.body.data.addresses.length).toBe(1);
      expect(response.body.data.addresses[0].name).toBe(newAddress.name);
      expect(response.body.data.addresses[0].isDefault).toBe(true);

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.addresses.length).toBe(1);
    });

    it('should update an existing address', async () => {
      // First add an address
      const addResponse = await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newAddress);

      const addressId = addResponse.body.data.addresses[0]._id;

      // Now update it
      const updateData = {
        name: 'Updated Home',
        street: '456 New St',
        city: 'New City'
      };

      const response = await request(app)
        .put(`/api/v1/customers/addresses/${addressId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('addresses');
      
      const updatedAddress = response.body.data.addresses.find(
        addr => addr._id === addressId
      );
      
      expect(updatedAddress.name).toBe(updateData.name);
      expect(updatedAddress.street).toBe(updateData.street);
      expect(updatedAddress.city).toBe(updateData.city);
    });

    it('should delete an address', async () => {
      // First add an address
      const addResponse = await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newAddress);

      const addressId = addResponse.body.data.addresses[0]._id;

      // Now delete it
      const response = await request(app)
        .delete(`/api/v1/customers/addresses/${addressId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('addresses');
      expect(response.body.data.addresses.length).toBe(0);

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.addresses.length).toBe(0);
    });

    it('should set an address as default', async () => {
      // Add two addresses
      await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newAddress);

      const secondAddress = {
        name: 'Work',
        street: '789 Work St',
        city: 'Workville',
        state: 'Workland',
        postalCode: '67890',
        country: 'Countryland',
        isDefault: false
      };

      const secondAddResponse = await request(app)
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(secondAddress);

      const secondAddressId = secondAddResponse.body.data.addresses[1]._id;

      // Set the second address as default
      const response = await request(app)
        .put(`/api/v1/customers/addresses/${secondAddressId}/default`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify both addresses in the response
      const addresses = response.body.data.addresses;
      const firstAddress = addresses.find(addr => addr._id !== secondAddressId);
      const updatedSecondAddress = addresses.find(addr => addr._id === secondAddressId);
      
      expect(firstAddress.isDefault).toBe(false);
      expect(updatedSecondAddress.isDefault).toBe(true);

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      const dbFirstAddress = updatedCustomer.addresses.find(addr => addr._id.toString() !== secondAddressId);
      const dbSecondAddress = updatedCustomer.addresses.find(addr => addr._id.toString() === secondAddressId);
      
      expect(dbFirstAddress.isDefault).toBe(false);
      expect(dbSecondAddress.isDefault).toBe(true);
    });
  });

  describe('Customer Wishlist', () => {
    // Mock product ID for testing
    const productId = new mongoose.Types.ObjectId();

    it('should add a product to wishlist', async () => {
      const response = await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist.length).toBe(1);
      expect(response.body.data.wishlist[0].toString()).toBe(productId.toString());

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.wishlist.length).toBe(1);
      expect(updatedCustomer.wishlist[0].toString()).toBe(productId.toString());
    });

    it('should get the wishlist', async () => {
      // First add a product to wishlist
      await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId });

      const response = await request(app)
        .get('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist.length).toBe(1);
    });

    it('should remove a product from wishlist', async () => {
      // First add a product to wishlist
      await request(app)
        .post('/api/v1/customers/wishlist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId });

      const response = await request(app)
        .delete(`/api/v1/customers/wishlist/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('wishlist');
      expect(response.body.data.wishlist.length).toBe(0);

      // Verify the database was updated
      const updatedCustomer = await Customer.findById(testCustomer._id);
      expect(updatedCustomer.wishlist.length).toBe(0);
    });
  });

  describe('Customer Orders', () => {
    it('should get customer orders', async () => {
      const response = await request(app)
        .get('/api/v1/customers/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      // Initially there should be no orders
      expect(response.body.data.orders.length).toBe(0);
    });
  });
});
