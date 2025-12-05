import { Router } from 'express';
import { getNotifications } from '../controllers/notification.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJWT);
router.get('/', getNotifications);
router.post('/read', (req, res) => res.json({ success: true, message: 'Notifications marked as read.' }));

export default router; 