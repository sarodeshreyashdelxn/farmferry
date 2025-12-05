const request = require('supertest');
const app = require('../../server'); // Assuming your Express app is exported from server.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Product = require('../../models/product.model');
const Customer = require('../../models/customer.model');

// Mock external services
jest.mock('../../utils/stripe', () => ({
  charges: {
    create: jest.fn().mockResolvedValue({ id: 'ch_123', status: 'succeeded' }),
  },
}));

jest.mock('../../utils/notifications', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
}));

describe('POST /api/v1/orders', () => {
  let token;
  let customer;
  let productInStock;
  let productOutOfStock;

  beforeAll(async () => {
    // Create a test customer
    customer = new Customer({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });
    await customer.save();

    // Generate a JWT for the test customer
    token = jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Create test products
    productInStock = new Product({
      name: 'Organic Apples',
      price: 2.99,
      stock: 10,
      supplier: new mongoose.Types.ObjectId(),
    });
    await productInStock.save();

    productOutOfStock = new Product({
      name: 'Organic Bananas',
      price: 1.99,
      stock: 0,
      supplier: new mongoose.Types.ObjectId(),
    });
    await productOutOfStock.save();
  });

  afterAll(async () => {
    // Clean up database
    await Customer.deleteMany({});
    await Product.deleteMany({});
    await mongoose.connection.close();
  });

  it('should create an order successfully and return 201', async () => {
    const orderPayload = {
      products: [{ productId: productInStock._id, quantity: 2 }],
      totalAmount: 5.98,
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderPayload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderId');
    expect(res.body.message).toBe('Order created successfully');

    // Verify inventory was updated
    const updatedProduct = await Product.findById(productInStock._id);
    expect(updatedProduct.stock).toBe(8);
  });

  it('should fail to create an order due to insufficient inventory and return 400', async () => {
    const orderPayload = {
      products: [{ productId: productOutOfStock._id, quantity: 1 }],
      totalAmount: 1.99,
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderPayload);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Insufficient stock for Organic Bananas');
  });

  it('should fail to create an order due to an unauthorized request and return 401', async () => {
    const orderPayload = {
      products: [{ productId: productInStock._id, quantity: 1 }],
      totalAmount: 2.99,
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .send(orderPayload); // No auth token

    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Unauthorized request');
  });
});