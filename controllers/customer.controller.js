import Customer from "../models/customer.model.js";
import Review from "../models/review.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";

// Get customer profile
export const getCustomerProfile = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { customer },
      "Customer profile fetched successfully"
    )
  );
});

// Update customer profile
export const updateCustomerProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone } = req.body;

  const updateFields = {};

  if (firstName) updateFields.firstName = firstName;
  if (lastName) updateFields.lastName = lastName;
  if (phone) updateFields.phone = phone;

  // Handle profile image upload if file is provided
  if (req.file) {
    const customer = await Customer.findById(req.user._id);

    // Delete old profile image if exists
    if (customer.profileImage?.publicId) {
      await deleteFromCloudinary(customer.profileImage.publicId);
    }

    // Upload new profile image
    const uploadResult = await uploadToCloudinary(req.file.path, "customers");

    if (!uploadResult) {
      throw new ApiError(500, "Error uploading profile image");
    }

    updateFields.profileImage = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };
  }

  const updatedCustomer = await Customer.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");

  if (!updatedCustomer) {
    throw new ApiError(404, "Customer not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { customer: updatedCustomer },
      "Customer profile updated successfully"
    )
  );
});

// Update profile image
export const updateProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Profile image is required");
  }

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Delete old profile image if exists
  if (customer.profileImage?.publicId) {
    await deleteFromCloudinary(customer.profileImage.publicId);
  }

  // Upload new profile image
  const uploadResult = await uploadToCloudinary(req.file.path, "customers");

  if (!uploadResult) {
    throw new ApiError(500, "Error uploading profile image");
  }

  // Update customer profile image
  customer.profileImage = {
    url: uploadResult.url,
    publicId: uploadResult.public_id
  };

  await customer.save();

  const updatedCustomer = await Customer.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");

  return res.status(200).json(
    new ApiResponse(
      200,
      { customer: updatedCustomer },
      "Profile image updated successfully"
    )
  );
});

// Add address
// export const addAddress = asyncHandler(async (req, res) => {
//   const { street, city, state, postalCode, country, isDefault, phone } = req.body;

//   // Validate required fields
//   if (!street || !city || !state || !postalCode || !country) {
//     throw new ApiError(400, "All address fields are required");
//   }

//   const customer = await Customer.findById(req.user._id);

//   if (!customer) {
//     throw new ApiError(404, "Customer not found");
//   }

//   // Create new address
//   const newAddress = {
//     street,
//     city,
//     state,
//     postalCode,
//     country,
//     isDefault: isDefault || false,
//     phone: phone || ''
//   };

//   // If this is the first address or isDefault is true, make it the default
//   if (customer.addresses.length === 0 || isDefault) {
//     // Set all existing addresses to non-default
//     customer.addresses.forEach(address => {
//       address.isDefault = false;
//     });

//     newAddress.isDefault = true;
//   }

//   // Add new address
//   customer.addresses.push(newAddress);

//   await customer.save();

//   return res.status(201).json(
//     new ApiResponse(
//       201,
//       { 
//         address: customer.addresses[customer.addresses.length - 1],
//         addresses: customer.addresses
//       },
//       "Address added successfully"
//     )
//   );
// });

export const addAddress = asyncHandler(async (req, res) => {
  const { name, addressType, street, city, state, postalCode, country, isDefault, phone } = req.body;

  // Validate required fields
  if (!name || !street || !city || !state || !postalCode || !country || !phone) {
    throw new ApiError(400, "Name, phone, and all address fields are required");
  }

  // Validate phone number format (10 digits)
  if (!/^[0-9]{10}$/.test(phone)) {
    throw new ApiError(400, "Phone number must be 10 digits");
  }

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Add default name to existing addresses that don't have one (for migration)
  customer.addresses.forEach(address => {
    if (!address.name) {
      address.name = "Address"; // Default name for existing addresses
    }
  });

  // Create new address
  const newAddress = {
    name: name.trim(),
    type: addressType ? addressType.toLowerCase() : 'home', // Map addressType to type
    street: street.trim(),
    city: city.trim(),
    state: state.trim(),
    postalCode: postalCode.trim(),
    country: country.trim(),
    isDefault: isDefault || false,
    phone: phone.trim()
  };

  // If this is the first address or isDefault is true, make it the default
  if (customer.addresses.length === 0 || isDefault) {
    // Set all existing addresses to non-default
    customer.addresses.forEach(address => {
      address.isDefault = false;
    });

    newAddress.isDefault = true;
  }

  // Add new address
  customer.addresses.push(newAddress);

  await customer.save();

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        address: customer.addresses[customer.addresses.length - 1],
        addresses: customer.addresses
      },
      "Address added successfully"
    )
  );
});

// Update address
export const updateAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const { street, city, state, postalCode, country, isDefault, phone } = req.body;

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Find address
  const addressIndex = customer.addresses.findIndex(
    address => address._id.toString() === addressId
  );

  if (addressIndex === -1) {
    throw new ApiError(404, "Address not found");
  }

  // Update address fields
  if (street) customer.addresses[addressIndex].street = street;
  if (city) customer.addresses[addressIndex].city = city;
  if (state) customer.addresses[addressIndex].state = state;
  if (postalCode) customer.addresses[addressIndex].postalCode = postalCode;
  if (country) customer.addresses[addressIndex].country = country;
  if (phone !== undefined) customer.addresses[addressIndex].phone = phone;

  // Handle default address
  if (isDefault) {
    // Set all addresses to non-default
    customer.addresses.forEach(address => {
      address.isDefault = false;
    });

    // Set this address as default
    customer.addresses[addressIndex].isDefault = true;
  }

  await customer.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        address: customer.addresses[addressIndex],
        addresses: customer.addresses
      },
      "Address updated successfully"
    )
  );
});

// Set default address
export const setDefaultAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Find address
  const addressIndex = customer.addresses.findIndex(
    address => address._id.toString() === addressId
  );

  if (addressIndex === -1) {
    throw new ApiError(404, "Address not found");
  }

  // Set all addresses to non-default
  customer.addresses.forEach(address => {
    address.isDefault = false;
  });

  // Set this address as default
  customer.addresses[addressIndex].isDefault = true;

  await customer.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        address: customer.addresses[addressIndex],
        addresses: customer.addresses
      },
      "Default address updated successfully"
    )
  );
});

// Delete address
export const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Find address
  const addressIndex = customer.addresses.findIndex(
    address => address._id.toString() === addressId
  );

  if (addressIndex === -1) {
    throw new ApiError(404, "Address not found");
  }

  // Check if this is the default address
  const isDefault = customer.addresses[addressIndex].isDefault;

  // Remove address
  customer.addresses.splice(addressIndex, 1);

  // If the deleted address was the default and there are other addresses,
  // set the first one as default
  if (isDefault && customer.addresses.length > 0) {
    customer.addresses[0].isDefault = true;
  }

  await customer.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { addresses: customer.addresses },
      "Address deleted successfully"
    )
  );
});

// Add product to wishlist
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Check if product already in wishlist
  if (customer.wishlist.includes(productId)) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { wishlist: customer.wishlist },
        "Product already in wishlist"
      )
    );
  }

  // Add product to wishlist
  customer.wishlist.push(productId);
  await customer.save();

  // Populate wishlist with product details
  const populatedCustomer = await Customer.findById(req.user._id)
    .populate("wishlist")
    .select("wishlist");

  return res.status(200).json(
    new ApiResponse(
      200,
      { wishlist: populatedCustomer.wishlist },
      "Product added to wishlist"
    )
  );
});

// Remove product from wishlist
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }

  const customer = await Customer.findById(req.user._id);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // Check if product in wishlist
  const productIndex = customer.wishlist.indexOf(productId);

  if (productIndex === -1) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { wishlist: customer.wishlist },
        "Product not in wishlist"
      )
    );
  }

  // Remove product from wishlist
  customer.wishlist.splice(productIndex, 1);
  await customer.save();

  // Populate wishlist with product details
  const populatedCustomer = await Customer.findById(req.user._id)
    .populate("wishlist")
    .select("wishlist");

  return res.status(200).json(
    new ApiResponse(
      200,
      { wishlist: populatedCustomer.wishlist },
      "Product removed from wishlist"
    )
  );
});

// Get wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.user._id)
    .populate("wishlist")
    .select("wishlist");

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { wishlist: customer.wishlist },
      "Wishlist fetched successfully"
    )
  );
});

// Get customer orders
export const getCustomerOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const queryOptions = { customer: req.user._id };

  // Filter by status if provided
  if (status) {
    queryOptions.status = status;
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("items.product")
    .populate("supplier", "businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Customer orders fetched successfully"
    )
  );
});

// Get customer reviews
export const getCustomerReviews = asyncHandler(async (req, res) => {
  console.log('getCustomerReviews called for user:', req.user?._id);
  const { page = 1, limit = 10 } = req.query;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get customer reviews with pagination
  const reviews = await Review.find({ customer: req.user._id })
    .populate("product", "name images categoryId supplierId")
    .populate("product.categoryId", "name")
    .populate("product.supplierId", "businessName")
    .populate("customer", "firstName lastName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalReviews = await Review.countDocuments({ customer: req.user._id });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        reviews,
        pagination: {
          total: totalReviews,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalReviews / parseInt(limit))
        }
      },
      "Customer reviews fetched successfully"
    )
  );
});

// Get pending reviews (products purchased but not reviewed)
export const getPendingReviews = asyncHandler(async (req, res) => {
  console.log('getPendingReviews called for user:', req.user?._id);
  const { page = 1, limit = 10 } = req.query;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get delivered orders for the customer
  const deliveredOrders = await Order.find({
    customer: req.user._id,
    status: "delivered"
  }).populate("items.product");

  // Extract unique product IDs from delivered orders
  const purchasedProductIds = [...new Set(
    deliveredOrders.flatMap(order =>
      order.items.map(item => item.product._id.toString())
    )
  )];

  // Get products that the customer has already reviewed
  const reviewedProductIds = await Review.find({ customer: req.user._id })
    .distinct("product");

  // Convert to strings for comparison
  const reviewedProductIdStrings = reviewedProductIds.map(id => id.toString());

  // Find products that are purchased but not reviewed
  const pendingProductIds = purchasedProductIds.filter(
    productId => !reviewedProductIdStrings.includes(productId)
  );

  // Get pending products with details
  const pendingProducts = await Product.find({
    _id: { $in: pendingProductIds }
  })
    .populate("categoryId", "name")
    .populate("supplierId", "businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalPending = pendingProducts.length;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        pendingProducts,
        pagination: {
          total: totalPending,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalPending / parseInt(limit))
        }
      },
      "Pending reviews fetched successfully"
    )
  );
});
