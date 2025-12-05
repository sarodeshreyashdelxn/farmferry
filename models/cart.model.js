import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"]
  },
  price: {
    type: Number,
    required: true
  },
  discountedPrice: {
    type: Number
  },
  variation: {
    name: { type: String },
    value: { type: String }
  },
  totalPrice: {
    type: Number,
    default: function() {
      const price = this.discountedPrice || this.price;
      return this.quantity * price;
    }
  }
}, { _id: true });

const cartSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      unique: true
    },
    items: [cartItemSchema],
    subtotal: {
      type: Number,
      default: 0
    },
    coupon: {
      code: { type: String },
      type: { type: String, enum: ["percentage", "fixed"] },
      value: { type: Number },
      discount: { type: Number, default: 0 }
    },
    discount: {
      type: Number,
      default: 0
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Middleware to auto-calculate subtotal before saving
cartSchema.pre("save", function(next) {
  this.subtotal = this.items.reduce((sum, item) => {
    const price = item.discountedPrice || item.price;
    return sum + (item.quantity * price);
  }, 0);
  
  this.lastModified = new Date();
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(productId, quantity, price, discountedPrice, variation) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() && 
    JSON.stringify(item.variation || {}) === JSON.stringify(variation || {})
  );

  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].totalPrice = 
      this.items[existingItemIndex].quantity * 
      (discountedPrice || price);
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      price,
      discountedPrice,
      variation,
      totalPrice: quantity * (discountedPrice || price)
    });
  }

  // Update subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.lastModified = new Date();

  return this;
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  
  if (!item) {
    throw new Error('Cart item not found');
  }
  
  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items.pull(itemId);
  } else {
    // Update quantity and total price
    item.quantity = quantity;
    item.totalPrice = quantity * (item.discountedPrice || item.price);
  }
  
  // Update subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.lastModified = new Date();
  
  return this;
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  this.items.pull(itemId);
  
  // Update subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.lastModified = new Date();
  
  return this;
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.subtotal = 0;
  this.lastModified = new Date();
  
  return this;
};

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;
