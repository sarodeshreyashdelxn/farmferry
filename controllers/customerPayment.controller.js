import Order from "../models/order.model.js";
import Customer from "../models/customer.model.js";

// Get all customer payment records
export const getAllPaymentRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      method = "",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Build filter object - show orders that are either not returned OR are returned but paid
    const baseFilter = {
      $or: [
        { status: { $ne: "returned" } }, // Show non-returned orders
        { 
          status: "returned", 
          paymentStatus: "paid" // Show returned orders only if they were paid
        }
      ]
    };
    
    const filter = { ...baseFilter };
    
    // Search filter - search in customer name, orderId, or transactionId
    if (search) {
      filter.$and = [
        baseFilter,
        {
          $or: [
            { orderId: { $regex: search, $options: "i" } },
            { transactionId: { $regex: search, $options: "i" } }
          ]
        }
      ];
      delete filter.$or; // Remove the original $or since we're using $and now
    }

    // Status filter
    if (status && status !== "all") {
      if (status === "paid_returned") {
        // Special case for paid_returned: order status is returned AND payment status is paid
        filter.$and = filter.$and || [];
        filter.$and.push({
          $and: [
            { status: "returned" },
            { paymentStatus: "paid" }
          ]
        });
      } else {
        filter.paymentStatus = status;
      }
    }

    // Payment method filter
    if (method && method !== "all") {
      filter.paymentMethod = method;
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Fetch orders with payment information
    const orders = await Order.find(filter)
    .populate({
        path: 'customer',
        select: 'firstName lastName email phone addresses', // Include addresses field
        model: 'Customer' // Explicitly specify the model if needed
      }) // Populate customer details
      .select("orderId customer totalAmount paymentMethod paymentStatus transactionId createdAt")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalRecords = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    // Transform orders data to payment records format
    const paymentRecords = orders.map(order => ({
      paymentId: `PYM-${order.orderId}`, // Create payment ID from order ID
      customer: {
        id: order.customer._id,
        name: order.customer?.addresses?.[0]?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown Customer',
        firstName: order.customer?.firstName || '',
        lastName: order.customer?.lastName || '',
        email: order.customer?.email,
        phone: order.customer?.phone,
        addresses: order.customer?.addresses || []
      },
      amount: order.totalAmount,
      method: formatPaymentMethod(order.paymentMethod),
      status: order.paymentStatus,
      date: order.createdAt,
      transactionId: order.transactionId,
      orderId: order.orderId
    }));

    res.status(200).json({
      success: true,
      data: {
        records: paymentRecords,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords,
          limit: parseInt(limit),
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error("Error fetching payment records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment records",
      error: error.message
    });
  }
};

// Get payment record by ID
export const getPaymentRecordById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Extract order ID from payment ID (assuming format PYM-ORDERID)
    const orderId = paymentId.replace("PYM-", "");

    const order = await Order.findOne({ orderId })
      .populate("customer", "firstName lastName email phone addresses")
      .populate("supplier", "name email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    const paymentRecord = {
      paymentId: `PYM-${order.orderId}`,
      orderId: order.orderId,
      customer: {
        id: order.customer._id,
        name: order.customer?.addresses?.[0]?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown Customer',
        firstName: order.customer?.firstName || '',
        lastName: order.customer?.lastName || '',
        email: order.customer?.email,
        phone: order.customer?.phone,
        addresses: order.customer?.addresses || []
      },
      supplier: order.supplier ? {
        id: order.supplier._id,
        name: order.supplier.name,
        email: order.supplier.email,
        phone: order.supplier.phone
      } : null,
      amount: order.totalAmount,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      gst: order.gst,
      deliveryCharge: order.deliveryCharge,
      method: formatPaymentMethod(order.paymentMethod),
      status: order.paymentStatus,
      transactionId: order.transactionId,
      invoiceUrl: order.invoiceUrl,
      date: order.createdAt,
      deliveryAddress: order.deliveryAddress,
      items: order.items
    };

    res.status(200).json({
      success: true,
      data: paymentRecord
    });

  } catch (error) {
    console.error("Error fetching payment record:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment record",
      error: error.message
    });
  }
};

// Get payment statistics
export const getPaymentStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get payment statistics
    const stats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          completedPayments: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] }
          },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] }
          },
          refundedPayments: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0] }
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] }
          }
        }
      }
    ]);

    // Get payment method breakdown
    const methodStats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    const statistics = stats[0] || {
      totalPayments: 0,
      totalAmount: 0,
      completedPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
      completedAmount: 0
    };

    res.status(200).json({
      success: true,
      data: {
        overview: statistics,
        paymentMethods: methodStats,
        successRate: statistics.totalPayments > 0 
          ? ((statistics.completedPayments / statistics.totalPayments) * 100).toFixed(2)
          : 0
      }
    });

  } catch (error) {
    console.error("Error fetching payment statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment statistics",
      error: error.message
    });
  }
};

// Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, transactionId, note } = req.body;

    // Validate status
    const validStatuses = ["pending", "paid", "failed", "refunded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }

    // Extract order ID from payment ID
    const orderId = paymentId.replace("PYM-", "");

    const updateData = {
      paymentStatus: status,
      ...(transactionId && { transactionId }),
      ...(note && { $push: { statusHistory: { 
        status: status, 
        note: note,
        updatedAt: new Date() 
      }}})
    };

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId },
      updateData,
      { new: true }
    ).populate("customer", "name email phone");

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: {
        paymentId: `PYM-${updatedOrder.orderId}`,
        status: updatedOrder.paymentStatus,
        transactionId: updatedOrder.transactionId
      }
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message
    });
  }
};

// Export payment records to CSV
export const exportPaymentRecords = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status = "",
      method = ""
    } = req.query;

    // Build filter
    const filter = {};
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (status && status !== "all") {
      filter.paymentStatus = status;
    }
    
    if (method && method !== "all") {
      filter.paymentMethod = method;
    }

    const orders = await Order.find(filter)
      .populate("customer", "firstName lastName email phone addresses")
      .select("orderId customer totalAmount paymentMethod paymentStatus transactionId createdAt")
      .sort({ createdAt: -1 });

    // Transform to CSV format
    const csvData = orders.map(order => ({
      "Payment ID": `PYM-${order.orderId}`,
      "Customer": order.customer?.addresses?.[0]?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown Customer',
      "Amount": `₹${order.totalAmount}`,
      "Method": formatPaymentMethod(order.paymentMethod),
      "Status": order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1),
      "Transaction ID": order.transactionId || "-",
      "Date": order.createdAt.toLocaleDateString("en-IN"),
      "Time": order.createdAt.toLocaleTimeString("en-IN")
    }));

    res.status(200).json({
      success: true,
      data: csvData,
      filename: `payment-records-${new Date().toISOString().split('T')[0]}.csv`
    });

  } catch (error) {
    console.error("Error exporting payment records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export payment records",
      error: error.message
    });
  }
};

// Helper function to format payment method for display
const formatPaymentMethod = (method) => {
  const methodMap = {
    "credit_card": "Card",
    "debit_card": "Card", 
    "cash_on_delivery": "COD",
    "upi": "UPI",
    "bank_transfer": "Netbanking"
  };
  
  return methodMap[method] || method;
};