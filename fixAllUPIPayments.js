import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Order Schema (simplified for this script)
const orderSchema = new mongoose.Schema({
  _id: String,
  customer: String,
  supplier: String,
  items: Array,
  subtotal: Number,
  discountAmount: Number,
  gst: Number,
  platformFee: Number,
  handlingFee: Number,
  deliveryCharge: Number,
  totalAmount: Number,
  paymentMethod: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  paymentDetails: Object,
  status: String,
  isExpressDelivery: Boolean,
  deliveryAddress: Object,
  estimatedDeliveryDate: Date,
  orderId: String,
  statusHistory: Array,
  createdAt: Date,
  updatedAt: Date
});

const Order = mongoose.model('Order', orderSchema);

// Fix all UPI orders with pending payment status
const fixAllUPIPayments = async () => {
  try {
    // Find all UPI orders with pending payment status
    const pendingUPIOrders = await Order.find({
      paymentMethod: 'upi',
      paymentStatus: 'pending'
    });
    
    console.log(`Found ${pendingUPIOrders.length} UPI orders with pending payment status`);
    
    if (pendingUPIOrders.length === 0) {
      console.log('No UPI orders with pending payment status found');
      return;
    }
    
    let updatedCount = 0;
    
    for (const order of pendingUPIOrders) {
      try {
        console.log(`\nProcessing order: ${order.orderId} (${order._id})`);
        console.log(`Amount: ₹${order.totalAmount}`);
        
        // Update payment status to 'paid'
        const updatedOrder = await Order.findByIdAndUpdate(
          order._id,
          {
            paymentStatus: 'paid',
            transactionId: order.transactionId || `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            paymentDetails: order.paymentDetails || {
              method: 'upi',
              amount: order.totalAmount,
              timestamp: new Date().toISOString()
            },
            $push: {
              statusHistory: {
                status: order.status,
                updatedAt: new Date(),
                updatedBy: order.customer,
                updatedByModel: 'Customer',
                note: 'Payment status updated to paid (UPI payment)'
              }
            }
          },
          { new: true }
        );
        
        console.log(`✅ Updated order ${order.orderId} - Payment Status: ${updatedOrder.paymentStatus}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error updating order ${order.orderId}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} out of ${pendingUPIOrders.length} orders`);
    
  } catch (error) {
    console.error('Error fixing UPI payments:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
const main = async () => {
  await connectDB();
  await fixAllUPIPayments();
};

main();

