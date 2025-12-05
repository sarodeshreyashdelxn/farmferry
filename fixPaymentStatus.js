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

// Fix payment status for the specific order
const fixPaymentStatus = async () => {
  try {
    const orderId = '68a83d8ccc4255fe5f18b10e';
    
    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      console.log('Order not found');
      return;
    }
    
    console.log('Current order details:');
    console.log('Order ID:', order.orderId);
    console.log('Payment Method:', order.paymentMethod);
    console.log('Current Payment Status:', order.paymentStatus);
    console.log('Current Status:', order.status);
    
    // Update payment status to 'paid' since it's a UPI payment
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: 'paid',
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        paymentDetails: {
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
    
    console.log('\nOrder updated successfully!');
    console.log('New Payment Status:', updatedOrder.paymentStatus);
    console.log('Transaction ID:', updatedOrder.transactionId);
    console.log('Payment Details:', updatedOrder.paymentDetails);
    
  } catch (error) {
    console.error('Error fixing payment status:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
const main = async () => {
  await connectDB();
  await fixPaymentStatus();
};

main();

