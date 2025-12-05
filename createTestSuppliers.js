import mongoose from "mongoose";
import Supplier from "./models/supplier.model.js";
import dotenv from "dotenv";

dotenv.config();

const testSuppliers = [
  {
    businessName: "Fresh Farm Produce Co.",
    ownerName: "John Smith",
    email: "john@freshfarm.com",
    password: "password123",
    phone: "9876543210",
    businessType: "farmer",
    status: "approved",
    address: {
      street: "123 Farm Road",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400001"
    }
  },
  {
    businessName: "Organic Dairy Products",
    ownerName: "Sarah Johnson",
    email: "sarah@organicdairy.com",
    password: "password123",
    phone: "9876543211",
    businessType: "processor",
    status: "approved",
    address: {
      street: "456 Dairy Lane",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      postalCode: "411001"
    }
  },
  {
    businessName: "Premium Spices & Herbs",
    ownerName: "Raj Patel",
    email: "raj@premiumspices.com",
    password: "password123",
    phone: "9876543212",
    businessType: "wholesaler",
    status: "approved",
    address: {
      street: "789 Spice Market",
      city: "Delhi",
      state: "Delhi",
      country: "India",
      postalCode: "110001"
    }
  },
  {
    businessName: "Grain Distributors Ltd",
    ownerName: "Priya Sharma",
    email: "priya@graindistributors.com",
    password: "password123",
    phone: "9876543213",
    businessType: "wholesaler",
    status: "approved",
    address: {
      street: "321 Grain Street",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      postalCode: "560001"
    }
  },
  {
    businessName: "Cold Storage Logistics",
    ownerName: "Amit Kumar",
    email: "amit@coldstorage.com",
    password: "password123",
    phone: "9876543214",
    businessType: "other",
    status: "approved",
    address: {
      street: "654 Cold Storage Road",
      city: "Chennai",
      state: "Tamil Nadu",
      country: "India",
      postalCode: "600001"
    }
  }
];

async function createTestSuppliers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Check if suppliers already exist
    const existingSuppliers = await Supplier.find({ status: "approved" });
    console.log(`Found ${existingSuppliers.length} existing approved suppliers`);

    if (existingSuppliers.length > 0) {
      console.log("Suppliers already exist. Skipping creation.");
      console.log("Existing suppliers:");
      existingSuppliers.forEach((supplier, index) => {
        console.log(`${index + 1}. ${supplier.businessName} (${supplier.email})`);
      });
      return;
    }

    // Create test suppliers
    console.log("Creating test suppliers...");
    const createdSuppliers = await Supplier.insertMany(testSuppliers);
    
    console.log(`✅ Successfully created ${createdSuppliers.length} test suppliers:`);
    createdSuppliers.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.businessName} (${supplier.email})`);
    });

  } catch (error) {
    console.error("❌ Error creating test suppliers:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

createTestSuppliers(); 