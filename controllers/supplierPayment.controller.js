import Supplier from "../models/supplier.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Get all supplier business names
const getSupplierBusinessNames = asyncHandler(async (req, res) => {
  try {
    // Fetch only businessName and _id fields from approved/active suppliers
    const suppliers = await Supplier.find(
      { 
        status: { $in: ["approved", "active"] },
        businessName: { $exists: true, $ne: "" }
      },
      { 
        businessName: 1, 
        _id: 1 
      }
    ).sort({ businessName: 1 });

    if (!suppliers || suppliers.length === 0) {
      throw new ApiError(404, "No suppliers found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200, 
          suppliers, 
          `${suppliers.length} supplier business names fetched successfully`
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Failed to fetch supplier business names");
  }
});

// Get supplier business name by ID
const getSupplierBusinessNameById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, "Supplier ID is required");
    }

    const supplier = await Supplier.findById(
      id,
      { businessName: 1, _id: 1 }
    );

    if (!supplier) {
      throw new ApiError(404, "Supplier not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200, 
          supplier, 
          "Supplier business name fetched successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Failed to fetch supplier business name");
  }
});

// Search supplier business names
const searchSupplierBusinessNames = asyncHandler(async (req, res) => {
  try {
    const { search } = req.query;

    if (!search || search.trim() === "") {
      throw new ApiError(400, "Search query is required");
    }

    const suppliers = await Supplier.find(
      {
        status: { $in: ["approved", "active"] },
        businessName: { 
          $regex: search.trim(), 
          $options: "i" 
        }
      },
      { 
        businessName: 1, 
        _id: 1 
      }
    ).sort({ businessName: 1 }).limit(20);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200, 
          suppliers, 
          `${suppliers.length} supplier business names found`
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Failed to search supplier business names");
  }
});

export {
  getSupplierBusinessNames,
  getSupplierBusinessNameById,
  searchSupplierBusinessNames
};