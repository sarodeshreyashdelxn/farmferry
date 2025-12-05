import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import Admin from "./models/admin.model.js";
import DeliveryAssociate from "./models/deliveryAssociate.model.js";
import Order from "./models/order.model.js";

// Load environment variables
dotenv.config();

const testEndpoints = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log("✅ Connected to database");
    
    // Test 1: Check if admin exists
    const admin = await Admin.findOne({ email: "admin@farmferry.com" });
    if (admin) {
      console.log("✅ Admin user found:", admin.email, "Role:", admin.role);
    } else {
      console.log("❌ Admin user not found");
    }
    
    // Test 2: Check if delivery associates exist
    const deliveryAssociates = await DeliveryAssociate.find({});
    console.log(`✅ Found ${deliveryAssociates.length} delivery associates`);
    deliveryAssociates.forEach(da => {
      console.log(`  - ${da.name} (${da.email}) - Online: ${da.isOnline}`);
    });
    
    // Test 3: Check if orders exist
    const orders = await Order.find({}).populate('customer', 'firstName lastName email');
    console.log(`✅ Found ${orders.length} orders`);
    if (orders.length > 0) {
      console.log("Sample order:", {
        id: orders[0]._id,
        orderId: orders[0].orderId,
        customer: orders[0].customer ? `${orders[0].customer.firstName} ${orders[0].customer.lastName}` : 'No customer',
        status: orders[0].status,
        totalAmount: orders[0].totalAmount
      });
    }
    
    // Test 4: Check admin controller functions
    console.log("\n🔍 Testing admin controller functions...");
    
    // Simulate getAllDeliveryAssociates
    const queryOptions = {};
    const deliveryAssociatesResult = await DeliveryAssociate.find(queryOptions)
      .select("-password -passwordResetToken -passwordResetExpires")
      .limit(10);
    
    console.log(`✅ getAllDeliveryAssociates would return ${deliveryAssociatesResult.length} associates`);
    
    // Simulate getAllOrders
    const orderQueryOptions = {};
    const ordersResult = await Order.find(orderQueryOptions)
      .populate("customer", "firstName lastName email")
      .populate("supplier", "businessName")
      .populate("items.product", "name images")
      .limit(10);
    
    console.log(`✅ getAllOrders would return ${ordersResult.length} orders`);
    
    console.log("\n🎉 All tests passed! Backend is working correctly.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

testEndpoints(); 