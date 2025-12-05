#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envTemplate = `# Server Configuration
PORT=9000
NODE_ENV=development

# MongoDB Configuration
MONGO_DB_URI=mongodb://localhost:27017
DB_NAME=farmferry
MONGODB_URI=mongodb://localhost:27017/farmferry

# JWT Configuration
ACCESS_TOKEN_SECRET=your_access_token_secret_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email Configuration (using Gmail SMTP)
# For Gmail, you need to use an App Password, not your regular password
# Generate an App Password: https://myaccount.google.com/apppasswords
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=FarmFerry <your-email@gmail.com>

# Cloudinary Configuration (optional for now)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Backend API Base URL
BACKEND_API_BASE_URL=http://localhost:9000
`;

const envPath = path.join(__dirname, '.env');

try {
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. Skipping creation.');
    console.log('📝 Please update your existing .env file with the required variables.');
  } else {
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ .env file created successfully!');
    console.log('📝 Please update the .env file with your actual values:');
    console.log('   - Replace "your_access_token_secret_here" with a secure random string');
    console.log('   - Replace "your_refresh_token_secret_here" with a secure random string');
    console.log('   - Update email configuration if you want to send actual emails');
    console.log('   - Update Cloudinary configuration if you want to use image uploads');
  }
  
  console.log('\n🔧 Next steps:');
  console.log('1. Update the .env file with your actual values');
  console.log('2. Make sure MongoDB is running on localhost:27017');
  console.log('3. Run "npm start" to start the server');
  
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('\n📝 Please create a .env file manually with the following content:');
  console.log(envTemplate);
} 