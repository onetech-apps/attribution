import { Router } from 'express';
import adminController from '../controllers/adminController';

const router = Router();

/**
 * Get recent clicks
 * GET /api/v1/admin/clicks?limit=20
 */
router.get('/admin/clicks', adminController.getClicks.bind(adminController));

/**
 * Get recent attributions
 * GET /api/v1/admin/attributions?limit=20
 */
router.get('/admin/attributions', adminController.getAttributions.bind(adminController));

/**
 * Get click by ID
 * GET /api/v1/admin/click/:clickId
 */
router.get('/admin/click/:clickId', adminController.getClickById.bind(adminController));

/**
 * Verify link
 * POST /api/v1/admin/verify-link
 */
router.post('/admin/verify-link', adminController.verifyLink.bind(adminController));


/**
 * Get live events
 * GET /api/v1/admin/events
 */
router.get('/admin/events', adminController.getEvents.bind(adminController));

/**
 * Get health details
 * GET /api/v1/admin/health-details
 */
router.get('/admin/health-details', adminController.getHealthDetails.bind(adminController));


/**
 * App Management — handled by appRoutes.ts (with API key generation)
 */

/**
 * Log Management
 */
router.get('/admin/logs/postbacks', adminController.getPostbackLogs.bind(adminController));
router.delete('/admin/logs/postbacks', adminController.clearPostbackLogs.bind(adminController));
router.get('/admin/logs/errors', adminController.getErrorLogs.bind(adminController));
router.delete('/admin/logs/errors', adminController.clearErrorLogs.bind(adminController));


export default router;

