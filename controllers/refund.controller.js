// controllers/refund.controller.js

import { asyncHandler } from "../utils/asyncHandler.js";
import Order from '../models/order.model.js'; // Update path if needed

// GET /api/refunds/returned-orders
export const getReturnedOrders = asyncHandler(async (req, res) => {
    const returnedOrders = await Order.find({ status: "returned" })
        .populate({
            path: 'customer',
            select: 'firstName lastName phone email' // Include all needed fields
        })
        .populate("supplier", "name email");  // Optional: include supplier details

    res.status(200).json({
        success: true,
        count: returnedOrders.length,
        data: returnedOrders,
    });
});
