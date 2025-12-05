import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import Admin from "./models/admin.model.js";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config();

const debugAuth = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Find admin user
    const admin = await Admin.findOne({ email: "admin@farmferry.com" });
    
    if (!admin) {
      console.log("❌ Admin user not found!");
      console.log("Please run: node createTestAdmin.js");
      process.exit(1);
    }
    
    console.log("✅ Admin user found:");
    console.log("ID:", admin._id);
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);
    console.log("Name:", admin.name);
    
    // Test token generation
    const accessToken = admin.generateAccessToken();
    console.log("\n🔑 Generated Access Token:");
    console.log(accessToken);
    
    // Decode token
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    console.log("\n📋 Decoded Token:");
    console.log("ID:", decoded.id);
    console.log("Email:", decoded.email);
    console.log("Role:", decoded.role);
    console.log("Expires:", new Date(decoded.exp * 1000));
    
    // Test token verification
    console.log("\n🔍 Testing token verification...");
    const testToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    console.log("✅ Token is valid!");
    console.log("Role in token:", testToken.role);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

debugAuth(); 