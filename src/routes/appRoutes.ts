import { Router, Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantMiddleware';
import { generateApiKey } from '../utils/helpers';

const router = Router();

/**
 * Get all apps
 */
router.get('/admin/apps', async (req: TenantRequest, res: Response) => {
    try {
        const result = await query(
            'SELECT id, app_id, domain, team_id, bundle_id, app_name, api_key, app_store_url, appsflyer_dev_key, appsflyer_enabled, active, created_at FROM apps ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            apps: result.rows
        });
    } catch (error) {
        console.error('Error fetching apps:', error);
        res.status(500).json({ error: 'Failed to fetch apps' });
    }
});

/**
 * Create new app
 */
router.post('/admin/apps', async (req: TenantRequest, res: Response) => {
    try {
        const { app_id, domain, team_id, bundle_id, app_name, app_store_url, appsflyer_dev_key, appsflyer_enabled } = req.body;

        // Validate required fields
        if (!app_id || !domain || !team_id || !bundle_id || !app_name) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Generate API key
        const api_key = generateApiKey();

        // Insert into database
        const result = await query(
            `INSERT INTO apps (app_id, domain, team_id, bundle_id, app_name, api_key, app_store_url, appsflyer_dev_key, appsflyer_enabled, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
             RETURNING *`,
            [app_id, domain, team_id, bundle_id, app_name, api_key, app_store_url || null, appsflyer_dev_key || null, appsflyer_enabled || false]
        );

        console.log('✅ App created:', app_name);

        res.json({
            success: true,
            app: result.rows[0],
            message: 'App created successfully'
        });
    } catch (error: any) {
        console.error('Error creating app:', error);

        if (error.code === '23505') { // Unique violation
            res.status(400).json({ error: 'App ID or domain already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create app' });
        }
    }
});

/**
 * Update app
 */
router.put('/admin/apps/:id', async (req: TenantRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { domain, team_id, bundle_id, app_name, app_store_url, appsflyer_dev_key, appsflyer_enabled, active } = req.body;

        const result = await query(
            `UPDATE apps 
             SET domain = $1, team_id = $2, bundle_id = $3, app_name = $4, 
                 app_store_url = $5, appsflyer_dev_key = $6, appsflyer_enabled = $7, active = $8
             WHERE id = $9
             RETURNING *`,
            [domain, team_id, bundle_id, app_name, app_store_url, appsflyer_dev_key, appsflyer_enabled, active, id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'App not found' });
            return;
        }

        console.log('✅ App updated:', app_name);

        res.json({
            success: true,
            app: result.rows[0],
            message: 'App updated successfully'
        });
    } catch (error) {
        console.error('Error updating app:', error);
        res.status(500).json({ error: 'Failed to update app' });
    }
});

/**
 * Delete app
 */
router.delete('/admin/apps/:id', async (req: TenantRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM apps WHERE id = $1 RETURNING app_name', [id]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'App not found' });
            return;
        }

        console.log('✅ App deleted:', result.rows[0].app_name);

        res.json({
            success: true,
            message: 'App deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting app:', error);
        res.status(500).json({ error: 'Failed to delete app' });
    }
});

export default router;
