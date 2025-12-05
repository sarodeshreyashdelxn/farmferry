import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const adminSchema = new mongoose.Schema(
  {
    name: {
      firstName : { 
        type: String,
        required: [true, "First name is required"],
        trim: true
      },
      lastName : {
        type: String,
        trim: true
      },
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
    role: {
      type: String,
      default: "admin"
    },
    permissions: {
      manageCustomers: { type: Boolean, default: true },
      manageSuppliers: { type: Boolean, default: true },
      manageProducts: { type: Boolean, default: true },
      manageOrders: { type: Boolean, default: true },
      manageCategories: { type: Boolean, default: true },
      viewAnalytics: { type: Boolean, default: true }
    },
    passwordResetToken: {
      type: String
    },
    passwordResetExpires: {
      type: Date
    },
    lastLogin: {
      type: Date
    },
    phone: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    avatar: {
      type: String,
      trim: true
    },
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      priceAlerts: { type: Boolean, default: false },
      newProducts: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

// Hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Ensure notificationPreferences defaults
adminSchema.pre("save", function(next) {
  if (!this.notificationPreferences) {
    this.notificationPreferences = {
      orderUpdates: true,
      priceAlerts: false,
      newProducts: true,
      marketing: false
    };
  }
  next();
});

// Compare password method
adminSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate access token
adminSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role
    }, 
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};

// Generate refresh token
adminSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id
    }, 
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  );
};

// Generate password reset token
adminSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Add joinDate virtual
adminSchema.virtual('joinDate').get(function() {
  return this.createdAt;
});

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
