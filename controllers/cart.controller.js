import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get cart
export const getCart = asyncHandler(async (req, res) => {
  // Find cart for customer or create new one if it doesn't exist
  let cart = await Cart.findOne({ customer: req.user._id }).populate({
    path: 'items.product',
    select: 'name price gst images', // Include GST field
    options: {
      lean: false, // Don't use lean for fresh data
      // Force fresh data from DB
      readPreference: 'primary'
    }
  });;

  if (!cart) {
    cart = await Cart.create({
      customer: req.user._id,
      items: [],
      subtotal: 0
    });
  }

  // Populate product details
  await cart.populate({
    path: "items.product",
    select: "name price gst discountedPrice images stockQuantity unit supplierId categoryId",
    populate: {
      path: "categoryId",
      select: "name handlingFee"
    }
  });

  // Group items by supplier
  const itemsBySupplier = {};

  for (const item of cart.items) {
    const supplierId = item.product.supplierId.toString();

    if (!itemsBySupplier[supplierId]) {
      itemsBySupplier[supplierId] = {
        supplierId,
        items: [],
        subtotal: 0
      };
    }

    itemsBySupplier[supplierId].items.push(item);
    itemsBySupplier[supplierId].subtotal += item.totalPrice;
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        cart: {
          _id: cart._id,
          items: cart.items,
          subtotal: cart.subtotal,
          itemsBySupplier: Object.values(itemsBySupplier)
        }
      },
      "Cart fetched successfully"
    )
  );
});

// Add item to cart
export const addItemToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variation } = req.body;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }

  // Validate product
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // Check if product is active
  if (!product.isActive) {
    throw new ApiError(400, "Product is not available");
  }

  // Check stock
  if (product.stockQuantity < quantity) {
    throw new ApiError(400, "Insufficient stock");
  }

  // Check variation if provided
  let variationObj = null;
  if (variation) {
    variationObj = product.variations.find(v =>
      v.name === variation.name && v.value === variation.value
    );

    if (!variationObj) {
      throw new ApiError(404, "Product variation not found");
    }

    if (variationObj.stockQuantity < quantity) {
      throw new ApiError(400, "Insufficient stock for this variation");
    }
  }

  // Find cart or create new one
  
  
  let cart = await Cart.findOne({ customer: req.user._id });
  console.log(`!!!!!!! User data !!!!!!!!!:- ${req.user}`);

  if (!cart) {
    cart = new Cart({
      customer: req.user._id,
      items: [],
      subtotal: 0
    });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(item =>
    item.product.toString() === productId &&
    JSON.stringify(item.variation || {}) === JSON.stringify(variation || {})
  );

  if (existingItemIndex > -1) {
    // Update existing item
    cart.items[existingItemIndex].quantity += quantity;

    // Calculate total price
    const price = product.price + (variationObj?.additionalPrice || 0);
    const discountedPrice = product.discountedPrice
      ? product.discountedPrice + (variationObj?.additionalPrice || 0)
      : null;

    cart.items[existingItemIndex].price = price;
    cart.items[existingItemIndex].discountedPrice = discountedPrice;
    cart.items[existingItemIndex].totalPrice =
      cart.items[existingItemIndex].quantity * (discountedPrice || price);
  } else {
    // Add new item
    const price = product.price + (variationObj?.additionalPrice || 0);
    const discountedPrice = product.discountedPrice
      ? product.discountedPrice + (variationObj?.additionalPrice || 0)
      : null;

    cart.items.push({
      product: productId,
      quantity,
      price,
      discountedPrice,
      variation: variation || null,
      totalPrice: quantity * (discountedPrice || price)
    });
  }

  // Update subtotal
  cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Save cart
  await cart.save();

  // Populate product details
  await cart.populate({
    path: "items.product",
    select: "name price gst discountedPrice images stockQuantity unit supplierId categoryId",
    populate: {
      path: "categoryId",
      select: "name handlingFee"
    }
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { cart },
      "Item added to cart successfully"
    )
  );
});

// Update cart item quantity
export const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!itemId || quantity === undefined) {
    throw new ApiError(400, "Item ID and quantity are required");
  }

  // Find cart
  const cart = await Cart.findOne({ customer: req.user._id });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  // Find item in cart
  const item = cart.items.id(itemId);

  if (!item) {
    throw new ApiError(404, "Item not found in cart");
  }

  // Get product to check stock
  const product = await Product.findById(item.product);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // Check if quantity is 0, remove item
  if (quantity <= 0) {
    cart.items.pull(itemId);
  } else {
    // Check stock
    if (product.stockQuantity < quantity) {
      throw new ApiError(400, "Insufficient stock");
    }

    // Check variation stock if applicable
    if (item.variation) {
      const variation = product.variations.find(v =>
        v.name === item.variation.name && v.value === item.variation.value
      );

      if (variation && variation.stockQuantity < quantity) {
        throw new ApiError(400, "Insufficient stock for this variation");
      }
    }

    // Update quantity
    item.quantity = quantity;

    // Update total price
    item.totalPrice = quantity * (item.discountedPrice || item.price);
  }

  // Update subtotal
  cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Save cart
  await cart.save();

  // Populate product details
  await cart.populate({
    path: "items.product",
    select: "name price gst discountedPrice images stockQuantity unit supplierId categoryId",
    populate: {
      path: "categoryId",
      select: "name handlingFee"
    }
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { cart },
      "Cart updated successfully"
    )
  );
});

// Remove item from cart
export const removeCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  if (!itemId) {
    throw new ApiError(400, "Item ID is required");
  }

  // Find cart
  const cart = await Cart.findOne({ customer: req.user._id });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  // Find item in cart
  const item = cart.items.id(itemId);

  if (!item) {
    throw new ApiError(404, "Item not found in cart");
  }

  // Remove item
  cart.items.pull(itemId);

  // Update subtotal
  cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Save cart
  await cart.save();

  // Populate product details
  await cart.populate({
    path: "items.product",
    select: "name price gst discountedPrice images stockQuantity unit supplierId categoryId",
    populate: {
      path: "categoryId",
      select: "name handlingFee"
    }
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { cart },
      "Item removed from cart successfully"
    )
  );
});

// Clear cart
export const clearCart = asyncHandler(async (req, res) => {
  // Find cart
  const cart = await Cart.findOne({ customer: req.user._id });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  // Clear items
  cart.items = [];
  cart.subtotal = 0;

  // Save cart
  await cart.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { cart },
      "Cart cleared successfully"
    )
  );
});

// Apply coupon to cart - Redirect to coupon controller
export const applyCoupon = asyncHandler(async (req, res) => {
  // This function is deprecated - use /api/v1/coupons/apply instead
  throw new ApiError(400, "Please use /api/v1/coupons/apply endpoint for coupon functionality");
});
