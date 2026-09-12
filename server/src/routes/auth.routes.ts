import { Router } from 'express';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/apiResponse';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

router.use(protect);
router.get('/me', asyncHandler(authController.me));
router.put('/change-password', asyncHandler(authController.changePassword));
router.patch('/profile', asyncHandler(authController.updateProfile));

export default router;
