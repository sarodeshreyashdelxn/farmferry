import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import SuperAdmin from "./models/superadmin.model.js";

// Load environment variables
dotenv.config();

const createTestSuperAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    
    const email = 'superadmin@farmferry.com';
    const password = 'SuperAdmin123!';
    const name = 'Test SuperAdmin';

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    
    if (existingSuperAdmin) {
      console.log("✅ Test SuperAdmin already exists!");
      console.log("Email:", email);
      console.log("Password:", password);
      process.exit(0);
    }
    
    // Create test SuperAdmin
    const superadmin = await SuperAdmin.create({ 
      name, 
      email, 
      password 
    });
    
    console.log("✅ Test SuperAdmin created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("SuperAdmin ID:", superadmin._id);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test SuperAdmin:", error);
    process.exit(1);
  }
};

createTestSuperAdmin(); 