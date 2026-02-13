import { Request, Response } from 'express';
import { query } from '../config/database';
import { eventLogger } from '../utils/eventLogger';
import os from 'os';
import axios from 'axios';



export class AdminController {
    /**
     * Get recent clicks for admin dashboard
     * GET /api/v1/admin/clicks?limit=20
     */
    async getClicks(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await query(
                `SELECT * FROM clicks 
                 ORDER BY created_at DESC 
                 LIMIT $1`,
                [limit]
            );

            res.json({
                clicks: result.rows,
                count: result.rows.length,
            });
        } catch (error) {
            console.error('Error getting clicks:', error);
            res.status(500).json({ error: 'Failed to get clicks' });
        }
    }

    /**
     * Get recent attributions for admin dashboard
     * GET /api/v1/admin/attributions?limit=20
     */
    async getAttributions(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await query(
                `SELECT * FROM attributions 
                 ORDER BY created_at DESC 
                 LIMIT $1`,
                [limit]
            );

            res.json({
                attributions: result.rows,
                count: result.rows.length,
            });
        } catch (error) {
            console.error('Error getting attributions:', error);
            res.status(500).json({ error: 'Failed to get attributions' });
        }
    }

    /**
     * Get click by ID
     * GET /api/v1/admin/click/:clickId
     */
    async getClickById(req: Request, res: Response): Promise<void> {
        try {
            const { clickId } = req.params;

            const result = await query('SELECT * FROM clicks WHERE click_id = $1', [clickId]);

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Click not found' });
                return;
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error getting click:', error);
            res.status(500).json({ error: 'Failed to get click' });
        }
    }
    /**
     * Get recent events (live log)
     * GET /api/v1/admin/events?since=<timestamp>
     */
    async getEvents(req: Request, res: Response): Promise<void> {
        try {
            const since = req.query.since ? parseInt(req.query.since as string) : undefined;
            const events = eventLogger.getEvents(since);
            res.json({ events });
        } catch (error) {
            console.error('Error getting events:', error);
            res.status(500).json({ error: 'Failed to get events' });
        }
    }

    /**
     * Get detailed system health
     * GET /api/v1/admin/health-details
     */
    async getHealthDetails(req: Request, res: Response): Promise<void> {
        try {
            const memUsage = process.memoryUsage();

            res.json({
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                },
                system: {
                    loadAvg: os.loadavg(),
                    freeMem: Math.round(os.freemem() / 1024 / 1024) + 'MB',
                    totalMem: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
                }
            });
        } catch (error) {
            console.error('Error getting health details:', error);
            res.status(500).json({ error: 'Failed to get health details' });
        }
    }
    /**
     * Verify a tracking link
     * POST /api/v1/admin/verify-link
     * Body: { url: string }
     */
    async verifyLink(req: Request, res: Response): Promise<void> {
        try {
            const { url } = req.body;

            if (!url) {
                res.status(400).json({ error: 'URL is required' });
                return;
            }

            console.log('🔍 Verifying link:', url);
            const report: any = {
                steps: [],
                success: false
            };

            // Step 1: Check URL format and parameters
            report.steps.push({ name: 'Format Check', status: 'pending' });
            try {
                const parsedUrl = new URL(url);
                const sub1 = parsedUrl.searchParams.get('sub1');

                if (!sub1) {
                    throw new Error('Missing sub1 parameter (required for verification)');
                }

                report.steps[0].status = 'success';
                report.steps[0].details = `Valid URL. Campaign (sub1): ${sub1}`;
                report.campaign = sub1;
                report.params = Object.fromEntries(parsedUrl.searchParams);
            } catch (e: any) {
                report.steps[0].status = 'failed';
                report.steps[0].error = e.message;
                res.json(report);
                return;
            }

            // Step 2: HTTP Request to check redirect
            report.steps.push({ name: 'HTTP Check', status: 'pending' });
            try {
                const response = await axios.get(url, {
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400
                });

                if (response.status === 302 || response.status === 301) {
                    report.steps[1].status = 'success';
                    report.steps[1].details = `Redirects to: ${response.headers.location}`;
                    report.redirectUrl = response.headers.location;
                } else {
                    report.steps[1].status = 'warning';
                    report.steps[1].details = `Status ${response.status} (expected 302)`;
                }
            } catch (e: any) {
                report.steps[1].status = 'failed';
                report.steps[1].error = e.message;
                // Continue anyway to check DB
            }

            // Step 3: Check Database for Click
            report.steps.push({ name: 'Database Check', status: 'pending' });
            // Wait a bit for async insert
            await new Promise(r => setTimeout(r, 1000));

            const clickResult = await query(
                'SELECT * FROM clicks WHERE sub1 = $1 ORDER BY created_at DESC LIMIT 1',
                [report.campaign]
            );

            if (clickResult.rows.length > 0) {
                const click = clickResult.rows[0];
                report.steps[2].status = 'success';
                report.steps[2].details = `Click found! ID: ${click.click_id}`;
                report.click = click;
                report.success = true;
            } else {
                report.steps[2].status = 'failed';
                report.steps[2].details = 'Click not found in database (even after waiting)';
            }

            res.json(report);

        } catch (error) {
            console.error('Error verifying link:', error);
            res.status(500).json({ error: 'Failed to verify link' });
        }
    }

    /**
     * Get all apps
     * GET /api/v1/admin/apps
     */
    async getApps(req: Request, res: Response): Promise<void> {
        try {
            const result = await query('SELECT * FROM apps ORDER BY created_at DESC');
            res.json({ success: true, apps: result.rows });
        } catch (error) {
            console.error('Error getting apps:', error);
            res.status(500).json({ error: 'Failed to get apps' });
        }
    }

    /**
     * Create app
     * POST /api/v1/admin/apps
     */
    async createApp(req: Request, res: Response): Promise<void> {
        try {
            const { app_id, domain, team_id, bundle_id, app_name, app_store_url, appsflyer_enabled, appsflyer_dev_key, active } = req.body;

            // Generate simple API Key
            const apiKey = 'key_' + Math.random().toString(36).substr(2, 16);

            const result = await query(
                `INSERT INTO apps (app_id, domain, team_id, bundle_id, app_name, api_key, app_store_url, appsflyer_enabled, appsflyer_dev_key, active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [app_id, domain, team_id, bundle_id, app_name, apiKey, app_store_url, appsflyer_enabled || false, appsflyer_dev_key, active !== false]
            );

            // Also insert into api_keys table for redundancy/lookup if needed
            await query(
                `INSERT INTO api_keys (app_name, api_key, active) VALUES ($1, $2, $3)`,
                [app_name, apiKey, true]
            );

            res.json({ success: true, message: 'App created', app: result.rows[0] });
        } catch (error: any) {
            console.error('Error creating app:', error);
            res.status(500).json({ error: error.message || 'Failed to create app' });
        }
    }

    /**
     * Update app
     * PUT /api/v1/admin/apps/:id
     */
    async updateApp(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { app_id, domain, team_id, bundle_id, app_name, app_store_url, appsflyer_enabled, appsflyer_dev_key, active } = req.body;

            const result = await query(
                `UPDATE apps 
                 SET app_id = $1, domain = $2, team_id = $3, bundle_id = $4, app_name = $5, 
                     app_store_url = $6, appsflyer_enabled = $7, appsflyer_dev_key = $8, active = $9
                 WHERE id = $10
                 RETURNING *`,
                [app_id, domain, team_id, bundle_id, app_name, app_store_url, appsflyer_enabled, appsflyer_dev_key, active, id]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'App not found' });
                return;
            }

            res.json({ success: true, message: 'App updated', app: result.rows[0] });
        } catch (error: any) {
            console.error('Error updating app:', error);
            res.status(500).json({ error: error.message || 'Failed to update app' });
        }
    }

    /**
     * Delete app
     * DELETE /api/v1/admin/apps/:id
     */
    async deleteApp(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const result = await query('DELETE FROM apps WHERE id = $1 RETURNING *', [id]);

            if (result.rows.length === 0) {
                res.status(404).json({ error: 'App not found' });
                return;
            }

            res.json({ success: true, message: 'App deleted' });
        } catch (error) {
            console.error('Error deleting app:', error);
            res.status(500).json({ error: 'Failed to delete app' });
        }
    }

    /**
     * Get postback logs
     * GET /api/v1/admin/logs/postbacks
     */
    async getPostbackLogs(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 50;
            const result = await query(
                'SELECT * FROM postback_logs ORDER BY created_at DESC LIMIT $1',
                [limit]
            );
            res.json({ logs: result.rows });
        } catch (error) {
            console.error('Error getting postback logs:', error);
            res.status(500).json({ error: 'Failed to get postback logs' });
        }
    }

    /**
     * Clear postback logs
     * DELETE /api/v1/admin/logs/postbacks
     */
    async clearPostbackLogs(req: Request, res: Response): Promise<void> {
        try {
            await query('DELETE FROM postback_logs');
            res.json({ success: true, message: 'Postback logs cleared' });
        } catch (error) {
            console.error('Error clearing postback logs:', error);
            res.status(500).json({ error: 'Failed to clear postback logs' });
        }
    }

    /**
     * Get error logs
     * GET /api/v1/admin/logs/errors
     */
    async getErrorLogs(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 50;
            const result = await query(
                'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT $1',
                [limit]
            );
            res.json({ logs: result.rows });
        } catch (error) {
            console.error('Error getting error logs:', error);
            res.status(500).json({ error: 'Failed to get error logs' });
        }
    }

    /**
     * Clear error logs
     * DELETE /api/v1/admin/logs/errors
     */
    async clearErrorLogs(req: Request, res: Response): Promise<void> {
        try {
            await query('DELETE FROM error_logs');
            res.json({ success: true, message: 'Error logs cleared' });
        } catch (error) {
            console.error('Error clearing error logs:', error);
            res.status(500).json({ error: 'Failed to clear error logs' });
        }
    }
}

export default new AdminController();
