import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Get all delivery associates with their payment requests
const getAllDeliveryAssociatePayments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status, // pending, approved, rejected, processed
    sortBy = "requestedAt",
    sortOrder = "desc",
    search,
    dateFrom,
    dateTo
  } = req.query;

  // Build match conditions
  const matchConditions = {};
  
  // Search by name, email, or employee ID pattern
  if (search) {
    matchConditions.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { _id: { $regex: search, $options: "i" } }
    ];
  }

  // Build aggregation pipeline
  const pipeline = [
    { $match: matchConditions },
    {
      $unwind: {
        path: "$payoutRequests",
        preserveNullAndEmptyArrays: false
      }
    }
  ];

  // Filter by payout request status
  if (status) {
    pipeline.push({
      $match: { "payoutRequests.status": status }
    });
  }

  // Filter by date range
  if (dateFrom || dateTo) {
    const dateMatch = {};
    if (dateFrom) {
      dateMatch["payoutRequests.requestedAt"] = { $gte: new Date(dateFrom) };
    }
    if (dateTo) {
      dateMatch["payoutRequests.requestedAt"] = {
        ...dateMatch["payoutRequests.requestedAt"],
        $lte: new Date(dateTo)
      };
    }
    pipeline.push({ $match: dateMatch });
  }

  // Add calculated fields and project required data
  pipeline.push({
    $project: {
      partnerId: { $toString: "$_id" },
      name: 1,
      email: 1,
      phone: 1,
      employeeId: {
        $concat: ["EMP-", { 
          $substr: [
            { $toString: "$_id" }, 
            { $subtract: [{ $strLenCP: { $toString: "$_id" } }, 3] }, 
            3
          ] 
        }]
      },
      paymentId: {
        $concat: ["DEL-", { 
          $substr: [
            { $toString: "$payoutRequests._id" }, 
            { $subtract: [{ $strLenCP: { $toString: "$payoutRequests._id" } }, 4] }, 
            4
          ] 
        }]
      },
      amount: "$payoutRequests.amount",
      deliveries: "$completedDeliveries",
      area: {
        $cond: {
          if: { $ne: ["$address.city", null] },
          then: "$address.city",
          else: "Not specified"
        }
      },
      paymentMethod: {
        $switch: {
          branches: [
            { case: { $eq: ["$payoutRequests.status", "processed"] }, then: "UPI" },
            { case: { $eq: ["$payoutRequests.status", "approved"] }, then: "Bank Transfer" },
            { case: { $eq: ["$payoutRequests.status", "pending"] }, then: "Pending" }
          ],
          default: "Cash"
        }
      },
      status: "$payoutRequests.status",
      requestedAt: "$payoutRequests.requestedAt",
      processedAt: "$payoutRequests.processedAt",
      adminNote: "$payoutRequests.adminNote",
      vehicle: "$vehicle.type",
      averageRating: 1,
      totalDeliveries: 1,
      completedDeliveries: 1,
      failedDeliveries: 1,
      isActive: 1,
      isOnline: 1,
      // Calculate bonus (example logic - adjust as needed)
      bonus: {
        $cond: {
          if: { $gte: ["$completedDeliveries", 25] },
          then: 600,
          else: {
            $cond: {
              if: { $gte: ["$completedDeliveries", 20] },
              then: 500,
              else: {
                $cond: {
                  if: { $gte: ["$completedDeliveries", 15] },
                  then: 400,
                  else: {
                    $cond: {
                      if: { $gte: ["$completedDeliveries", 10] },
                      then: 300,
                      else: 200
                    }
                  }
                }
              }
            }
          }
        }
      },
      // Calculate deductions (example logic)
      deductions: {
        $multiply: ["$failedDeliveries", 50]
      }
    }
  });

  // Sort
  const sortDirection = sortOrder === "desc" ? -1 : 1;
  pipeline.push({
    $sort: { [sortBy]: sortDirection }
  });

  // Get total count for pagination
  const countPipeline = [...pipeline, { $count: "total" }];
  const totalResult = await DeliveryAssociate.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  // Add pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

  // Execute aggregation
  const paymentRecords = await DeliveryAssociate.aggregate(pipeline);

  // Format response data
  const formattedRecords = paymentRecords.map(record => ({
    partnerId: record.partnerId,
    employeeId: record.employeeId,
    name: record.name,
    email: record.email,
    phone: record.phone,
    paymentId: record.paymentId,
    amount: record.amount,
    bonus: record.bonus,
    deductions: record.deductions,
    //netAmount: record.amount + record.bonus - record.deductions,
    deliveries: record.deliveries,
    area: record.area,
    paymentMethod: record.paymentMethod,
    status: record.status,
    requestedAt: record.requestedAt,
    processedAt: record.processedAt,
    adminNote: record.adminNote || "",
    vehicle: record.vehicle || "Not specified",
    performanceMetrics: {
      totalDeliveries: record.totalDeliveries,
      completedDeliveries: record.completedDeliveries,
      failedDeliveries: record.failedDeliveries,
      averageRating: record.averageRating
    },
    isActive: record.isActive,
    isOnline: record.isOnline
  }));

  // Calculate pagination info
  const totalPages = Math.ceil(total / parseInt(limit));
  const hasNextPage = parseInt(page) < totalPages;
  const hasPrevPage = parseInt(page) > 1;

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          payments: formattedRecords,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalRecords: total,
            hasNextPage,
            hasPrevPage,
            limit: parseInt(limit)
          }
        },
        "Delivery associate payment records fetched successfully"
      )
    );
});

// Get payment details for a specific delivery associate
const getDeliveryAssociatePaymentById = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;

  const deliveryAssociate = await DeliveryAssociate.findById(partnerId).select(
    "name email phone address vehicle payoutRequests totalDeliveries completedDeliveries failedDeliveries averageRating totalRatings isActive isOnline"
  );

  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  const formattedData = {
    partnerId: deliveryAssociate._id,
    employeeId: `EMP-${deliveryAssociate._id.toString().slice(-3)}`,
    name: deliveryAssociate.name,
    email: deliveryAssociate.email,
    phone: deliveryAssociate.phone,
    address: deliveryAssociate.address,
    vehicle: deliveryAssociate.vehicle,
    payoutRequests: deliveryAssociate.payoutRequests.map(request => ({
      paymentId: `DEL-${request._id.toString().slice(-4)}`,
      amount: request.amount,
      status: request.status,
      requestedAt: request.requestedAt,
      processedAt: request.processedAt,
      adminNote: request.adminNote || ""
    })),
    performanceMetrics: {
      totalDeliveries: deliveryAssociate.totalDeliveries,
      completedDeliveries: deliveryAssociate.completedDeliveries,
      failedDeliveries: deliveryAssociate.failedDeliveries,
      averageRating: deliveryAssociate.averageRating,
      totalRatings: deliveryAssociate.totalRatings
    },
    isActive: deliveryAssociate.isActive,
    isOnline: deliveryAssociate.isOnline
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, formattedData, "Delivery associate payment details fetched successfully")
    );
});

// Get payment statistics/summary
const getPaymentStatistics = asyncHandler(async (req, res) => {
  const stats = await DeliveryAssociate.aggregate([
    {
      $unwind: {
        path: "$payoutRequests",
        preserveNullAndEmptyArrays: false
      }
    },
    {
      $group: {
        _id: "$payoutRequests.status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$payoutRequests.amount" }
      }
    }
  ]);

  const totalPartners = await DeliveryAssociate.countDocuments();
  const activePartners = await DeliveryAssociate.countDocuments({ 
    isActive: true 
  });
  const onlinePartners = await DeliveryAssociate.countDocuments({ 
    isOnline: true 
  });

  const summary = {
    totalPartners,
    activePartners,
    onlinePartners,
    paymentStatus: stats.reduce((acc, curr) => {
      acc[curr._id] = {
        count: curr.count,
        totalAmount: curr.totalAmount
      };
      return acc;
    }, {})
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, summary, "Payment statistics fetched successfully")
    );
});

// Update payment status (for admin actions)
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { partnerId, paymentId } = req.params;
  const { status, adminNote } = req.body;

  const validStatuses = ["pending", "approved", "rejected", "processed"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Invalid payment status");
  }

  const deliveryAssociate = await DeliveryAssociate.findOneAndUpdate(
    {
      _id: partnerId,
      "payoutRequests._id": paymentId
    },
    {
      $set: {
        "payoutRequests.$.status": status,
        "payoutRequests.$.adminNote": adminNote || "",
        "payoutRequests.$.processedAt": status === "processed" ? new Date() : null
      }
    },
    { new: true }
  );

  if (!deliveryAssociate) {
    throw new ApiError(404, "Payment request not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "Payment status updated successfully")
    );
});

export {
  getAllDeliveryAssociatePayments,
  getDeliveryAssociatePaymentById,
  getPaymentStatistics,
  updatePaymentStatus
};