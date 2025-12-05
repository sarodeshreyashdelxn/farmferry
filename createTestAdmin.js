import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import Admin from "./models/admin.model.js";
import bcrypt from "bcrypt";

// Load environment variables
dotenv.config();

const createTestAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: "admin@farmferry.com" });
    
    if (existingAdmin) {
      console.log("Test admin already exists!");
      console.log("Email: admin@farmferry.com");
      console.log("Password: admin123");
      process.exit(0);
    }
    
    // Create test admin
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    const admin = await Admin.create({
      name: {
        firstName: "Admin",
        lastName: "User"
      },
      email: "admin@farmferry.com",
      password: hashedPassword,
      phone: "+1234567890",
      role: "admin",
      permissions: ["all"]
    });
    
    console.log("✅ Test admin created successfully!");
    console.log("Email: admin@farmferry.com");
    console.log("Password: admin123");
    console.log("Admin ID:", admin._id);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test admin:", error);
    process.exit(1);
  }
};

createTestAdmin(); 