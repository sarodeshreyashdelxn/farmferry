import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    // Delivery and handling charges
    deliveryCharge: {
      type: Number,
      default: 25,
      min: [0, "Delivery charge cannot be negative"]
    },
    handlingCharge: {
      type: Number,
      default: 2,
      min: [0, "Handling charge cannot be negative"]
    },
    smallCartCharge: {
      type: Number,
      default: 20,
      min: [0, "Small cart charge cannot be negative"]
    },
    smallCartThreshold: {
      type: Number,
      default: 100,
      min: [0, "Small cart threshold cannot be negative"]
    },
    
    // Delivery settings
    deliveryTime: {
      type: String,
      default: "30 minutes"
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 500,
      min: [0, "Free delivery threshold cannot be negative"]
    },
    
    // App settings
    appName: {
      type: String,
      default: "FarmFerry"
    },
    appDescription: {
      type: String,
      default: "Fresh farm products delivered to your doorstep"
    },
    
    // Contact information
    supportPhone: {
      type: String,
      default: "+91-1234567890"
    },
    supportEmail: {
      type: String,
      default: "support@farmferry.com"
    },
    
    // Social media
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String,
      youtube: String
    },
    
    // Payment settings
    paymentMethods: {
      type: [String],
      default: ["COD", "Online"]
    },
    
    // Notification settings
    pushNotifications: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one settings document exists
settingsSchema.pre('save', function(next) {
  if (this.isNew) {
    // Check if settings already exist
    this.constructor.countDocuments().then(count => {
      if (count > 0) {
        next(new Error('Settings already exist. Only one settings document is allowed.'));
      } else {
        next();
      }
    });
  } else {
    next();
  }
});

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings; 