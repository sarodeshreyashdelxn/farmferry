import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const deliveryAssociateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
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
    phone: {
      type: String,
      // required: [true, "Phone number is required"],
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"]
    },
    role: {
      type: String,
      default: "deliveryAssociate"
    },
    
    // Personal Details
    gender: {
      type: String,
      enum: ["male", "female", "other"]
    },
    dateOfBirth: {
      type: Date
    },
    profileImage: {
      url: { type: String },
      publicId: { type: String }
    },
    
    // Address
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true }
    },
    
    // Verification & Documents
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    },
    documents: [
      {
        type: { 
          type: String, 
          enum: ["id_proof", "address_proof", "driving_license", "vehicle_registration"] 
        },
        number: { type: String },
        url: { type: String },
        publicId: { type: String },
        isVerified: { type: Boolean, default: false }
      }
    ],
    
    // Vehicle Details
    vehicle: {
      type: { 
        type: String, 
        enum: ["bicycle", "motorcycle", "car", "van", "truck"] 
      },
      model: { type: String },
      registrationNumber: { type: String },
      color: { type: String }
    },
    
    // Delivery Status
    isActive: {
      type: Boolean,
      default: true
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    
    // Performance Metrics
    totalDeliveries: {
      type: Number,
      default: 0
    },
    completedDeliveries: {
      type: Number,
      default: 0
    },
    failedDeliveries: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    
    // Authentication
    passwordResetToken: {
      type: String
    },
    passwordResetExpires: {
      type: Date
    },
    lastLogin: {
      type: Date
    },
    // Payout Requests
    payoutRequests: [
      {
        amount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'processed'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
        processedAt: { type: Date },
        adminNote: { type: String }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Create geospatial index for location-based queries
deliveryAssociateSchema.index({ currentLocation: "2dsphere" });

// Hash password before saving
deliveryAssociateSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
deliveryAssociateSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate access token
deliveryAssociateSchema.methods.generateAccessToken = function () {
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
deliveryAssociateSchema.methods.generateRefreshToken = function () {
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
deliveryAssociateSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

const DeliveryAssociate = mongoose.model("DeliveryAssociate", deliveryAssociateSchema);

export default DeliveryAssociate;