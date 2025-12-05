import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";

// Create a new category
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parent } = req.body;

  // Validate required fields
  if (!name) {
    throw new ApiError(400, "Category name is required");
  }

  // Check if category with same name already exists
  const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
  if (existingCategory) {
    throw new ApiError(409, "Category with this name already exists");
  }

  // Check if parent category exists if provided
  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) {
      throw new ApiError(404, "Parent category not found");
    }
  }

  // Create category object
  const categoryData = {
    name,
    description,
    parent: parent || null,
    createdBy: req.user._id
  };

  // Handle image upload if file is provided
  if (req.file) {
    console.log('req.file:', req.file);
    const uploadResult = await uploadToCloudinary(req.file, "categories");

    if (!uploadResult) {
      throw new ApiError(500, "Error uploading category image");
    }

    categoryData.image = {
      url: uploadResult.url,
      publicId: uploadResult.public_id || uploadResult.publicId
    };
  }

  // Create category
  const category = await Category.create(categoryData);

  return res.status(201).json(
    new ApiResponse(
      201,
      { category },
      "Category created successfully"
    )
  );
});

//==========================================================================

// export const createCategory = asyncHandler(async (req, res) => {
//   const { name, description, parent, subCategory } = req.body;

//   // Validate required fields
//   if (!name) {
//     throw new ApiError(400, "Category name is required");
//   }

//   // Check if category with the same name already exists (case-insensitive)
//   const existingCategory = await Category.findOne({
//     name: { $regex: new RegExp(`^${name}$`, "i") },
//   });

//   if (existingCategory) {
//     throw new ApiError(409, "Category with this name already exists");
//   }

//   // Check if parent category exists (if provided)
//   if (parent) {
//     const parentCategory = await Category.findById(parent);
//     if (!parentCategory) {
//       throw new ApiError(404, "Parent category not found");
//     }
//   }

//   const categoryData = {
//     name,
//     description,
//     parent: parent || null,
//     createdBy: req.user._id,
//   };

//   // Handle main category image
//   if (req.file) {
//     const uploadResult = await uploadToCloudinary(req.file, "categories");
//     if (!uploadResult) {
//       throw new ApiError(500, "Error uploading category image");
//     }
//     categoryData.image = {
//       url: uploadResult.url,
//       publicId: uploadResult.public_id || uploadResult.publicId,
//     };
//   }

//   // Handle optional subCategory array (if provided)
//   if (Array.isArray(subCategory) && subCategory.length > 0) {
//     categoryData.subCategory = [];

//     for (const sub of subCategory) {
//       if (!sub.name) {
//         throw new ApiError(400, "Each subcategory must have a name");
//       }

//       const subCat = {
//         name: sub.name,
//         description: sub.description || "",
//         isActive: sub.isActive !== undefined ? sub.isActive : true,
//       };

//       // Handle subcategory image if provided (assumes sub.image is a URL or file object — adapt as needed)
//       if (sub.imageFile) {
//         const uploadResult = await uploadToCloudinary(sub.imageFile, "subcategories");
//         if (uploadResult) {
//           subCat.image = {
//             url: uploadResult.url,
//             publicId: uploadResult.public_id || uploadResult.publicId,
//           };
//         }
//       }

//       categoryData.subCategory.push(subCat);
//     }
//   }

//   // Create the new category document
//   const category = await Category.create(categoryData);

//   return res.status(201).json(
//     new ApiResponse(201, { category }, "Category created successfully")
//   );
// });

//=========================================================================================

// Get all categories
export const getAllCategories = asyncHandler(async (req, res) => {
  const { parent, includeSubcategories = "false", includeInactive = "false" } = req.query;

  let query = {};
  if (includeInactive !== "true") {
    query.isActive = true;
  }

  // Filter by parent
  if (parent === "null" || parent === "") {
    query.parent = null;
  } else if (parent) {
    query.parent = parent;
  }

  // Get categories
  let categories;

  if (includeSubcategories === "true") {
    // Get all categories with populated subcategories
    categories = await Category.find({ isActive: true })
      .populate({
        path: "subcategories",
        match: { isActive: true }
      })
      .sort({ name: 1 });

    // Filter root categories if parent query is provided
    if (parent === "null" || parent === "") {
      categories = categories.filter(category => category.parent === null);
    } else if (parent) {
      categories = categories.filter(category =>
        category.parent && category.parent.toString() === parent
      );
    }
  } else {
    // Get categories without populating subcategories
    categories = await Category.find(query).sort({ name: 1 });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { categories },
      "Categories fetched successfully"
    )
  );
});

// Get category by ID
export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id).populate({
    path: "subcategories",
    match: { isActive: true }
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { category },
      "Category fetched successfully"
    )
  );
});

// Update category
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, parent, isActive } = req.body;

  // Find category
  const category = await Category.findById(id);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Check if new name already exists
  if (name && name !== category.name) {
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: id }
    });

    if (existingCategory) {
      throw new ApiError(409, "Category with this name already exists");
    }
  }

  // Check if parent category exists if provided
  if (parent) {
    // Prevent circular reference
    if (parent === id) {
      throw new ApiError(400, "Category cannot be its own parent");
    }

    const parentCategory = await Category.findById(parent);
    if (!parentCategory) {
      throw new ApiError(404, "Parent category not found");
    }

    // Check if new parent is not one of its own descendants
    const checkCircularReference = async (categoryId, potentialParentId) => {
      const descendants = await Category.find({ parent: categoryId });

      for (const descendant of descendants) {
        if (descendant._id.toString() === potentialParentId) {
          return true;
        }

        const hasCircularRef = await checkCircularReference(descendant._id, potentialParentId);
        if (hasCircularRef) {
          return true;
        }
      }

      return false;
    };

    const hasCircularRef = await checkCircularReference(id, parent);
    if (hasCircularRef) {
      throw new ApiError(400, "Circular category reference detected");
    }
  }

  // Update fields if provided
  if (name) category.name = name;
  if (description !== undefined) category.description = description;
  if (parent !== undefined) category.parent = parent || null;
  if (isActive !== undefined) category.isActive = isActive === true || isActive === "true";

  // Handle image upload if file is provided
  if (req.file) {
    // Delete old image if exists
    if (category.image?.publicId) {
      await deleteFromCloudinary(category.image.publicId);
    }
    // Upload new image
    const uploadResult = await uploadToCloudinary(req.file, "categories");
    console.log('uploadResult:', uploadResult);
    if (!uploadResult) {
      throw new ApiError(500, "Error uploading category image");
    }
    category.image = {
      url: uploadResult.url,
      publicId: uploadResult.public_id || uploadResult.publicId
    };
  }

  // Save category
  await category.save();
  console.log('Category updated and saved:', category);

  return res.status(200).json(
    new ApiResponse(
      200,
      { category },
      "Category updated successfully"
    )
  );
});

// Delete category
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find category
  const category = await Category.findById(id);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Check if category has subcategories
  const subcategories = await Category.find({ parent: id });
  if (subcategories.length > 0) {
    throw new ApiError(400, "Cannot delete category with subcategories. Please delete or reassign subcategories first.");
  }

  // Check if category has products
  const products = await Product.find({ categoryId: id });
  if (products.length > 0) {
    throw new ApiError(400, "Cannot delete category with associated products. Please delete or reassign products first.");
  }

  // Delete category image from cloudinary if exists
  if (category.image?.publicId) {
    await deleteFromCloudinary(category.image.publicId);
  }

  // Delete category
  await Category.findByIdAndDelete(id);

  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Category deleted successfully"
    )
  );
});

// Add handling fee to category
export const addHandlingFee = asyncHandler(async (req, res) => {
  const { categoryId, handlingFee } = req.body;

  // Validate required fields
  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  if (handlingFee === undefined || handlingFee === null) {
    throw new ApiError(400, "Handling fee is required");
  }

  // Validate handling fee is a valid number and non-negative
  const fee = parseFloat(handlingFee);
  if (isNaN(fee) || fee < 0) {
    throw new ApiError(400, "Handling fee must be a valid non-negative number");
  }

  // Find category
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Update handling fee
  category.handlingFee = fee;
  await category.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        category: {
          _id: category._id,
          name: category.name,
          handlingFee: category.handlingFee
        }
      },
      "Handling fee added successfully"
    )
  );
});

// Get handling fee for a single category
export const getCategoryHandlingFee = asyncHandler(async (req, res) => {
  const { categoryId } = req.params; // Get categoryId from URL params

  // Validate required field
  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  // Find the category
  const category = await Category.findById(categoryId).select('_id name handlingFee');

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        category: {
          _id: category._id,
          name: category.name,
          handlingFee: category.handlingFee || 0
        }
      },
      "Handling fee fetched successfully"
    )
  );
});

// Get category tree
export const getCategoryTree = asyncHandler(async (req, res) => {
  // Get all categories
  const allCategories = await Category.find({ isActive: true }).sort({ name: 1 });

  // Build category tree
  const buildCategoryTree = (categories, parent = null) => {
    const tree = [];

    categories
      .filter(category =>
        parent === null
          ? category.parent === null
          : category.parent && category.parent.toString() === parent.toString()
      )
      .forEach(category => {
        const children = buildCategoryTree(categories, category._id);

        tree.push({
          _id: category._id,
          name: category.name,
          description: category.description,
          image: category.image,
          children: children.length > 0 ? children : undefined
        });
      });

    return tree;
  };

  const categoryTree = buildCategoryTree(allCategories);

  return res.status(200).json(
    new ApiResponse(
      200,
      { categories: categoryTree },
      "Category tree fetched successfully"
    )
  );
});

