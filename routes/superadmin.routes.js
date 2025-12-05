import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
//import cors from "cors";

import {
  loginSuperAdmin,
  getSuperAdminProfile,
  updateSuperAdminProfile,
  changeSuperAdminPassword,
  uploadSuperAdminAvatar,
  logoutSuperAdmin
} from '../controllers/superadmin.controller.js';

const router = express.Router();

// Public routes
router.post('/login', loginSuperAdmin);
router.post('/logout', logoutSuperAdmin);

// Protected routes - require authentication
router.use(verifyJWT);
router.use(authorizeRoles('superadmin'));

router.get('/profile', getSuperAdminProfile);
router.put('/profile', updateSuperAdminProfile);
router.put('/change-password', changeSuperAdminPassword);
router.put('/avatar', upload.single('avatar'), uploadSuperAdminAvatar);

export default router; 