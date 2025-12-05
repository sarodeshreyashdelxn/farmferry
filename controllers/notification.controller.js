import Notification from '../models/notification.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// Get notifications for the logged-in user
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notifications = await Notification.find({ recipient: userId }).sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, { notifications }, 'Notifications fetched successfully'));
});

export default {
  getNotifications,
}; 