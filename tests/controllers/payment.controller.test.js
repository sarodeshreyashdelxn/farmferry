import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import Order from '../../models/order.model.js';
import Payment from '../../models/payment.model.js';
import Product from '../../models/product.model.js';
import { 
  createTestCustomer, 
  createTestSupplier,
  createTestAdmin 
} from '../helpers.js';

// Mock Stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_mock_id',
          client_secret: 'pi_mock_secret',
          amount: 1000,
          currency: 'inr',
          status: 'requires_payment_method'
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'pi_mock_id',
          amount: 1000,
          currency: 'inr',
          status: 'succeeded',
          metadata: {
            orderId: 'mock_order_id'
          }
        }),
        cancel: jest.fn().mockResolvedValue({
          id: 'pi_mock_id',
          status: 'canceled'
        })
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_mock_id',
              status: 'succeeded',
              metadata: {
                orderId: 'mock_order_id'
              }
            }
          }
        })
      }
    };
  });
});

// Mock Razorpay module
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    return {
      orders: {
        create: jest.fn().mockResolvedValue({
          id: 'order_mock_id',
          amount: 1000,
          currency: 'INR',
          receipt: 'receipt_mock_id'
        })
      },
      payments: {
        fetch: jest.fn().mockResolvedValue({
          id: 'pay_mock_id',
          order_id: 'order_mock_id',
          amount: 1000,
          status: 'captured'
        }),
        capture: jest.fn().mockResolvedValue({
          id: 'pay_mock_id',
          order_id: 'order_mock_id',
          amount: 1000,
          status: 'captured'
        })
      }
    };
  });
});

describe('Payment Controller', () => {
  let testCustomer;
  let customerAccessToken;
  let testSupplier;
  let testAdmin;
  let adminAccessToken;
  let testOrder;
  let testProduct;

  beforeEach(async () => {
    // Create test users
    const customerData = await createTestCustomer();
    testCustomer = customerData.customer;
    customerAccessToken = customerData.accessToken;

    const supplierData = await createTestSupplier();
    testSupplier = supplierData.supplier;

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

    // Create a test order
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
      status: 'pending',
      paymentMethod: 'card',
      paymentStatus: 'pending'
    });
  });

  describe('Create Payment Intent (Stripe)', () => {
    it('should create a Stripe payment intent for an order', async () => {
      const response = await request(app)
        .post(`/api/v1/payments/create-payment-intent/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ paymentMethod: 'card' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('clientSecret');
      expect(response.body.data).toHaveProperty('paymentIntentId');
      expect(response.body.data.clientSecret).toBe('pi_mock_secret');

      // Verify payment record was created
      const payment = await Payment.findOne({ order: testOrder._id });
      expect(payment).toBeTruthy();
      expect(payment.paymentMethod).toBe('card');
      expect(payment.provider).toBe('stripe');
      expect(payment.amount).toBe(testOrder.totalAmount);
      expect(payment.status).toBe('pending');
      expect(payment.paymentIntentId).toBe('pi_mock_id');
    });

    it('should not create payment intent for an order that is not pending', async () => {
      // Update order status
      await Order.findByIdAndUpdate(testOrder._id, { status: 'processing' });

      const response = await request(app)
        .post(`/api/v1/payments/create-payment-intent/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send({ paymentMethod: 'card' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not allow other customers to create payment intent for an order', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com',
        name: 'Another Customer'
      });

      const response = await request(app)
        .post(`/api/v1/payments/create-payment-intent/${testOrder._id}`)
        .set('Authorization', `Bearer ${anotherCustomer.accessToken}`)
        .send({ paymentMethod: 'card' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Create Razorpay Order', () => {
    it('should create a Razorpay order for an order', async () => {
      const response = await request(app)
        .post(`/api/v1/payments/create-razorpay-order/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orderId');
      expect(response.body.data).toHaveProperty('amount');
      expect(response.body.data.orderId).toBe('order_mock_id');

      // Verify payment record was created
      const payment = await Payment.findOne({ order: testOrder._id });
      expect(payment).toBeTruthy();
      expect(payment.paymentMethod).toBe('razorpay');
      expect(payment.provider).toBe('razorpay');
      expect(payment.amount).toBe(testOrder.totalAmount);
      expect(payment.status).toBe('pending');
      expect(payment.razorpayOrderId).toBe('order_mock_id');
    });

    it('should not create Razorpay order for an order that is not pending', async () => {
      // Update order status
      await Order.findByIdAndUpdate(testOrder._id, { status: 'processing' });

      const response = await request(app)
        .post(`/api/v1/payments/create-razorpay-order/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Verify Razorpay Payment', () => {
    beforeEach(async () => {
      // Create a payment record for the order
      await Payment.create({
        order: testOrder._id,
        customer: testCustomer._id,
        amount: testOrder.totalAmount,
        paymentMethod: 'razorpay',
        provider: 'razorpay',
        status: 'pending',
        razorpayOrderId: 'order_mock_id'
      });
    });

    it('should verify a successful Razorpay payment', async () => {
      const paymentData = {
        razorpayPaymentId: 'pay_mock_id',
        razorpayOrderId: 'order_mock_id',
        razorpaySignature: 'valid_signature' // The mock will bypass signature verification
      };

      const response = await request(app)
        .post(`/api/v1/payments/verify-razorpay-payment/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(paymentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data.payment.status).toBe('completed');

      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentStatus).toBe('completed');
      expect(updatedOrder.status).toBe('processing');
    });

    it('should handle failed Razorpay payment verification', async () => {
      // Mock the verification to fail
      const razorpayMock = require('razorpay');
      razorpayMock.mockImplementation(() => {
        return {
          payments: {
            fetch: jest.fn().mockRejectedValue(new Error('Payment verification failed'))
          }
        };
      });

      const paymentData = {
        razorpayPaymentId: 'pay_mock_id',
        razorpayOrderId: 'order_mock_id',
        razorpaySignature: 'invalid_signature'
      };

      const response = await request(app)
        .post(`/api/v1/payments/verify-razorpay-payment/${testOrder._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(paymentData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Webhook Handler', () => {
    beforeEach(async () => {
      // Create a payment record for the order
      await Payment.create({
        order: testOrder._id,
        customer: testCustomer._id,
        amount: testOrder.totalAmount,
        paymentMethod: 'card',
        provider: 'stripe',
        status: 'pending',
        paymentIntentId: 'pi_mock_id'
      });

      // Update order ID in metadata for mock
      const stripeMock = require('stripe');
      stripeMock().webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_id',
            status: 'succeeded',
            metadata: {
              orderId: testOrder._id.toString()
            }
          }
        }
      });
    });

    it('should handle Stripe webhook for successful payment', async () => {
      const response = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Stripe-Signature', 'mock_signature')
        .send(JSON.stringify({
          id: 'evt_mock_id',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_mock_id',
              status: 'succeeded'
            }
          }
        }));

      expect(response.status).toBe(200);

      // Verify payment and order were updated
      const payment = await Payment.findOne({ paymentIntentId: 'pi_mock_id' });
      expect(payment.status).toBe('completed');

      const order = await Order.findById(testOrder._id);
      expect(order.paymentStatus).toBe('completed');
      expect(order.status).toBe('processing');
    });

    it('should handle Stripe webhook for failed payment', async () => {
      // Update mock to return failed payment
      const stripeMock = require('stripe');
      stripeMock().webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_mock_id',
            status: 'failed',
            metadata: {
              orderId: testOrder._id.toString()
            }
          }
        }
      });

      const response = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Stripe-Signature', 'mock_signature')
        .send(JSON.stringify({
          id: 'evt_mock_id',
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_mock_id',
              status: 'failed'
            }
          }
        }));

      expect(response.status).toBe(200);

      // Verify payment and order were updated
      const payment = await Payment.findOne({ paymentIntentId: 'pi_mock_id' });
      expect(payment.status).toBe('failed');

      const order = await Order.findById(testOrder._id);
      expect(order.paymentStatus).toBe('failed');
    });
  });

  describe('Get Payment Details', () => {
    let testPayment;

    beforeEach(async () => {
      // Create a payment record for the order
      testPayment = await Payment.create({
        order: testOrder._id,
        customer: testCustomer._id,
        amount: testOrder.totalAmount,
        paymentMethod: 'card',
        provider: 'stripe',
        status: 'completed',
        paymentIntentId: 'pi_mock_id'
      });
    });

    it('should allow customer to get their payment details', async () => {
      const response = await request(app)
        .get(`/api/v1/payments/${testPayment._id}`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data.payment._id.toString()).toBe(testPayment._id.toString());
      expect(response.body.data.payment.status).toBe('completed');
    });

    it('should allow admin to get any payment details', async () => {
      const response = await request(app)
        .get(`/api/v1/payments/${testPayment._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data.payment._id.toString()).toBe(testPayment._id.toString());
    });

    it('should not allow other customers to view payment details', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com',
        name: 'Another Customer'
      });

      const response = await request(app)
        .get(`/api/v1/payments/${testPayment._id}`)
        .set('Authorization', `Bearer ${anotherCustomer.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should get all payments for a customer', async () => {
      const response = await request(app)
        .get('/api/v1/payments/my-payments')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payments');
      expect(response.body.data.payments.length).toBeGreaterThan(0);
      expect(response.body.data.payments[0].customer.toString()).toBe(testCustomer._id.toString());
    });

    it('should get all payments for admin', async () => {
      const response = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payments');
      expect(response.body.data.payments.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('pagination');
    });
  });

  describe('Cancel Payment', () => {
    let testPayment;

    beforeEach(async () => {
      // Create a payment record for the order
      testPayment = await Payment.create({
        order: testOrder._id,
        customer: testCustomer._id,
        amount: testOrder.totalAmount,
        paymentMethod: 'card',
        provider: 'stripe',
        status: 'pending',
        paymentIntentId: 'pi_mock_id'
      });
    });

    it('should allow customer to cancel their pending payment', async () => {
      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/cancel`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data.payment.status).toBe('cancelled');

      // Verify the database was updated
      const updatedPayment = await Payment.findById(testPayment._id);
      expect(updatedPayment.status).toBe('cancelled');
    });

    it('should not allow cancelling a completed payment', async () => {
      // Update payment status to completed
      await Payment.findByIdAndUpdate(testPayment._id, { status: 'completed' });

      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/cancel`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not allow other customers to cancel a payment', async () => {
      // Create another customer
      const anotherCustomer = await createTestCustomer({
        email: 'another.customer@example.com',
        name: 'Another Customer'
      });

      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/cancel`)
        .set('Authorization', `Bearer ${anotherCustomer.accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Refund Payment', () => {
    let testPayment;

    beforeEach(async () => {
      // Create a completed payment record for the order
      testPayment = await Payment.create({
        order: testOrder._id,
        customer: testCustomer._id,
        amount: testOrder.totalAmount,
        paymentMethod: 'card',
        provider: 'stripe',
        status: 'completed',
        paymentIntentId: 'pi_mock_id'
      });

      // Update order status
      await Order.findByIdAndUpdate(testOrder._id, {
        status: 'delivered',
        paymentStatus: 'completed'
      });

      // Mock Stripe refund
      const stripeMock = require('stripe');
      stripeMock().refunds = {
        create: jest.fn().mockResolvedValue({
          id: 're_mock_id',
          payment_intent: 'pi_mock_id',
          amount: 1000,
          status: 'succeeded'
        })
      };
    });

    it('should allow admin to refund a completed payment', async () => {
      const refundData = {
        reason: 'requested_by_customer',
        amount: testOrder.totalAmount // Full refund
      };

      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/refund`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(refundData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data.payment.status).toBe('refunded');
      expect(response.body.data.payment).toHaveProperty('refundId');

      // Verify the database was updated
      const updatedPayment = await Payment.findById(testPayment._id);
      expect(updatedPayment.status).toBe('refunded');
      expect(updatedPayment.refundId).toBe('re_mock_id');

      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentStatus).toBe('refunded');
    });

    it('should not allow refunding a payment that is not completed', async () => {
      // Update payment status to pending
      await Payment.findByIdAndUpdate(testPayment._id, { status: 'pending' });

      const refundData = {
        reason: 'requested_by_customer',
        amount: testOrder.totalAmount
      };

      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/refund`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(refundData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not allow non-admin to refund a payment', async () => {
      const refundData = {
        reason: 'requested_by_customer',
        amount: testOrder.totalAmount
      };

      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/refund`)
        .set('Authorization', `Bearer ${customerAccessToken}`)
        .send(refundData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle partial refunds', async () => {
      const refundData = {
        reason: 'requested_by_customer',
        amount: testOrder.totalAmount / 2 // Partial refund
      };

      const response = await request(app)
        .post(`/api/v1/payments/${testPayment._id}/refund`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(refundData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data.payment.status).toBe('partially_refunded');

      // Verify the database was updated
      const updatedPayment = await Payment.findById(testPayment._id);
      expect(updatedPayment.status).toBe('partially_refunded');
      expect(updatedPayment.refundAmount).toBe(testOrder.totalAmount / 2);

      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentStatus).toBe('partially_refunded');
    });
  });

  describe('Cash on Delivery', () => {
    beforeEach(async () => {
      // Update order to COD
      await Order.findByIdAndUpdate(testOrder._id, {
        paymentMethod: 'cod',
        paymentStatus: 'pending'
      });
    });

    it('should mark COD payment as received', async () => {
      const response = await request(app)
        .post(`/api/v1/payments/cod/${testOrder._id}/received`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.paymentStatus).toBe('completed');

      // Verify payment record was created
      const payment = await Payment.findOne({ order: testOrder._id });
      expect(payment).toBeTruthy();
      expect(payment.paymentMethod).toBe('cod');
      expect(payment.status).toBe('completed');
    });

    it('should not allow non-admin to mark COD payment as received', async () => {
      const response = await request(app)
        .post(`/api/v1/payments/cod/${testOrder._id}/received`)
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not mark COD payment as received for non-COD orders', async () => {
      // Update order to card payment method
      await Order.findByIdAndUpdate(testOrder._id, { paymentMethod: 'card' });

      const response = await request(app)
        .post(`/api/v1/payments/cod/${testOrder._id}/received`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Payment Analytics', () => {
    beforeEach(async () => {
      // Create multiple payments with different statuses and dates
      for (let i = 0; i < 5; i++) {
        const order = await Order.create({
          customer: testCustomer._id,
          items: [
            {
              product: testProduct._id,
              name: testProduct.name,
              price: testProduct.price,
              quantity: i + 1,
              supplier: testSupplier._id
            }
          ],
          totalAmount: testProduct.price * (i + 1),
          shippingAddress: {
            name: 'Home',
            street: '123 Main St',
            city: 'Cityville',
            state: 'Stateland',
            postalCode: '12345',
            country: 'Countryland'
          },
          status: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'][i],
          paymentMethod: i % 2 === 0 ? 'card' : 'cod',
          paymentStatus: i < 3 ? 'completed' : 'pending'
        });

        await Payment.create({
          order: order._id,
          customer: testCustomer._id,
          amount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          provider: order.paymentMethod === 'card' ? 'stripe' : 'cod',
          status: i < 3 ? 'completed' : 'pending',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // Different dates
        });
      }
    });

    it('should get payment analytics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/payments/analytics')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalPayments');
      expect(response.body.data).toHaveProperty('totalAmount');
      expect(response.body.data).toHaveProperty('paymentsByMethod');
      expect(response.body.data).toHaveProperty('paymentsByStatus');
      expect(response.body.data).toHaveProperty('paymentsByPeriod');
      expect(response.body.data.totalPayments).toBeGreaterThan(0);
      expect(response.body.data.totalAmount).toBeGreaterThan(0);
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/v1/payments/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalPayments');
      expect(response.body.data).toHaveProperty('paymentsByPeriod');
    });

    it('should not allow non-admin to access payment analytics', async () => {
      const response = await request(app)
        .get('/api/v1/payments/analytics')
        .set('Authorization', `Bearer ${customerAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
