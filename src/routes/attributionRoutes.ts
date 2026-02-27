import { Router } from 'express';
import attributionController from '../controllers/attributionController';
import { validateApiKey } from '../middleware/auth';

const router = Router();

// Fetch attribution (protected with API key)
router.post('/attribution', validateApiKey, attributionController.fetchAttribution.bind(attributionController));

// Get attribution statistics (protected with API key)
router.get('/attribution/stats', validateApiKey, attributionController.getStats.bind(attributionController));

export default router;
