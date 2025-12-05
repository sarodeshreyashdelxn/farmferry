import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Address Schema for multiple addresses
const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  type: { 
    type: String, 
    enum: ["home", "work", "other"], 
    default: "home" 
  },
  street: { 
    type: String, 
    required: [true, "Street address is required"],
    trim: true 
  },
  city: { 
    type: String, 
    required: [true, "City is required"],
    trim: true 
  },
  state: { 
    type: String, 
    required: [true, "State is required"],
    trim: true 
  },
  postalCode: { 
    type: String, 
    required: [true, "Postal code is required"],
    trim: true 
  },
  country: { 
    type: String, 
    required: [true, "Country is required"],
    trim: true 
  },
  isDefault: { 
    type: Boolean, 
    default: false 
  },
  phone: {
    type: String,
    // required: [true, "Phone number is required"],
    trim: true
  }
}, { _id: true });

const customerSchema = new mongoose.Schema({
  firstName: { 
    type: String, 
    //required: [true, "First name is required"], 
    trim: true 
  },
  lastName: { 
    type: String, 
    //required: [true, "Last name is required"], 
    trim: true 
  },
  // email: { 
  //   type: String, 
  //   //required: [true, "Email is required"], 
  //   //unique: true, 
  //   sparse: true,
  //   lowercase: true, 
  //   trim: true,
  //   match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  // },
  phone: { 
    type: String, 
    trim: true 
  },
  
  // Authentication
  password: { 
    type: String, 
    //required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters long"]
  },
  passwordResetToken: { 
    type: String 
  },
  passwordResetExpires: { 
    type: Date 
  },
  passwordResetOTP: { 
    type: String 
  },
  passwordResetOTPExpires: { 
    type: Date 
  },
  // Phone verification
  phoneOTP: { 
    type: String 
  },
  phoneOTPExpires: { 
    type: Date 
  },
  isPhoneVerified: { 
    type: Boolean, 
    default: false 
  },
  lastLogin: { 
    type: Date 
  },
  role: {
    type: String,
    default: "customer"
  },

  // Order & Shopping Details
  totalOrders: { 
    type: Number, 
    default: 0 
  },
  totalSpent: { 
    type: Number, 
    default: 0 
  },
  wishlist: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  }],

  // Address Book
  addresses: [addressSchema],

}, { timestamps: true });

// Hash password before saving
customerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
customerSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate access token
customerSchema.methods.generateAccessToken = function () {
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
customerSchema.methods.generateRefreshToken = function () {
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
customerSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Generate password reset OTP
customerSchema.methods.generatePasswordResetOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  
  this.passwordResetOTP = otp;
  this.passwordResetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return otp;
};

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
