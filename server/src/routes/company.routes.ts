import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import {
  createCompany,
  getMyCompany,
  updateCompany,
  listTeamMembers,
  createTeamMember,
  updateTeamMember,
} from '../controllers/company.controller';
import { validate } from '../middleware/validate';
import { companySchema, createUserSchema, updateUserSchema } from '../validators/company.validator';

const router = Router();

router.use(protect);

router.post('/', authorize('owner'), validate(companySchema), asyncHandler(createCompany));
router.get('/', asyncHandler(getMyCompany));
router.put('/', authorize('owner'), validate(companySchema.partial()), asyncHandler(updateCompany));

// Team management (owner only)
router.get('/team', authorize('owner', 'manager'), asyncHandler(listTeamMembers));
router.post('/team', authorize('owner'), validate(createUserSchema), asyncHandler(createTeamMember));
router.put('/team/:id', authorize('owner'), validate(updateUserSchema), asyncHandler(updateTeamMember));

export default router;
