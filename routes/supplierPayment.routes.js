import { Router } from "express";
import { 
  getSupplierBusinessNames,
  getSupplierBusinessNameById,
  searchSupplierBusinessNames
} from "../controllers/supplierPayment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Route to get all supplier business names (temporarily without auth for testing)
router.route("/business-names").get(getSupplierBusinessNames);

// Apply authentication middleware to other routes
router.use(verifyJWT);

// Route to search supplier business names
router.route("/business-names/search").get(searchSupplierBusinessNames);

// Route to get supplier business name by ID
router.route("/business-names/:id").get(getSupplierBusinessNameById);

export default router;