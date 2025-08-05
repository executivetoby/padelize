import { Router } from 'express';
import {
  deleteUser,
  getUser,
  getUsers,
  updateUser,
  uploadImage,
} from '../controllers/userController.js';
import { protect } from '../controllers/authController.js';
import { uploadUserImage } from '../services/uploadService.js';

const router = Router();

router.use(protect);

router.get('/', getUsers);
router.patch('/image', uploadUserImage, uploadImage);
router.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);

export default router;
