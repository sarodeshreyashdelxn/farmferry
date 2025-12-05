import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true
    },
    description: {
      type: String,
      trim: true
    },
    image: {
      url: { type: String },
      publicId: { type: String }
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    handlingFee: {
      type: Number,
      default: 0,
      min: [0, "Handling fee cannot be negative"],
      validate: {
        validator: function(value) {
          return value >= 0;
        },
        message: "Handling fee must be a non-negative number"
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    }
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Method to get full category path (for breadcrumbs)
categorySchema.methods.getPath = async function () {
  const path = [this];

  let currentCategory = this;
  while (currentCategory.parent) {
    const parentCategory = await mongoose.model('Category').findById(currentCategory.parent);
    if (!parentCategory) break;

    path.unshift(parentCategory);
    currentCategory = parentCategory;
  }

  return path;
};

const Category = mongoose.model("Category", categorySchema);

export default Category;
