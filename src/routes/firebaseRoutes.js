import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import { saveToken } from '../controllers/firebaseController.js';

const router = Router();

router.post('/save', protect, saveToken);

export default router;
