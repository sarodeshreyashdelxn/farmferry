import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import DeliveryAssociate from "./models/deliveryAssociate.model.js";
import bcrypt from "bcrypt";

// Load environment variables
dotenv.config();

const createTestDeliveryAssociates = async () => {
  try {
    // Connect to database
    await connectDB();
    
    const testAssociates = [
      {
        name: "Mike Johnson",
        email: "mike@farmferry.com",
        phone: "+1234567891",
        isOnline: true,
        isAvailable: true
      },
      {
        name: "Sarah Davis",
        email: "sarah@farmferry.com",
        phone: "+1234567892",
        isOnline: true,
        isAvailable: true
      },
      {
        name: "Tom Anderson",
        email: "tom@farmferry.com",
        phone: "+1234567893",
        isOnline: false,
        isAvailable: false
      },
      {
        name: "Lisa Wilson",
        email: "lisa@farmferry.com",
        phone: "+1234567894",
        isOnline: true,
        isAvailable: true
      }
    ];
    
    for (const associateData of testAssociates) {
      // Check if associate already exists
      const existingAssociate = await DeliveryAssociate.findOne({ email: associateData.email });
      
      if (existingAssociate) {
        console.log(`✅ Associate ${associateData.name} already exists!`);
        continue;
      }
      
      // Create associate
      const hashedPassword = await bcrypt.hash("delivery123", 10);
      
      const associate = await DeliveryAssociate.create({
        ...associateData,
        password: hashedPassword,
        role: "deliveryAssociate",
        status: "active",
        vehicle: {
          type: "motorcycle",
          number: "DL" + Math.random().toString(36).substr(2, 6).toUpperCase(),
          model: "Honda Activa",
          color: "Black"
        },
        address: {
          street: "123 Delivery St",
          city: "Test City",
          state: "Test State",
          postalCode: "12345",
          country: "Test Country"
        }
      });
      
      console.log(`✅ Created delivery associate: ${associate.name} (${associate.email})`);
    }
    
    console.log("\n🎉 All test delivery associates created successfully!");
    console.log("Default password for all associates: delivery123");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test delivery associates:", error);
    process.exit(1);
  }
};

createTestDeliveryAssociates();