import mongoose from "mongoose";

const orderReplacementSchema = new mongoose.Schema(
  {
    originalOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
    },
    replacementOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
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
    deliveryAssociate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAssociate"
    },
    
    // Replacement details
    reason: {
      type: String,
      required: true,
      enum: [
        "damaged_product",
        "wrong_product",
        "expired_product",
        "missing_items",
        "quality_issue",
        "customer_request",
        "other"
      ]
    },
    description: {
      type: String,
      required: true
    },
    
    // Status tracking
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "processing",
        "out_for_delivery",
        "delivered",
        "cancelled"
      ],
      default: "pending"
    },
    
    // Verification
    verificationOTP: {
      type: String
    },
    otpExpiresAt: {
      type: Date
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    
    // Financial details
    refundAmount: {
      type: Number,
      default: 0
    },
    additionalCharges: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    
    // Approval details
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    },
    approvedAt: {
      type: Date
    },
    approvalNotes: {
      type: String
    },
    
    // Delivery details
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true }
    },
    
    // Timeline
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date
    },
    deliveredAt: {
      type: Date
    },
    
    // Additional information
    images: [
      {
        url: { type: String },
        publicId: { type: String },
        description: { type: String }
      }
    ],
    
    notes: {
      type: String
    },
    
    // Priority
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
orderReplacementSchema.index({ customer: 1, status: 1 });
orderReplacementSchema.index({ supplier: 1, status: 1 });
orderReplacementSchema.index({ originalOrder: 1 });
orderReplacementSchema.index({ replacementOrder: 1 });
orderReplacementSchema.index({ status: 1, priority: 1 });

// Virtual for checking if replacement is urgent
orderReplacementSchema.virtual('isUrgent').get(function() {
  return this.priority === 'urgent' || this.priority === 'high';
});

// Method to check if replacement can be approved
orderReplacementSchema.methods.canBeApproved = function() {
  return this.status === 'pending';
};

// Method to check if replacement can be delivered
orderReplacementSchema.methods.canBeDelivered = function() {
  return this.status === 'out_for_delivery' && this.isVerified;
};

// Method to calculate total cost
orderReplacementSchema.methods.calculateTotalCost = function() {
  return this.totalAmount + this.additionalCharges - this.refundAmount;
};

// Pre-save middleware to update processedAt
orderReplacementSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'processing' && !this.processedAt) {
    this.processedAt = new Date();
  }
  next();
});

const OrderReplacement = mongoose.model("OrderReplacement", orderReplacementSchema);

export default OrderReplacement; 