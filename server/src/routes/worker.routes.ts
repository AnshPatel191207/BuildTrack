import { Router } from 'express';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { workerBodySchema, workerUpdateSchema, workerQuerySchema } from '../validators/worker.validator';
import * as workers from '../controllers/worker.controller';

const router = Router();

router.use(protect);

router.get('/', authorize('owner', 'manager', 'engineer'), validate({ query: workerQuerySchema }), asyncHandler(workers.listWorkers));
router.post('/', authorize('owner', 'manager', 'engineer'), validate({ body: workerBodySchema }), asyncHandler(workers.createWorker));
router.get('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(workers.getWorker));
router.put('/:id', authorize('owner', 'manager', 'engineer'), validate({ body: workerUpdateSchema }), asyncHandler(workers.updateWorker));
router.delete('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(workers.deleteWorker));

export default router;
