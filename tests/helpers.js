import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Customer from '../models/customer.model.js';
import Supplier from '../models/supplier.model.js';
import Admin from '../models/admin.model.js';
import DeliveryAssociate from '../models/deliveryAssociate.model.js';

/**
 * Create a test customer
 * @param {Object} customData - Custom data to override defaults
 * @returns {Promise<Object>} - Created customer and auth tokens
 */
export const createTestCustomer = async (customData = {}) => {
  const defaultData = {
    firstName: 'Test',
    lastName: 'Customer',
    email: 'test.customer@example.com',
    password: 'Password123!',
    phone: '1234567890',
    addresses: []
  };

  const customerData = { ...defaultData, ...customData };
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(customerData.password, salt);
  
  // Create customer
  const customer = await Customer.create({
    ...customerData,
    password: hashedPassword
  });
  
  // Generate tokens
  const accessToken = jwt.sign(
    { id: customer._id, role: 'customer' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id: customer._id, role: 'customer' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
  
  return {
    customer: customer.toObject(),
    accessToken,
    refreshToken
  };
};

/**
 * Create a test supplier
 * @param {Object} customData - Custom data to override defaults
 * @returns {Promise<Object>} - Created supplier and auth tokens
 */
export const createTestSupplier = async (customData = {}) => {
  const defaultData = {
    businessName: 'Test Farm',
    ownerName: 'Test Supplier',
    email: 'test.supplier@example.com',
    password: 'Password123!',
    phone: '1234567890',
    businessAddress: {
      street: '123 Farm St',
      city: 'Farmville',
      state: 'Farmland',
      postalCode: '12345',
      country: 'Farmcountry'
    },
    status: 'verified',
    businessType: 'Individual',
    description: 'Test farm for testing'
  };

  const supplierData = { ...defaultData, ...customData };
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(supplierData.password, salt);
  
  // Create supplier
  const supplier = await Supplier.create({
    ...supplierData,
    password: hashedPassword
  });
  
  // Generate tokens
  const accessToken = jwt.sign(
    { id: supplier._id, role: 'supplier' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id: supplier._id, role: 'supplier' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
  
  return {
    supplier: supplier.toObject(),
    accessToken,
    refreshToken
  };
};

/**
 * Create a test admin
 * @param {Object} customData - Custom data to override defaults
 * @returns {Promise<Object>} - Created admin and auth tokens
 */
export const createTestAdmin = async (customData = {}) => {
  const defaultData = {
    name: 'Test Admin',
    email: 'test.admin@example.com',
    password: 'Password123!',
    role: 'admin'
  };

  const adminData = { ...defaultData, ...customData };
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminData.password, salt);
  
  // Create admin
  const admin = await Admin.create({
    ...adminData,
    password: hashedPassword
  });
  
  // Generate tokens
  const accessToken = jwt.sign(
    { id: admin._id, role: 'admin' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id: admin._id, role: 'admin' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
  
  return {
    admin: admin.toObject(),
    accessToken,
    refreshToken
  };
};

/**
 * Create a test delivery associate
 * @param {Object} customData - Custom data to override defaults
 * @returns {Promise<Object>} - Created delivery associate and auth tokens
 */
export const createTestDeliveryAssociate = async (customData = {}) => {
  const defaultData = {
    name: 'Test Delivery',
    email: 'test.delivery@example.com',
    password: 'Password123!',
    phone: '1234567890',
    address: {
      street: '123 Delivery St',
      city: 'Deliveryville',
      state: 'Deliveryland',
      postalCode: '12345',
      country: 'Deliverycountry'
    },
    isOnline: true,
    currentLocation: {
      type: 'Point',
      coordinates: [77.5946, 12.9716] // Bangalore coordinates
    },
    vehicleDetails: {
      type: 'Bike',
      registrationNumber: 'DL-01-AB-1234',
      model: 'Test Model'
    }
  };

  const deliveryData = { ...defaultData, ...customData };
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(deliveryData.password, salt);
  
  // Create delivery associate
  const deliveryAssociate = await DeliveryAssociate.create({
    ...deliveryData,
    password: hashedPassword
  });
  
  // Generate tokens
  const accessToken = jwt.sign(
    { id: deliveryAssociate._id, role: 'deliveryAssociate' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { id: deliveryAssociate._id, role: 'deliveryAssociate' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
  
  return {
    deliveryAssociate: deliveryAssociate.toObject(),
    accessToken,
    refreshToken
  };
};
