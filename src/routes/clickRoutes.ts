import { Router } from 'express';
import clickController from '../controllers/clickController';

const router = Router();

/**
 * Click tracking endpoints with multiple URL formats
 */

// Click stats (used by dashboard)
router.get('/api/v1/clicks/stats', clickController.getStats.bind(clickController));

// Standard API endpoint
router.get('/api/v1/track/click', clickController.trackClick.bind(clickController));

// Short aliases (clean URLs)
router.get('/t', clickController.trackClick.bind(clickController));
router.get('/click', clickController.trackClick.bind(clickController));
router.get('/track', clickController.trackClick.bind(clickController));

// Root path (shortest possible)
// Note: This should be last to avoid conflicts
router.get('/', (req, res) => {
    // Only handle as click tracking if has tracking parameters
    if (req.query.fb_id || req.query.fbclid || req.query.sub1) {
        return clickController.trackClick(req, res);
    }
    // Otherwise, show info page
    res.json({
        message: 'Attribution System',
        endpoints: {
            click_tracking: [
                '/api/v1/track/click',
                '/t',
                '/click',
                '/track',
                '/ (with parameters)'
            ],
            attribution: '/api/v1/attribution',
            postback: '/api/v1/postback'
        }
    });
});

export default router;
