import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import DeliveryAssociate from './models/deliveryAssociate.model.js';
import dotenv from 'dotenv';

dotenv.config();

async function testDeliveryAuth() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check existing delivery associates
    const deliveryAssociates = await DeliveryAssociate.find({}).select('name email phone');
    console.log('\n📋 Existing Delivery Associates:');
    if (deliveryAssociates.length === 0) {
      console.log('❌ No delivery associates found in database');
    } else {
      deliveryAssociates.forEach((da, index) => {
        console.log(`${index + 1}. Name: ${da.name}, Email: ${da.email}, Phone: ${da.phone}`);
      });
    }

    // Create a test delivery associate if none exist
    if (deliveryAssociates.length === 0) {
      console.log('\n🔧 Creating test delivery associate...');
      const testDeliveryAssociate = new DeliveryAssociate({
        name: 'Test Delivery Associate',
        email: 'test.delivery@farmferry.com',
        phone: '9876543210',
        password: 'password123',
        address: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '123456',
          country: 'India'
        },
        vehicle: {
          type: 'motorcycle',
          model: 'Honda Activa',
          registrationNumber: 'MH12AB1234',
          color: 'Red'
        }
      });

      await testDeliveryAssociate.save();
      console.log('✅ Test delivery associate created successfully');
      console.log('📱 Phone: 9876543210');
      console.log('🔑 Password: password123');
    }

    // Test password comparison for the first delivery associate
    if (deliveryAssociates.length > 0) {
      const firstDA = await DeliveryAssociate.findOne({ phone: deliveryAssociates[0].phone });
      console.log('\n🧪 Testing password comparison...');
      
      // Test with a common password
      const testPassword = 'password123';
      const isValid = await firstDA.isPasswordCorrect(testPassword);
      console.log(`Password "${testPassword}" is ${isValid ? 'VALID' : 'INVALID'} for ${firstDA.name}`);
      
      // Show the hashed password for debugging
      console.log(`Stored password hash: ${firstDA.password.substring(0, 20)}...`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testDeliveryAuth();
