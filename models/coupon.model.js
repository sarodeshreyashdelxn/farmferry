import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [20, "Coupon code cannot exceed 20 characters"]
    },
    type: {
      type: String,
      required: [true, "Coupon type is required"],
      enum: {
        values: ["percentage", "fixed"],
        message: "Coupon type must be either percentage or fixed"
      }
    },
    value: {
      type: Number,
      required: [true, "Coupon value is required"],
      min: [0, "Coupon value cannot be negative"],
      validate: {
        validator: function(value) {
          if (this.type === "percentage") {
            return value <= 100;
          }
          return true;
        },
        message: "Percentage coupon value cannot exceed 100"
      }
    },
    minPurchase: {
      type: Number,
      default: 0,
      min: [0, "Minimum purchase amount cannot be negative"]
    },
    maxDiscount: {
      type: Number,
      min: [0, "Maximum discount cannot be negative"],
      validate: {
        validator: function(value) {
          // Only validate maxDiscount for percentage coupons
          if (this.type === "percentage" && value !== undefined) {
            return value > 0;
          }
          return true;
        },
        message: "Maximum discount must be greater than 0 for percentage coupons"
      }
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function(value) {
          return value > this.startDate;
        },
        message: "End date must be after start date"
      }
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
      default: 1
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    applicableCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category"
    }],
    applicableProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    }],
    userRestrictions: {
      newUsersOnly: {
        type: Boolean,
        default: false
      },
      maxUsagePerUser: {
        type: Number,
        default: 1,
        min: [1, "Max usage per user must be at least 1"]
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
// couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
couponSchema.index({ createdBy: 1 });

// Virtual to check if coupon is currently valid
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.startDate <= now && 
         this.endDate >= now && 
         this.usedCount < this.usageLimit;
});

// Method to calculate discount for a given amount
couponSchema.methods.calculateDiscount = function(amount) {
  if (!this.isValid) {
    return 0;
  }

  if (amount < this.minPurchase) {
    return 0;
  }

  let discount = 0;
  
  if (this.type === "percentage") {
    discount = (amount * this.value) / 100;
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else if (this.type === "fixed") {
    discount = this.value;
    // Fixed discount cannot exceed the total amount
    if (discount > amount) {
      discount = amount;
    }
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

// Method to check if coupon can be used
couponSchema.methods.canBeUsed = function(amount, userId = null) {
  const now = new Date();
  
  // Basic validity checks
  if (!this.isActive) {
    return { valid: false, message: "Coupon is inactive" };
  }
  
  if (this.startDate > now) {
    return { valid: false, message: "Coupon is not yet active" };
  }
  
  if (this.endDate < now) {
    return { valid: false, message: "Coupon has expired" };
  }
  
  if (this.usedCount >= this.usageLimit) {
    return { valid: false, message: "Coupon usage limit exceeded" };
  }
  
  if (amount < this.minPurchase) {
    return { 
      valid: false, 
      message: `Minimum purchase amount of ₹${this.minPurchase} required` 
    };
  }

  return { valid: true, message: "Coupon is valid" };
};

// Static method to find valid coupons
couponSchema.statics.findValidCoupons = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $expr: { $lt: ["$usedCount", "$usageLimit"] }
  });
};

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
