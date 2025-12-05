//order.controller
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";
import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendSMS from "../utils/sms.js";
import sendEmail from "../utils/email.js";
import Supplier from "../models/supplier.model.js";
import Admin from "../models/admin.model.js";
import Customer from "../models/customer.model.js";
import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import { generateInvoicePDF, shouldGenerateInvoice, getInvoiceUrl } from "../utils/invoiceGenerator.js";
import fs from 'fs';
import path from 'path';

export const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    deliveryAddress,
    paymentMethod,
    couponCode,
    isExpressDelivery,
    notes,
    paymentStatus,
    transactionId,
    paymentDetails
  } = req.body;

  console.log('Order creation request body:', req.body);
  console.log('Items received:', items);

  // Validate required fields
  if (!items || !items.length || !deliveryAddress || !paymentMethod) {
    throw new ApiError(400, "Items, delivery address, and payment method are required");
  }

  // Group items by supplier
  const itemsBySupplier = {};

  // Validate items and calculate totals
  for (const item of items) {
    console.log('Processing item:', item);
    if (!item.product || !item.quantity) {
      console.log('Invalid item - product:', item.product, 'quantity:', item.quantity);
      throw new ApiError(400, "Product ID and quantity are required for each item");
    }

    // Get product details
    const product = await Product.findById(item.product);
    if (!product) {
      throw new ApiError(404, `Product not found: ${item.product}`);
    }

    // Check stock
    if (product.stockQuantity < item.quantity) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`);
    }

    // Get variation if specified
    let variationPrice = 0;
    if (item.variation) {
      const variation = product.variations.find(v =>
        v.name === item.variation.name && v.value === item.variation.value
      );

      if (variation) {
        variationPrice = variation.additionalPrice || 0;

        // Check variation stock
        if (variation.stockQuantity < item.quantity) {
          throw new ApiError(400, `Insufficient stock for ${product.name} (${variation.name}: ${variation.value})`);
        }
      }
    }

    // Calculate price
    const price = product.price + variationPrice;
    const discountedPrice = product.discountedPrice
      ? product.discountedPrice + variationPrice
      : price;

    // Group by supplier
    const supplierId = product.supplierId.toString();
    if (!itemsBySupplier[supplierId]) {
      itemsBySupplier[supplierId] = [];
    }

    // Add item to supplier group
    itemsBySupplier[supplierId].push({
      product: product._id,
      quantity: item.quantity,
      price,
      discountedPrice,
      variation: item.variation,
      totalPrice: item.quantity * discountedPrice
    });
  }

  // Create orders for each supplier
  const orders = [];

  for (const supplierId in itemsBySupplier) {
    const supplierItems = itemsBySupplier[supplierId];

    // Calculate subtotal
    const subtotal = supplierItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Calculate delivery charge - waive if order is above ₹500
    let deliveryCharge = 0;
    if (subtotal < 500) {
      deliveryCharge = isExpressDelivery ? 50 : 20; // Apply delivery charge only for orders below ₹500
    }

    // Calculate GST based on product GST rates
    let totalGST = 0;
    for (const item of supplierItems) {
      const product = await Product.findById(item.product);
      if (product && product.gst) {
        const itemPrice = item.discountedPrice || item.price;
        const itemGST = (itemPrice * product.gst / 100) * item.quantity;
        totalGST += itemGST;
      }
    }

    // Calculate discount amount (if coupon applied)
    let discountAmount = 0;
    if (couponCode) {
      // In a real application, validate coupon code and calculate discount
      // For now, use a placeholder value
      discountAmount = Math.round(subtotal * 0.1); // 10% discount
    }

    // Calculate platform fee (default value from schema)
    const platformFee = 2; // Default platform fee as per schema

    // Calculate handling fee based on product categories
    let totalHandlingFee = 0;
    for (const item of supplierItems) {
      const product = await Product.findById(item.product).populate({
        path: 'categoryId',
        select: 'name handlingFee parent'
      });
      console.log('Product:', product ? product.name : 'Not found');
      console.log('Product categoryId:', product ? product.categoryId : 'No category');

      if (product && product.categoryId) {
        console.log('Category details:', {
          categoryId: product.categoryId._id,
          categoryName: product.categoryId.name,
          parent: product.categoryId.parent,
          handlingFee: product.categoryId.handlingFee
        });

        // Only apply handling fee if category has a parent (is a subcategory)
        if (product.categoryId.parent && product.categoryId.handlingFee) {
          const itemHandlingFee = product.categoryId.handlingFee;
          totalHandlingFee += itemHandlingFee;
          console.log(`Handling fee for ${product.name} (subcategory): ${product.categoryId.handlingFee} = ${itemHandlingFee}`);
        } else if (!product.categoryId.parent) {
          console.log(`No handling fee applied for ${product.name} (main category)`);
        } else {
          console.log(`No handling fee set for subcategory: ${product.categoryId.name}`);
        }
      } else {
        console.log('Product or category not found');
      }
    }
    console.log('Total handling fee:', totalHandlingFee);
    // Calculate total amount including GST, platform fee and handling fee
    const totalAmount = subtotal - discountAmount + totalGST + deliveryCharge + platformFee + totalHandlingFee;

    // Create order
    const order = await Order.create({
      customer: req.user._id,
      supplier: supplierId,
      items: supplierItems,
      subtotal,
      couponCode,
      discountAmount,
      gst: totalGST,
      platformFee,
      handlingFee: totalHandlingFee,
      deliveryCharge,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentStatus || "pending",
      transactionId: transactionId || null,
      paymentDetails: paymentDetails || null,
      status: "pending",
      isExpressDelivery: isExpressDelivery || false,
      deliveryAddress,
      notes,
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
    });

    // Add status history entry
    order.statusHistory.push({
      status: "pending",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "Customer"
    });

    await order.save();

    // Update product stock
    for (const item of supplierItems) {
      const product = await Product.findById(item.product);

      // Update main stock
      product.stockQuantity -= item.quantity;

      // Update variation stock if applicable
      if (item.variation) {
        const variationIndex = product.variations.findIndex(v =>
          v.name === item.variation.name && v.value === item.variation.value
        );

        if (variationIndex !== -1) {
          product.variations[variationIndex].stockQuantity -= item.quantity;
        }
      }

      await product.save();
    }

    orders.push(order);

    // --- Notification Logic ---
    // Fetch customer and supplier details
    const customer = await Customer.findById(req.user._id);
    const supplier = await Supplier.findById(supplierId);

    // Send SMS notification to all active delivery boys
    try {
      // Fetch all active delivery associates
      const deliveryAssociates = await DeliveryAssociate.find({ isActive: true });

      if (deliveryAssociates.length > 0) {
        // Prepare SMS body
        const smsBody = `New order available! Order ID: ${order.orderId}. Check your app for details.`;

        // Send SMS to each delivery associate
        const smsPromises = deliveryAssociates.map(async (da) => {
          if (da.phone) {
            try {
              await sendSMS.sendSMS(da.phone, smsBody);
              console.log(`✅ SMS sent to delivery associate ${da.name || da.phone} for order ${order.orderId}`);
            } catch (smsError) {
              console.error(`❌ Failed to send SMS to ${da.phone}:`, smsError.message);
            }
          }
        });

        // Wait for all SMS to be sent (but don't fail if some fail)
        await Promise.allSettled(smsPromises);
        console.log(`📱 SMS notifications sent to ${deliveryAssociates.length} delivery associates for order ${order._id}`);
      } else {
        console.log(`⚠️ No active delivery associates found to notify for order ${order.orderId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send SMS notifications to delivery boys for order ${order.orderId}:`, error);
      // Don't fail the order creation if SMS fails
    }

    try {
      // Create notifications for all delivery associates
      const notificationPromises = DeliveryAssociate.map(async (da) => {
        await Notification.create({
          recipient: da._id,
          title: 'New Order Available',
          message: 'A new delivery order is available',
          body: `New order available! Order ID: ${order.orderId}. Check your app for details.`,
          type: 'order_available',
          relatedOrder: order._id,
          isRead: false
        });
      });

      await Promise.allSettled(notificationPromises);
      console.log(`📋 Notifications created for ${DeliveryAssociate.length} delivery associates`);
    } catch (error) {
      console.error('Error creating notifications:', error);
    }

    try {
      // Find admin user(s)
      const admins = await Admin.find({}).select("phone");

      if (admins.length > 0) {
        // Prepare SMS body for admin
        const adminSmsBody = `New order received! Order ID: ${order.orderId}. Total amount: ₹${order.totalAmount}. Customer: ${customer?.firstName || ''} ${customer?.lastName || ''}`;

        // Send SMS to each admin
        const adminSmsPromises = admins.map(async (admin) => {
          if (admin.phone) {
            try {
              await sendSMS.sendSMS(admin.phone, adminSmsBody);
              console.log(`✅ SMS sent to admin ${admin.phone} for order ${order.orderId}`);
            } catch (smsError) {
              console.error(`❌ Failed to send SMS to admin ${admin.phone}:`, smsError.message);
            }
          }
        });

        // Wait for all admin SMS to be sent
        await Promise.allSettled(adminSmsPromises);
        console.log(`📱 SMS notifications sent to ${admins.length} admins for order ${order.orderId}`);
      } else {
        console.log(`⚠️ No admin users found to notify for order ${order.orderId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send SMS notifications to admins for order ${order.orderId}:`, error);
      // Don't fail the order creation if SMS fails
    }

    // Send SMS to supplier
    if (supplier && supplier.phone) {
      try {
        await sendSMS.sendSMS(
          supplier.phone,
          `You have a new order! Order ID: ${order.orderId}. Check your app for details.`
        );
        console.log(`✅ SMS sent to supplier ${supplier.businessName || supplier.phone} for order ${order.orderId}`);
      } catch (smsError) {
        console.error(`❌ Failed to send SMS to supplier ${supplier.phone}:`, smsError.message);
        // Don't fail the order creation if SMS fails
      }
    }

    // Send SMS to customer
    // if (customer && customer.phone) {
    //   // Format phone number to E.164 (prepend +91 if not present)
    //   let to = customer.phone;
    //   if (!to.startsWith('+')) {
    //     to = '+91' + to;
    //   }
    //   await sendSMS(
    //     to,
    //     `Your order ${order._id} has been placed successfully!`
    //   );
    // }

    // Send Email to customer
    if (customer && customer.email) {
      // Populate order with product details for email
      const populatedOrder = await Order.findById(order._id)
        .populate("items.product", "name price discountedPrice images")
        .populate("supplier", "businessName address");

      // Generate order summary HTML
      const orderSummaryHTML = generateOrderSummaryHTML(populatedOrder, customer);

      await sendEmail({
        to: customer.email,
        subject: "Order Confirmation - FarmFerry",
        html: orderSummaryHTML
      });
    }

    // Send Email to supplier
    if (supplier && supplier.email) {
      // Populate order with product details for email
      const populatedOrder = await Order.findById(order._id)
        .populate("items.product", "name price discountedPrice images")
        .populate("customer", "firstName lastName email phone");

      // Generate supplier order notification HTML
      const supplierOrderHTML = generateSupplierOrderHTML(populatedOrder, supplier);

      await sendEmail({
        to: supplier.email,
        subject: "New Order Received - FarmFerry",
        html: supplierOrderHTML
      });
    }
    // --- End Notification Logic ---
  }

  // Clear customer's cart if order was created from cart
  if (req.body.clearCart) {
    const cart = await Cart.findOne({ customer: req.user._id });
    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      await cart.save();
    }
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      { orders },
      "Orders created successfully"
    )
  );
});

// Get all orders (admin only)
export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    status,
    customerId,
    supplierId,
    startDate,
    endDate,
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 10
  } = req.query;

  const queryOptions = {};

  // Filter by status
  if (status) {
    queryOptions.status = status;
  }

  // Filter by customer
  if (customerId) {
    queryOptions.customer = customerId;
  }

  // Filter by supplier
  if (supplierId) {
    queryOptions.supplier = supplierId;
  }

  // Filter by date range
  if (startDate && endDate) {
    queryOptions.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else if (startDate) {
    queryOptions.createdAt = { $gte: new Date(startDate) };
  } else if (endDate) {
    queryOptions.createdAt = { $lte: new Date(endDate) };
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;

  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("customer", "firstName lastName email phone addresses")
    .populate("supplier", "businessName address")
    .populate("items.product", "name images")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Orders fetched successfully"
    )
  );
});

// Get order by ID
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName email phone address")
    .populate("items.product", "name images")
    .populate("deliveryAssociate.associate", "name phone");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer._id.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  const isDeliveryAssociate = req.user.role === "deliveryAssociate" &&
    order.deliveryAssociate?.associate?.toString() === req.user._id.toString();

  if (!isCustomer && !isSupplier && !isAdmin && !isDeliveryAssociate) {
    throw new ApiError(403, "You are not authorized to view this order");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order fetched successfully"
    )
  );
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  const isDeliveryAssociate = req.user.role === "deliveryAssociate" &&
    order.deliveryAssociate?.associate?.toString() === req.user._id.toString();

  if (!isCustomer && !isSupplier && !isAdmin && !isDeliveryAssociate) {
    throw new ApiError(403, "You are not authorized to update this order");
  }

  // Validate status transition based on role
  const validTransitions = {
    customer: {
      pending: ["cancelled"],
      delivered: ["returned"]
    },
    supplier: {
      pending: ["pending", "cancelled"],
      processing: ["processing", "cancelled"],
      out_for_delivery: ["cancelled", "damaged"]
    },
    admin: {
      pending: ["processing", "cancelled"],
      processing: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered", "cancelled", "damaged"],
      delivered: ["returned"],
      cancelled: ["pending"],
      returned: ["processing"],
      damaged: []
    },
    deliveryAssociate: {
      out_for_delivery: ["out_for_delivery"]
    }
  };

  // Additional validation for return requests
  if (status === "returned") {
    // Only customers can return orders
    if (req.user.role !== "customer") {
      throw new ApiError(403, "Only customers can return orders");
    }

    // Order must be delivered
    if (order.status !== "delivered") {
      throw new ApiError(400, "Only delivered orders can be returned");
    }

    // Check if order was delivered within 7 days
    if (order.deliveredAt) {
      const daysSinceDelivery = (new Date() - new Date(order.deliveredAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > 7) {
        throw new ApiError(400, "Return window has expired. Orders can only be returned within 7 days of delivery");
      }
    }

    // Return reason is required
    if (!note || !note.trim()) {
      throw new ApiError(400, "Return reason is required");
    }
  }

  // Debug logging for transition check
  console.log('--- Order Status Transition Debug ---');
  console.log('Current order.status:', order.status);
  console.log('Requested status:', status);
  console.log('User role:', req.user.role);
  console.log('Allowed transitions for this status:', validTransitions[req.user.role][order.status]);
  console.log('-------------------------------------');

  const roleTransitions = validTransitions[req.user.role];
  if (!roleTransitions || !roleTransitions[order.status] || !roleTransitions[order.status].includes(status)) {
    throw new ApiError(400, `Cannot transition from ${order.status} to ${status} as ${req.user.role}`);
  }

  // Update order status
  order.status = status;

  // Set return reason if status is returned
  if (status === "returned" && note) {
    order.returnReason = note;
  }

  // Add status history entry
  order.statusHistory.push({
    status,
    updatedAt: new Date(),
    updatedBy: req.user._id,
    updatedByModel: req.user.role === "customer" ? "Customer" :
      req.user.role === "supplier" ? "Supplier" :
        req.user.role === "admin" ? "Admin" : "DeliveryAssociate",
    note: note || ""
  });

  // Update delivered date if status is delivered
  if (status === "delivered") {
    order.deliveredAt = new Date();
  }

  // Notify when marked as damaged
  if (status === "damaged") {
    console.log(`Order ${order._id} marked as DAMAGED by ${req.user.role} (${req.user._id}) at ${new Date().toISOString()}`);
  }

  await order.save();

  // Auto-generate invoice when order is delivered or payment is completed
  if (status === "delivered" || (order.paymentMethod !== "cash_on_delivery" && order.paymentStatus === "paid")) {
    await autoGenerateInvoice(order);
  }

  // Notify supplier and admin if order is returned
  if (status === "returned") {
    // Fetch supplier and admin
    const supplier = await Supplier.findById(order.supplier);
    const admin = await Admin.findOne({});
    const customer = await Customer.findById(order.customer);
    const reason = note || "No reason provided.";
    // Email content
    const subject = `Order #${order._id} Return Requested`;
    const html = `
      <h2>Order Return Requested</h2>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Customer:</strong> ${customer?.firstName || ""} ${customer?.lastName || ""} (${customer?.email || ""})</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    `;
    if (supplier?.email) {
      await sendEmail({
        to: supplier.email,
        subject,
        html
      });
    }
    if (admin?.email) {
      await sendEmail({
        to: admin.email,
        subject,
        html
      });
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order status updated successfully"
    )
  );
});

// Assign delivery associate to order
export const assignDeliveryAssociate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deliveryAssociateId } = req.body;

  if (!deliveryAssociateId) {
    throw new ApiError(400, "Delivery associate ID is required");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization (only admin or supplier can assign)
  const isSupplier = req.user.role === "supplier" && order.supplier.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to assign delivery associate");
  }

  // Check if order status is valid for assignment
  if (order.status !== "processing") {
    throw new ApiError(400, "Delivery associate can only be assigned to orders in processing status");
  }

  const deliveryAssociate = await DeliveryAssociate.findById(deliveryAssociateId);
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  // Update delivery associate
  order.deliveryAssociate = {
    associate: deliveryAssociateId,
    name: deliveryAssociate.name,
    assignedAt: new Date(),
    status: "assigned"
  };

  await order.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Delivery associate assigned successfully"
    )
  );
});


export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization (only delivery associate assigned to this order can update)
  const isAssignedDeliveryAssociate =
    req.user.role === "deliveryAssociate" &&
    order.deliveryAssociate?.associate?.toString() === req.user._id.toString();

  if (!isAssignedDeliveryAssociate) {
    throw new ApiError(403, "You are not authorized to update delivery status");
  }

  // Validate status transition
  const validTransitions = {
    assigned: ["picked_up"],
    picked_up: ["out_for_delivery"],
    out_for_delivery: ["delivered", "failed"],
    delivered: [],
    failed: []
  };

  if (
    !validTransitions[order.deliveryAssociate.status] ||
    !validTransitions[order.deliveryAssociate.status].includes(status)
  ) {
    throw new ApiError(
      400,
      `Cannot transition from ${order.deliveryAssociate.status} to ${status}`
    );
  }

  // Update delivery status
  order.deliveryAssociate.status = status;

  // Update order status if delivery status is delivered
  if (status === "delivered") {
    order.status = "delivered";
    order.deliveredAt = new Date();

    // ✅ NEW: Mark payment as paid when delivered (for all payment methods)
    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.paymentReceivedAt = new Date(); // optional timestamp

      const paymentNote = order.paymentMethod === "cash_on_delivery"
        ? "Payment received (Cash on Delivery)"
        : "Payment confirmed upon delivery";

      order.statusHistory.push({
        status: "paid",
        updatedAt: new Date(),
        updatedBy: req.user._id,
        updatedByModel: "DeliveryAssociate",
        note: paymentNote
      });
    }

    // Add status history entry
    order.statusHistory.push({
      status: "delivered",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "DeliveryAssociate",
      note: note || "Delivered by delivery associate"
    });
  }

  await order.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Delivery status updated successfully"
    )
  );
});

// Get my orders (supplier only)
export const getMyOrders = asyncHandler(async (req, res) => {
  const {
    status,
    startDate,
    endDate,
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 10
  } = req.query;

  const queryOptions = { supplier: req.user._id };

  // Filter by status
  if (status) {
    queryOptions.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    queryOptions.createdAt = {};
    if (startDate) queryOptions.createdAt.$gte = new Date(startDate);
    if (endDate) queryOptions.createdAt.$lte = new Date(endDate);
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;

  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("customer", "firstName lastName email phone")
    .populate("items.product", "name images price discountedPrice")
    .populate("deliveryAssociate.associate", "name phone")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Orders fetched successfully"
    )
  );
});

// Get order status counts (supplier only)
export const getOrderStatusCounts = asyncHandler(async (req, res) => {
  const supplierId = req.user._id;
  // Aggregate counts by status for this supplier
  const counts = await Order.aggregate([
    { $match: { supplier: supplierId } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  // Format counts
  const statusCounts = {
    all: 0,
    pending: 0,
    processing: 0,
    out_for_delivery: 0,
    delivered: 0,
  };
  counts.forEach(item => {
    if (statusCounts.hasOwnProperty(item._id)) {
      statusCounts[item._id] = item.count;
      statusCounts.all += item.count;
    }
  });
  return res.status(200).json(new ApiResponse(200, statusCounts, "Order status counts fetched successfully"));
});

// Get available orders for delivery associates (unassigned orders in processing state)
export const getAvailableOrdersForDelivery = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    status: { $in: ["pending", "processing"] },
    $or: [
      { "deliveryAssociate.associate": { $exists: false } },
      { "deliveryAssociate.associate": null }
    ]
  })
    .populate({
      path: "customer",
      select: "firstName lastName email phone",
      populate: { path: "addresses", select: "name type" }
    })
    .populate("supplier", "businessName address")
    .populate("items.product", "name images");

  return res.status(200).json(
    new ApiResponse(200, { orders }, "Available orders fetched successfully")
  );
});

export const selfAssignOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.deliveryAssociate?.associate)
    throw new ApiError(400, "Order already assigned");
  if (!["pending", "processing"].includes(order.status))
    throw new ApiError(400, "Order not available for assignment");

  order.deliveryAssociate = {
    associate: req.user._id,
    assignedAt: new Date(),
    name: req.user.name,

    status: "packaging" // delivery associate internal status
  };

  order.status = "packaging"; // 👈 main order status
  order.statusHistory.push({
    status: "packaging",
    updatedAt: new Date(),
    updatedBy: req.user._id,
    updatedByModel: "DeliveryAssociate",
    note: "Order accepted by delivery associate"
  });

  await order.save();

  // Notify customer via SMS that order is being packed
  try {
    const customer = await Customer.findById(order.customer);
    if (customer && customer.phone) {
      const smsBody = `Hi ${customer.addresses?.[0].name || 'Customer'}, your order is being packed.`;
      try {
        const smsResult = await sendSMS.sendSmsThroughWhatsapp(customer.phone, smsBody);
        console.log(`✅ Packaging SMS sent to customer ${customer.firstName || ''} ${customer.lastName || ''} (${customer.phone}) for order ${order.orderId || order._id}`);
        console.log(`📦 Message SID: ${smsResult.sid}`);
      } catch (smsError) {
        console.error(`❌ Failed to send packaging SMS to customer ${customer.phone} for order ${order.orderId || order._id}:`, smsError.message);
      }
    } else {
      console.log(`⚠️ No valid phone number for customer on order ${order.orderId || order._id}`);
    }
  } catch (notifyError) {
    console.error(`❌ Error preparing packaging SMS for order ${order.orderId || order._id}:`, notifyError);
  }

  return res.status(200).json(
    new ApiResponse(200, { order }, "Order self-assigned successfully")
  );
});

// Get my orders (customer only)
export const getMyCustomerOrders = asyncHandler(async (req, res) => {
  const {
    status,
    startDate,
    endDate,
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 10
  } = req.query;

  const queryOptions = { customer: req.user._id };

  // Filter by status
  if (status) {
    queryOptions.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    queryOptions.createdAt = {};
    if (startDate) queryOptions.createdAt.$gte = new Date(startDate);
    if (endDate) queryOptions.createdAt.$lte = new Date(endDate);
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;

  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("supplier", "businessName address")
    .populate("items.product", "name images price discountedPrice")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Orders fetched successfully"
    )
  );
});


// In backend - orders controller
export const getAvailableOrdersNearby = asyncHandler(async (req, res) => {
  const { longitude, latitude, maxDistance = 10000 } = req.query;

  if (!longitude || !latitude) {
    throw new ApiError(400, "Longitude and latitude are required");
  }
  console.log("User location:", latitude, longitude);
  const orders = await Order.find({
    status: "pending",
    isAssigned: false,
    "deliveryAddress.location": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: parseInt(maxDistance),
      }
    }
  })
    .populate("customer", "firstName lastName")
    .select("_id createdAt customer deliveryAddress");

  console.log("Found orders:", orders.map(o => o.deliveryAddress.location));
  return res.status(200).json(
    new ApiResponse(200, { orders }, "Nearby available orders fetched")
  );
});


// Generate invoice for an order
export const generateOrderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName email phone address")
    .populate("items.product", "name images price discountedPrice");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer._id.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isCustomer && !isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to generate invoice for this order");
  }

  // Check if invoice should be generated
  if (!shouldGenerateInvoice(order)) {
    throw new ApiError(400, "Invoice can only be generated for delivered orders or paid online payments");
  }

  // Check if invoice already exists
  if (order.invoiceUrl) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          invoiceUrl: getInvoiceUrl(order),
          message: "Invoice already exists"
        },
        "Invoice URL retrieved successfully"
      )
    );
  }

  try {
    // Generate invoice
    const invoiceUrl = await generateInvoicePDF(order, order.customer, order.supplier);

    // Update order with invoice URL
    order.invoiceUrl = invoiceUrl;
    await order.save();

    return res.status(200).json(
      new ApiResponse(
        200,
        { invoiceUrl },
        "Invoice generated successfully"
      )
    );
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw new ApiError(500, "Failed to generate invoice");
  }
});

// Update payment status for an order
export const updateOrderPaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus, transactionId, paymentDetails } = req.body;

  if (!paymentStatus) {
    throw new ApiError(400, "Payment status is required");
  }

  // Validate payment status
  const validStatuses = ["pending", "paid", "failed", "refunded"];
  if (!validStatuses.includes(paymentStatus)) {
    throw new ApiError(400, "Invalid payment status");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isCustomer && !isAdmin) {
    throw new ApiError(403, "You are not authorized to update payment status for this order");
  }

  // Update payment status
  order.paymentStatus = paymentStatus;
  if (transactionId) {
    order.transactionId = transactionId;
  }
  if (paymentDetails) {
    order.paymentDetails = paymentDetails;
  }

  // Add status history entry
  order.statusHistory.push({
    status: order.status,
    updatedAt: new Date(),
    updatedBy: req.user._id,
    updatedByModel: req.user.role === "customer" ? "Customer" : "Admin",
    note: `Payment status updated to ${paymentStatus}`
  });

  await order.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Payment status updated successfully"
    )
  );
});

// Get invoice file for an order
export const getOrderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName email phone address");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer._id.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isCustomer && !isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to view invoice for this order");
  }

  if (!order.invoiceUrl) {
    throw new ApiError(404, "Invoice not found for this order");
  }

  try {
    // Get the file path from the URL
    const filePath = path.join(__dirname, '../public', order.invoiceUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, "Invoice file not found");
    }

    // Set headers for text file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.txt"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving invoice file:', error);
    throw new ApiError(500, "Failed to serve invoice file");
  }
});

// Auto-generate invoice when order is delivered
export const autoGenerateInvoice = async (order) => {
  try {
    if (shouldGenerateInvoice(order)) {
      const populatedOrder = await Order.findById(order._id)
        .populate("customer", "firstName lastName email phone")
        .populate("supplier", "businessName email phone address")
        .populate("items.product", "name images price discountedPrice");

      if (!populatedOrder.invoiceUrl) {
        const invoiceUrl = await generateInvoicePDF(populatedOrder, populatedOrder.customer, populatedOrder.supplier);
        populatedOrder.invoiceUrl = invoiceUrl;
        await populatedOrder.save();

        console.log(`Invoice generated for order ${order.orderId}: ${invoiceUrl}`);
      }
    }
  } catch (error) {
    console.error('Error auto-generating invoice:', error);
  }
};

// Helper function to generate customer order summary HTML
const generateOrderSummaryHTML = (order, customer) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Generate product items HTML
  const productItemsHTML = order.items.map(item => {
    const product = item.product;
    const itemPrice = item.discountedPrice || item.price;
    const itemTotal = item.quantity * itemPrice;
    const variationText = item.variation ? ` (${item.variation.name}: ${item.variation.value})` : '';

    return `
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 12px; text-align: left;">
          <div style="font-weight: 600; color: #333;">${product.name}${variationText}</div>
        </td>
        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; text-align: right;">${formatCurrency(itemPrice)}</td>
        <td style="padding: 12px; text-align: right;">${formatCurrency(itemTotal)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - FarmFerry</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🍃 FarmFerry</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Purely Fresh, Perfectly Delivered!!</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #4CAF50; margin-top: 0;">Order Confirmation</h2>
        <p>Dear <strong>${customer.firstName} ${customer.lastName}</strong>,</p>
        <p>Thank you for your order! We're excited to bring fresh, quality products from our trusted farmers directly to your doorstep.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Order Details</h3>
          <table style="width: 100%; margin-bottom: 15px;">
            <tr>
              <td style="font-weight: 600;">Order ID:</td>
              <td>${order._id}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Order Date:</td>
              <td>${formatDate(order.createdAt)}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Supplier:</td>
              <td>${order.supplier.businessName}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Payment Method:</td>
              <td>${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment'}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Delivery Type:</td>
              <td>${order.isExpressDelivery ? 'Express Delivery' : 'Standard Delivery'}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 25px 0;">
          <h3 style="color: #333;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <thead style="background: #4CAF50; color: white;">
              <tr>
                <th style="padding: 15px; text-align: left;">Product</th>
                <th style="padding: 15px; text-align: center;">Qty</th>
                <th style="padding: 15px; text-align: right;">Price</th>
                <th style="padding: 15px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productItemsHTML}
            </tbody>
          </table>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Order Summary</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Subtotal:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.subtotal)}</td>
            </tr>
            ${order.discountAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #4CAF50;">Discount:</td>
              <td style="padding: 8px 0; text-align: right; color: #4CAF50;">-${formatCurrency(order.discountAmount)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Delivery Charge:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.deliveryCharge)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">GST:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.gst)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Platform Fee:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.platformFee)}</td>
            </tr>
            ${order.handlingFee > 0 ? `
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Handling Fee:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.handlingFee)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #4CAF50; font-size: 18px;">
              <td style="padding: 12px 0; font-weight: 700;">Total Amount:</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 700;">${formatCurrency(order.totalAmount)}</td>
            </tr>
          </table>
        </div>

        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
          <h3 style="margin-top: 0; color: #2e7d32;">Delivery Information</h3>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.pincode}</p>
          <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> ${formatDate(order.estimatedDeliveryDate)}</p>
          ${order.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${order.notes}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">Thank you for choosing FarmFerry!</p>
          <p style="color: #666; font-size: 14px;">For any questions, please contact our support team.</p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p>This is an automated email from FarmFerry. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
};

// Helper function to generate supplier order notification HTML
const generateSupplierOrderHTML = (order, supplier) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate product items HTML
  const productItemsHTML = order.items.map(item => {
    const product = item.product;
    const itemPrice = item.discountedPrice || item.price;
    const itemTotal = item.quantity * itemPrice;
    const variationText = item.variation ? ` (${item.variation.name}: ${item.variation.value})` : '';

    return `
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 12px; text-align: left;">
          <div style="font-weight: 600; color: #333;">${product.name}${variationText}</div>
        </td>
        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; text-align: right;">${formatCurrency(itemPrice)}</td>
        <td style="padding: 12px; text-align: right;">${formatCurrency(itemTotal)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Order - FarmFerry</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FF9800, #F57C00); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🍃 FarmFerry</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">New Order Notification</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #FF9800; margin-top: 0;">New Order Received</h2>
        <p>Dear <strong>${supplier.businessName}</strong>,</p>
        <p>You have received a new order from FarmFerry. Please review the details below and prepare the items for delivery.</p>
        
        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800;">
          <h3 style="margin-top: 0; color: #333;">Order Information</h3>
          <table style="width: 100%; margin-bottom: 15px;">
            <tr>
              <td style="font-weight: 600;">Order ID:</td>
              <td>${order._id}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Order Date:</td>
              <td>${formatDate(order.createdAt)}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Customer:</td>
              <td>${order.customer.firstName} ${order.customer.lastName}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Customer Email:</td>
              <td>${order.customer.email}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Customer Phone:</td>
              <td>${order.customer.phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Payment Method:</td>
              <td>${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment'}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Delivery Type:</td>
              <td>${order.isExpressDelivery ? 'Express Delivery' : 'Standard Delivery'}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 25px 0;">
          <h3 style="color: #333;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <thead style="background: #FF9800; color: white;">
              <tr>
                <th style="padding: 15px; text-align: left;">Product</th>
                <th style="padding: 15px; text-align: center;">Qty</th>
                <th style="padding: 15px; text-align: right;">Price</th>
                <th style="padding: 15px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productItemsHTML}
            </tbody>
          </table>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Order Summary</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Subtotal:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.subtotal)}</td>
            </tr>
            ${order.discountAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #4CAF50;">Discount:</td>
              <td style="padding: 8px 0; text-align: right; color: #4CAF50;">-${formatCurrency(order.discountAmount)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Delivery Charge:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.deliveryCharge)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">GST:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.gst)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Platform Fee:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.platformFee)}</td>
            </tr>
            ${order.handlingFee > 0 ? `
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Handling Fee:</td>
              <td style="padding: 8px 0; text-align: right;">${formatCurrency(order.handlingFee)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #FF9800; font-size: 18px;">
              <td style="padding: 12px 0; font-weight: 700;">Total Amount:</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 700;">${formatCurrency(order.totalAmount)}</td>
            </tr>
          </table>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
          <h3 style="margin-top: 0; color: #1976d2;">Delivery Information</h3>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.pincode}</p>
          <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> ${formatDate(order.estimatedDeliveryDate)}</p>
          ${order.notes ? `<p style="margin: 5px 0;"><strong>Customer Notes:</strong> ${order.notes}</p>` : ''}
        </div>

        <div style="background: #fff8e1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFC107;">
          <h3 style="margin-top: 0; color: #f57f17;">Next Steps</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Review the order items and quantities</li>
            <li>Prepare the products for packaging</li>
            <li>Update the order status to "Processing" when ready</li>
            <li>Ensure all items are fresh and meet quality standards</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">Thank you for being a part of FarmFerry!</p>
          <p style="color: #666; font-size: 14px;">Please process this order promptly to maintain customer satisfaction.</p>
        </div>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        <p>This is an automated email from FarmFerry. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
};

export default {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAssociate,
  updateDeliveryStatus,
  getMyOrders,
  getOrderStatusCounts,
  getAvailableOrdersForDelivery,
  selfAssignOrder,
  getMyCustomerOrders,
  getAvailableOrdersNearby,
  generateOrderInvoice,
  getOrderInvoice,
  updateOrderPaymentStatus
};