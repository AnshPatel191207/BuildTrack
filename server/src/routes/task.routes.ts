import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { taskBodySchema, taskUpdateSchema, taskQuerySchema } from '../validators/task.validator';
import * as tasks from '../controllers/task.controller';

const router = Router();

router.use(protect);

router.get('/', authorize('owner', 'manager', 'engineer'), validate({ query: taskQuerySchema }), asyncHandler(tasks.listTasks));
router.post('/', authorize('owner', 'manager', 'engineer'), validate({ body: taskBodySchema }), asyncHandler(tasks.createTask));
router.put('/:id', authorize('owner', 'manager', 'engineer'), validate({ body: taskUpdateSchema }), asyncHandler(tasks.updateTask));
router.delete('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(tasks.deleteTask));

export default router;
