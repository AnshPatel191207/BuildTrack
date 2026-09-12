import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { projectBodySchema, projectUpdateSchema, projectQuerySchema } from '../validators/project.validator';
import * as projects from '../controllers/project.controller';
import { getProjectDashboard } from '../controllers/dashboard.controller';

const router = Router();

router.use(protect);

router.get('/', authorize('owner', 'manager', 'engineer', 'worker'), validate({ query: projectQuerySchema }), asyncHandler(projects.listProjects));
router.post('/', authorize('owner', 'manager'), validate({ body: projectBodySchema }), asyncHandler(projects.createProject));
router.get('/:id', asyncHandler(projects.getProject));
router.put('/:id', authorize('owner', 'manager'), validate({ body: projectUpdateSchema }), asyncHandler(projects.updateProject));
router.delete('/:id', authorize('owner'), asyncHandler(projects.deleteProject));
router.get('/:id/dashboard', asyncHandler(getProjectDashboard));

export default router;
