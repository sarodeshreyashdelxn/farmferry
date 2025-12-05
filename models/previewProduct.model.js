import mongoose from "mongoose";

const previewProductSchema = new mongoose.Schema(
  {
    supplierId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: [true, "Supplier ID is required"], 
      ref: "Supplier" 
    },
    categoryId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Category" 
    },
    categoryName: {
      type: String,
      trim: true
    },
    name: { 
      type: String, 
      required: [true, "Product name is required"], 
      trim: true,
      index: true 
    },
    description: { 
      type: String,
      trim: true 
    },
    price: { 
      type: Number, 
      required: [true, "Price is required"], 
      min: [0, "Price cannot be negative"] 
    },
    gst: {
      type: Number,
      default: 0,
      min: [0, "GST cannot be negative"],
      max: [100, "GST cannot exceed 100%"]
    },
    stockQuantity: { 
      type: Number, 
      required: [true, "Stock quantity is required"], 
      min: [0, "Stock quantity cannot be negative"] 
    },
    unit: { 
      type: String, 
      enum: ["kg", "g", "liters", "ml", "pcs", "box", "dozen"], 
      default: "kg" 
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String },
          isMain: { type: Boolean, default: false }
        }
      ],
      default: []
    },
    excelRowIndex: {
      type: Number,
      required: true
    },
    isUpdate: {
      type: Boolean,
      default: false
    },
    originalProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },
    validationErrors: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ["pending", "valid", "invalid"],
      default: "pending"
    }
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying by supplier
previewProductSchema.index({ supplierId: 1, createdAt: 1 });

const PreviewProduct = mongoose.model("PreviewProduct", previewProductSchema);

export default PreviewProduct;