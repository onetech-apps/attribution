import { Router } from 'express';
import postbackController from '../controllers/postbackController';

const router = Router();

/**
 * Postback endpoint for receiving events from offers
 * GET /api/v1/postback?subid={click_id}&status={lead|sale}
 */
router.get('/postback', postbackController.handlePostback.bind(postbackController));

/**
 * Postback statistics (for debugging)
 * GET /api/v1/postback/stats
 */
router.get('/postback/stats', postbackController.getStats.bind(postbackController));

export default router;
