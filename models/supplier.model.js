import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const supplierSchema = new mongoose.Schema(
  {
    businessName: { 
      type: String, 
      // required: [true, "Business name is required"],   
      trim: true 
    },
    ownerName: { 
      type: String, 
      // required: [true, "Owner name is required"],
      trim: true 
    },
    email: { 
      type: String, 
      required: [true, "Email is required"], 
      unique: true, 
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    password: { 
      type: String, 
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"]
    },
    phone: { 
      type: String,
      // required: [true, "Phone number is required"]
    },
    role: {
      type: String,
      default: "supplier"
    },

    // Business Details
    businessType: { 
      type: String,
      enum: ["farmer", "wholesaler", "retailer", "processor", "other", "Agriculture"],
      // required: [true, "Business type is required"]
    },
    shopName: { 
      type: String,
      trim: true 
    },
    gstNumber: { 
      type: String,
      trim: true 
    },
    panNumber: { 
      type: String,
      trim: true 
    },

    // Address Details
    address: {
      street: { 
        type: String,
        // required: [true, "Street address is required"],
        trim: true 
      },
      city: { 
        type: String,
        // required: [true, "City is required"],
        trim: true 
      },
      state: { 
        type: String,
        // required: [true, "State is required"],
        trim: true 
      },
      country: { 
        type: String,
        // required: [true, "Country is required"],
        trim: true 
      },
      postalCode: { 
        type: String,
        // required: [true, "Postal code .....is required"],
        trim: true 
      },
    },

    // Bank Details
    bankDetails: {
      accountHolderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
    },

    documents: { type: Array, default: [] },
    // Verification Status
    status: { 
      type: String, 
      enum: ["pending", "approved", "rejected", "active", "inactive", "blocked"], 
      default: "pending" 
    },
    verificationNotes: { 
      type: String 
    },
    verifiedAt: { 
      type: Date 
    },
    verifiedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Admin" 
    },

    // Password Reset
    passwordResetToken: { 
      type: String 
    },
    passwordResetExpires: { 
      type: Date 
    },

    // Phone Verification
    phoneVerificationToken: {
      type: String,
    },
    phoneVerificationExpires: {
      type: Date,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    // Performance & Activity
    totalOrders: {
      type: Number,
      default: 0 
    },
    totalRevenue: { 
      type: Number, 
      default: 0 
    },
    lastLogin: { 
      type: Date 
    }
  },
  { timestamps: true }
);

// Hash password before saving
supplierSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
supplierSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate access token
supplierSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role
    }, 
    process.env.ACCESS_TOKEN_SECRET || 'fallback_access_token_secret',
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d'
    }
  );
};

// Generate refresh token
supplierSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id
    }, 
    process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_token_secret',
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d'
    }
  );
};

// Generate password reset token
supplierSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Generate phone verification token
supplierSchema.methods.generatePhoneVerificationToken = function () {
  const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.phoneVerificationToken = token;
  this.phoneVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

const Supplier = mongoose.model("Supplier", supplierSchema);

export default Supplier;
