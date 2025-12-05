import mongoose from "mongoose";
//import crypto from "crypto";

import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"]
  },
  price: {
    type: Number,
    required: true,
    min: [0, "Price cannot be negative"]
  },
  discountedPrice: {
    type: Number,
    required: true,
    min: [0, "Discounted price cannot be negative"]
  },
  totalPrice: {
    type: Number,
    default: function () {
      return this.quantity * this.discountedPrice;
    }
  },
  variation: {
    name: { type: String },
    value: { type: String }
  }
}, { _id: true });

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      default: () => nanoid(),
      unique: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true
    },
    items: [orderItemSchema],

    // Order financial details
    subtotal: {
      type: Number,
      required: true,
      default: function () {
        return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
      }
    },
    couponCode: {
      type: String
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    gst: {
      type: Number,
      default: 0
    },
    platformFee: {
      type: Number,
      default: 2
    },
    handlingFee: {
      type: Number,
      default: 0
    },
    deliveryCharge: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: function () {
        return this.subtotal - this.discountAmount + this.gst + this.deliveryCharge + this.platformFee + this.handlingFee;
      }
    },

    // Payment details
    paymentMethod: {
      type: String,
      enum: ["credit_card", "debit_card", "cash_on_delivery", "upi", "bank_transfer"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    transactionId: {
      type: String
    },
    invoiceUrl: {
      type: String
    },

    // Order status and tracking
    status: {
      type: String,
      enum: ["pending", "packaging", "processing", "out_for_delivery", "delivered", "cancelled", "returned", "damaged"],
      default: "pending"
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["pending", "packaging", "processing", "out_for_delivery", "delivered", "cancelled", "returned", "damaged"]
        },
        updatedAt: {
          type: Date,
          default: Date.now
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'statusHistory.updatedByModel'
        },
        updatedByModel: {
          type: String,
          enum: ["Admin", "Supplier", "Customer", "DeliveryAssociate"]
        },
        note: String
      }
    ],
    trackingId: {
      type: String
    },
    trackingUrl: {
      type: String
    },
    isExpressDelivery: {
      type: Boolean,
      default: false
    },

    // Delivery details
    deliveryAddress: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },

      state: {
        type: String,
        required: true
      },
      postalCode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        required: true
      },
      phone: {
        type: String,
        required: true
      }
    },
    deliveryAssociate: {
      associate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryAssociate"
      },
      name: {
        type: String
      },
      assignedAt: {
        type: Date
      },
      status: {
        type: String,
        enum: ["packaging", "assigned", "out_for_delivery", "delivered", "failed"]
      }
    },
    estimatedDeliveryDate: {
      type: Date
    },
    deliveredAt: {
      type: Date
    },

    // Order feedback & cancellations
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review"
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    notes: {
      type: String
    },
    cancellationReason: {
      type: String
    },
    returnReason: {
      type: String
    },
    refundStatus: {
      type: String,
      enum: ["pending", "processing", "refunded", "failed"],
      default: function () {
        return this.status === "returned" ? "pending" : undefined;
      }
    },
    refundAmount: {
      type: Number,
      min: [0, "Refund amount cannot be negative"]
    },
    refundTransactionId: {
      type: String
    },
    refundProcessedAt: {
      type: Date
    },
    //OTP Delivery Verification
    qrCode: {
      type: String // base64 or URL
    },
    otp: {
      type: String // hashed OTP
    },
    otpExpiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Middleware to auto-calculate totals before saving
orderSchema.pre("save", function (next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate final total
  this.totalAmount = this.subtotal - this.discountAmount + this.gst + this.deliveryCharge + this.platformFee + this.handlingFee;

  // Add status to history if it's a new order or status changed
  const lastStatus = this.statusHistory.length > 0
    ? this.statusHistory[this.statusHistory.length - 1].status
    : null;

  if (!lastStatus || lastStatus !== this.status) {
    this.statusHistory.push({
      status: this.status,
      updatedAt: new Date()
    });
  }

  next();
});

//db.orders.createIndex({ "deliveryAddress.location": "2dsphere" })
orderSchema.index({ 'deliveryAddress.location': '2dsphere' });

const Order = mongoose.model("Order", orderSchema);

export default Order;
