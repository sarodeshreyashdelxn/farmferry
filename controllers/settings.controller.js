import Settings from "../models/settings.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get all settings
export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  
  // If no settings exist, create default settings
  if (!settings) {
    settings = await Settings.create({});
  }
  
  return res.status(200).json(
    new ApiResponse(200, settings, "Settings fetched successfully")
  );
});

// Update settings (Admin only)
export const updateSettings = asyncHandler(async (req, res) => {
  const {
    deliveryCharge,
    handlingCharge,
    smallCartCharge,
    smallCartThreshold,
    deliveryTime,
    freeDeliveryThreshold,
    appName,
    appDescription,
    supportPhone,
    supportEmail,
    socialMedia,
    paymentMethods,
    pushNotifications,
    emailNotifications,
    smsNotifications
  } = req.body;

  let settings = await Settings.findOne();
  
  // If no settings exist, create new settings
  if (!settings) {
    settings = new Settings();
  }

  // Update only provided fields
  if (deliveryCharge !== undefined) settings.deliveryCharge = deliveryCharge;
  if (handlingCharge !== undefined) settings.handlingCharge = handlingCharge;
  if (smallCartCharge !== undefined) settings.smallCartCharge = smallCartCharge;
  if (smallCartThreshold !== undefined) settings.smallCartThreshold = smallCartThreshold;
  if (deliveryTime !== undefined) settings.deliveryTime = deliveryTime;
  if (freeDeliveryThreshold !== undefined) settings.freeDeliveryThreshold = freeDeliveryThreshold;
  if (appName !== undefined) settings.appName = appName;
  if (appDescription !== undefined) settings.appDescription = appDescription;
  if (supportPhone !== undefined) settings.supportPhone = supportPhone;
  if (supportEmail !== undefined) settings.supportEmail = supportEmail;
  if (socialMedia !== undefined) settings.socialMedia = socialMedia;
  if (paymentMethods !== undefined) settings.paymentMethods = paymentMethods;
  if (pushNotifications !== undefined) settings.pushNotifications = pushNotifications;
  if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
  if (smsNotifications !== undefined) settings.smsNotifications = smsNotifications;

  await settings.save();

  return res.status(200).json(
    new ApiResponse(200, settings, "Settings updated successfully")
  );
});

// Get delivery charges specifically
export const getDeliveryCharges = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  
  // If no settings exist, create default settings
  if (!settings) {
    settings = await Settings.create({});
  }
  
  const deliveryCharges = {
    deliveryCharge: settings.deliveryCharge,
    handlingCharge: settings.handlingCharge,
    smallCartCharge: settings.smallCartCharge,
    smallCartThreshold: settings.smallCartThreshold,
    deliveryTime: settings.deliveryTime,
    freeDeliveryThreshold: settings.freeDeliveryThreshold
  };
  
  return res.status(200).json(
    new ApiResponse(200, deliveryCharges, "Delivery charges fetched successfully")
  );
});

// Reset settings to defaults
export const resetSettings = asyncHandler(async (req, res) => {
  await Settings.deleteMany({});
  const settings = await Settings.create({});
  
  return res.status(200).json(
    new ApiResponse(200, settings, "Settings reset to defaults successfully")
  );
}); 