import { Router } from 'express';
import * as statsController from '../controllers/statsController';

const router = Router();

router.get('/', statsController.getStats);

export default router;
