import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import * as authController from '../../controllers/auth.controller.js';
import authRouter from '../../routes/auth.routes.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import Customer from '../../models/customer.model.js';
import Supplier from '../../models/supplier.model.js';
import Admin from '../../models/admin.model.js';
import sendEmail from '../../utils/email.js';
import sendSMS from '../../utils/sms.js';

// Mocking dependencies
jest.mock('../../utils/email.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../utils/sms.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../models/customer.model.js');
jest.mock('../../models/supplier.model.js');
jest.mock('../../models/admin.model.js');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);

// Mock implementation for generateTokensAndSetCookies
const mockGenerateTokens = (user) => {
  return {
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
  };
};

describe('Auth Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Customer Registration', () => {
    it('should register a new customer successfully', async () => {
      const reqBody = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        phone: '1234567890',
      };

      const mockCustomer = {
        _id: 'customer_id',
        ...reqBody,
        generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
      };

      Customer.findOne.mockResolvedValue(null);
      Customer.create.mockResolvedValue(mockCustomer);
      Customer.findById.mockResolvedValue(mockCustomer);

      const response = await request(app)
        .post('/api/v1/auth/register/customer')
        .send(reqBody);

      expect(response.status).toBe(201);
      expect(response.body.data.customer.email).toBe(reqBody.email);
      expect(sendEmail).toHaveBeenCalled();
      expect(sendSMS).toHaveBeenCalled();
    });

    it('should return 409 if email already exists', async () => {
      const reqBody = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        password: 'password123',
      };

      Customer.findOne.mockResolvedValue(reqBody);

      const response = await request(app)
        .post('/api/v1/auth/register/customer')
        .send(reqBody);

      expect(response.status).toBe(409);
    });
  });

  describe('Supplier Registration', () => {
    it('should register a new supplier successfully', async () => {
      const reqBody = {
        businessName: 'Test Supplier',
        ownerName: 'John Doe',
        email: 'supplier@example.com',
        password: 'password123',
        phone: '1234567890',
        businessType: 'Test Type',
        address: 'Test Address',
      };

      const mockSupplier = {
        _id: 'supplier_id',
        ...reqBody,
        generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
      };

      Supplier.findOne.mockResolvedValue(null);
      Supplier.create.mockResolvedValue(mockSupplier);
      Supplier.findById.mockResolvedValue(mockSupplier);

      const response = await request(app)
        .post('/api/v1/auth/register/supplier')
        .send(reqBody);

      expect(response.status).toBe(201);
      expect(response.body.data.supplier.email).toBe(reqBody.email);
    });
  });

  describe('Admin Registration', () => {
    it('should register a new admin successfully', async () => {
      const reqBody = {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'password123',
        phone: '1234567890',
      };

      const mockAdmin = {
        _id: 'admin_id',
        ...reqBody,
        generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
      };

      Admin.findOne.mockResolvedValue(null);
      Admin.create.mockResolvedValue(mockAdmin);
      Admin.findById.mockResolvedValue(mockAdmin);

      const response = await request(app)
        .post('/api/v1/auth/register/admin')
        .send(reqBody);

      expect(response.status).toBe(201);
      expect(response.body.data.admin.email).toBe(reqBody.email);
    });
  });

  describe('Login', () => {
    it('should login a customer successfully', async () => {
      const reqBody = {
        email: 'customer@example.com',
        password: 'password123',
      };

      const mockCustomer = {
        _id: 'customer_id',
        ...reqBody,
        isPasswordCorrect: jest.fn().mockResolvedValue(true),
        generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
        save: jest.fn(),
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Customer.findById.mockResolvedValue(mockCustomer);

      const response = await request(app)
        .post('/api/v1/auth/login/customer')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(response.body.data.customer.email).toBe(reqBody.email);
    });

    it('should login a supplier successfully', async () => {
        const reqBody = {
          email: 'supplier@example.com',
          password: 'password123',
        };
  
        const mockSupplier = {
          _id: 'supplier_id',
          ...reqBody,
          isPasswordCorrect: jest.fn().mockResolvedValue(true),
          generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
          generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
          save: jest.fn(),
        };
  
        Supplier.findOne.mockResolvedValue(mockSupplier);
        Supplier.findById.mockResolvedValue(mockSupplier);
  
        const response = await request(app)
          .post('/api/v1/auth/login/supplier')
          .send(reqBody);
  
        expect(response.status).toBe(200);
        expect(response.body.data.supplier.email).toBe(reqBody.email);
      });
  
      it('should login an admin successfully', async () => {
        const reqBody = {
          email: 'admin@example.com',
          password: 'password123',
        };
  
        const mockAdmin = {
          _id: 'admin_id',
          ...reqBody,
          isPasswordCorrect: jest.fn().mockResolvedValue(true),
          generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
          generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
          save: jest.fn(),
        };
  
        Admin.findOne.mockResolvedValue(mockAdmin);
        Admin.findById.mockResolvedValue(mockAdmin);
  
        const response = await request(app)
          .post('/api/v1/auth/login/admin')
          .send(reqBody);
  
        expect(response.status).toBe(200);
        expect(response.body.data.admin.email).toBe(reqBody.email);
      });
  });

  describe('Forgot Password', () => {
    it('should send a password reset OTP for customer', async () => {
      const reqBody = {
        email: 'user@example.com',
        role: 'customer',
      };

      const mockUser = {
        email: reqBody.email,
        generatePasswordResetOTP: jest.fn().mockReturnValue('123456'),
        save: jest.fn(),
      };

      Customer.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should send a password reset token for admin', async () => {
      const reqBody = {
        email: 'admin@example.com',
        role: 'admin',
      };

      const mockUser = {
        email: reqBody.email,
        generatePasswordResetToken: jest.fn().mockReturnValue('reset_token'),
        save: jest.fn(),
      };

      Admin.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(sendEmail).toHaveBeenCalled();
    });
  });

  describe('Reset Password', () => {
    it('should reset the password with OTP for customer', async () => {
      const reqBody = {
        email: 'user@example.com',
        otp: '123456',
        password: 'newPassword123',
      };

      const mockUser = {
        email: reqBody.email,
        password: 'oldPassword',
        passwordResetOTP: reqBody.otp,
        passwordResetOTPExpires: Date.now() + 3600000,
        save: jest.fn(),
      };

      Customer.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/reset-password-otp')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should reset the password with token for admin', async () => {
      const reqBody = {
        password: 'newPassword123',
        role: 'admin',
      };

      const mockUser = {
        password: 'oldPassword',
        passwordResetToken: 'hashed_token',
        passwordResetExpires: Date.now() + 3600000,
        save: jest.fn(),
      };

      Admin.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/reset-password/some_token')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('Phone Verification', () => {
    it('should send a phone verification OTP', async () => {
      const reqBody = {
        phone: '1234567890',
      };

      const mockSupplier = {
        phone: reqBody.phone,
        generatePhoneVerificationToken: jest.fn().mockReturnValue('123456'),
        save: jest.fn(),
      };

      Supplier.findOne.mockResolvedValue(mockSupplier);

      const response = await request(app)
        .post('/api/v1/auth/send-phone-verification')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(sendSMS).toHaveBeenCalled();
    });

    it('should verify the phone number successfully', async () => {
      const reqBody = {
        phone: '1234567890',
        otp: '123456',
      };

      const mockSupplier = {
        phone: reqBody.phone,
        phoneVerificationToken: reqBody.otp,
        phoneVerificationExpires: Date.now() + 3600000,
        isPhoneVerified: false,
        save: jest.fn(),
      };

      Supplier.findOne.mockResolvedValue(mockSupplier);

      const response = await request(app)
        .post('/api/v1/auth/verify-phone')
        .send(reqBody);

      expect(response.status).toBe(200);
      expect(mockSupplier.save).toHaveBeenCalled();
    });
  });
});
