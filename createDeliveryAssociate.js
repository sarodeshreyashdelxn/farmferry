import mongoose from 'mongoose';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

// Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the model file
const modelPath = join(__dirname, 'models', 'deliveryAssociate.model.js');
const { default: DeliveryAssociate } = await import(pathToFileURL(modelPath).href);

// MongoDB URI
const MONGODB_URI = 'mongodb+srv://abhijeetghodedelxn:rcbQpHCqNXYRCMz1@cluster0.sfsxi.mongodb.net/farmferry';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const data = {
      name: 'Abhijeet Ghode',
      email: 'ghodeabhijeet18@gmail.com',
      phone: '9881012691',
      password: 'pass@123',
      address: {
        street: '123 Main St',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'India',
      },
      vehicle: {
        type: 'motorcycle',
        model: 'Honda Shine',
        registrationNumber: 'MH12AB1234',
        color: 'Black',
      },
    };

    const existing = await DeliveryAssociate.findOne({ email: data.email });
    if (existing) {
      console.log('⚠️ Delivery associate with this email already exists.');
    } else {
      await DeliveryAssociate.create(data);
      console.log('✅ Delivery associate created successfully!');
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit();
  }
}

main();
