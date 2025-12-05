// routes/refund.routes.js

import express from 'express';
import { getReturnedOrders } from '../controllers/refund.controller.js';

const router = express.Router();

router.get('/returned-orders', getReturnedOrders);

export default router;
