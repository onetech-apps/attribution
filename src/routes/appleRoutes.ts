import { Router } from 'express';
import { TenantRequest } from '../middleware/tenantMiddleware';

const router = Router();

/**
 * Apple App Site Association
 * Динамічно генерується для кожного домену/додатку
 */
router.get('/.well-known/apple-app-site-association', async (req: TenantRequest, res) => {
    const tenant = req.tenant;

    if (!tenant) {
        return res.status(404).json({ error: 'App not configured for this domain' });
    }

    const aasa = {
        applinks: {
            apps: [],
            details: [
                {
                    appID: `${tenant.team_id}.${tenant.bundle_id}`,
                    paths: [
                        '/api/v1/track/click',
                        '/t',
                        '/click',
                        '/track',
                        '/*'
                    ]
                }
            ]
        }
    };

    // Return as JSON without .json extension
    res.setHeader('Content-Type', 'application/json');
    res.json(aasa);
});

export default router;
