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
            const page = parseInt(req.query.page as string) || 1;
            const search = req.query.search as string;
            const hasAttribution = req.query.hasAttribution as string;
            const offset = (page - 1) * limit;

            let countQuery = 'SELECT COUNT(*) FROM clicks c';
            let dataQuery = 'SELECT c.* FROM clicks c';
            const queryParams: any[] = [];
            let whereClauses: string[] = [];

            if (search) {
                queryParams.push(`%${search}%`);
                whereClauses.push(`(c.click_id ILIKE $${queryParams.length} OR c.fbclid ILIKE $${queryParams.length})`);
            }

            if (hasAttribution === 'true') {
                // If we need to filter clicks that have attributions, we can join or use EXISTS
                whereClauses.push(`EXISTS (SELECT 1 FROM attributions a WHERE a.click_id = c.click_id)`);
            } else if (hasAttribution === 'false') {
                whereClauses.push(`NOT EXISTS (SELECT 1 FROM attributions a WHERE a.click_id = c.click_id)`);
            }

            if (whereClauses.length > 0) {
                const whereString = ' WHERE ' + whereClauses.join(' AND ');
                countQuery += whereString;
                dataQuery += whereString;
            }

            dataQuery += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;

            const countResult = await query(countQuery, queryParams);
            const totalCount = parseInt(countResult.rows[0].count);

            const result = await query(dataQuery, [...queryParams, limit, offset]);

            res.json({
                clicks: result.rows,
                count: result.rows.length,
                total: totalCount,
                page,
                totalPages: Math.ceil(totalCount / limit)
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
            const page = parseInt(req.query.page as string) || 1;
            const search = req.query.search as string;
            const offset = (page - 1) * limit;

            let countQuery = 'SELECT COUNT(*) FROM attributions';
            let dataQuery = 'SELECT * FROM attributions';
            const queryParams: any[] = [];
            let whereClauses: string[] = [];

            if (search) {
                queryParams.push(`%${search}%`);
                whereClauses.push(`click_id ILIKE $${queryParams.length}`);
            }

            if (whereClauses.length > 0) {
                const whereString = ' WHERE ' + whereClauses.join(' AND ');
                countQuery += whereString;
                dataQuery += whereString;
            }

            dataQuery += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;

            const countResult = await query(countQuery, queryParams);
            const totalCount = parseInt(countResult.rows[0].count);

            const result = await query(dataQuery, [...queryParams, limit, offset]);

            res.json({
                attributions: result.rows,
                count: result.rows.length,
                total: totalCount,
                page,
                totalPages: Math.ceil(totalCount / limit)
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
     * Supports: ?page=1&limit=20&search=click_id&status=failed|success|all
     */
    async getPostbackLogs(req: Request, res: Response): Promise<void> {
        try {
            const page = Math.max(1, parseInt(req.query.page as string) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
            const search = (req.query.search as string || '').trim();
            const statusFilter = (req.query.status as string || 'all').toLowerCase();
            const offset = (page - 1) * limit;

            let whereClause = '';
            const params: any[] = [];
            const conditions: string[] = [];

            if (search) {
                params.push(`%${search}%`);
                conditions.push(`(click_id ILIKE $${params.length} OR url ILIKE $${params.length})`);
            }

            if (statusFilter === 'failed') {
                conditions.push(`(response_status < 200 OR response_status >= 300)`);
            } else if (statusFilter === 'success') {
                conditions.push(`(response_status >= 200 AND response_status < 300)`);
            }

            if (conditions.length > 0) {
                whereClause = 'WHERE ' + conditions.join(' AND ');
            }

            // Get total count
            const countResult = await query(
                `SELECT COUNT(*) as total FROM postback_logs ${whereClause}`,
                params
            );
            const total = parseInt(countResult.rows[0].total);

            // Get paginated results
            params.push(limit);
            params.push(offset);
            const result = await query(
                `SELECT * FROM postback_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            res.json({
                logs: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Error getting postback logs:', error);
            res.status(500).json({ error: 'Failed to get postback logs' });
        }
    }

    /**
     * Resend a failed postback
     * POST /api/v1/admin/logs/postbacks/:id/resend
     */
    async resendPostback(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const logResult = await query('SELECT * FROM postback_logs WHERE id = $1', [id]);

            if (logResult.rows.length === 0) {
                res.status(404).json({ error: 'Log entry not found' });
                return;
            }

            const log = logResult.rows[0];

            // Re-send logic
            console.log(`🔄 Resending postback ID ${id} to ${log.url}`);

            try {
                let axiosResponse;
                let payload: any = null;
                let postUrl = '';
                let fullUrl = '';
                const axiosConfig = {
                    timeout: 10000,
                    validateStatus: () => true // Do not throw on 4xx/5xx
                };

                if (log.method === 'POST') {
                    // For Facebook CAPI / Appsflyer S2S
                    payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
                    postUrl = log.url;

                    // --- REBUILD FACEBOOK REQUEST FROM SCRATCH ---
                    // The old logs have broken payloads (missing tokens, bad URLs, "app" source).
                    // We extract original clean data from the clicks table to reconstruct an ideal request.
                    if (postUrl.includes('graph.facebook.com')) {
                        let rebuilt = false;
                        if (log.click_id) {
                            const clickRes = await query(
                                `SELECT c.*, a.domain as app_domain 
                                 FROM clicks c 
                                 LEFT JOIN apps a ON c.app_id = a.app_id 
                                 WHERE c.click_id = $1`,
                                [log.click_id]
                            );
                            if (clickRes.rows.length > 0) {
                                const click = clickRes.rows[0];
                                if (click.fb_token && click.fb_id) {
                                    // Extract original event name before overwriting
                                    let eventName = 'COMPLETE_REGISTRATION';
                                    if (payload && Array.isArray(payload.data) && payload.data[0]?.event_name) {
                                        eventName = payload.data[0].event_name;
                                    }

                                    const appDomain = click.app_domain || click.app_id || 'oneapps.info';

                                    payload = {
                                        data: [{
                                            event_name: eventName,
                                            event_time: Math.floor(Date.now() / 1000), // current retry time
                                            action_source: 'website',
                                            event_source_url: `https://${appDomain}`,
                                            user_data: {
                                                client_ip_address: click.ip_address,
                                                client_user_agent: click.user_agent,
                                                fbc: click.fbclid ? `fb.1.${Date.now()}.${click.fbclid}` : undefined
                                            },
                                            app_data: {
                                                application_tracking_enabled: 1,
                                                advertiser_tracking_enabled: 1
                                            }
                                        }],
                                        access_token: click.fb_token
                                    };

                                    // Safely overwrite postUrl with absolute correct Pixel ID and Token
                                    postUrl = `https://graph.facebook.com/v18.0/${click.fb_id}/events?access_token=${click.fb_token}`;
                                    rebuilt = true;
                                    console.log(`♻️ Reconstructed complete FB CAPI payload from click ${log.click_id}`);
                                }
                            }
                        }

                        // Fallback mutation if we couldn't rebuild from DB (e.g. click was deleted or no token)
                        if (!rebuilt) {
                            if (payload && Array.isArray(payload.data)) {
                                payload.data = payload.data.map((event: any) => {
                                    if (event.action_source === 'app') event.action_source = 'website';
                                    return event;
                                });
                            }
                            if (payload && payload.access_token && !postUrl.includes('access_token=')) {
                                postUrl += (postUrl.includes('?') ? '&' : '?') + 'access_token=' + payload.access_token;
                            }
                        }
                    }

                    axiosResponse = await axios.post(postUrl, payload, axiosConfig);
                } else {
                    // For Keitaro incoming simulation or standard GET
                    const urlParams = new URLSearchParams(log.payload).toString();
                    const fullUrl = log.url.includes('?')
                        ? (urlParams ? `${log.url}&${urlParams}` : log.url)
                        : (urlParams ? `${log.url}?${urlParams}` : log.url);

                    axiosResponse = await axios.get(fullUrl, axiosConfig);
                }

                const isSuccess = axiosResponse.status >= 200 && axiosResponse.status < 300;

                if (isSuccess) {
                    // Update the log entry with the new success status (keep it visible)
                    await query(
                        'UPDATE postback_logs SET response_status = $1, response_body = $2, url = $3, payload = $4, created_at = CURRENT_TIMESTAMP WHERE id = $5',
                        [axiosResponse.status, JSON.stringify(axiosResponse.data), log.method === 'POST' ? postUrl : fullUrl, JSON.stringify(log.method === 'POST' ? payload : log.payload), id]
                    );
                } else {
                    // Update the log entry with the new error to reflect the latest attempt
                    await query(
                        'UPDATE postback_logs SET response_status = $1, response_body = $2, url = $3, payload = $4, created_at = CURRENT_TIMESTAMP WHERE id = $5',
                        [axiosResponse.status, JSON.stringify(axiosResponse.data), log.method === 'POST' ? postUrl : fullUrl, JSON.stringify(log.method === 'POST' ? payload : log.payload), id]
                    );
                }

                // Check if Facebook actually accepted the events
                const eventsReceived = axiosResponse.data?.events_received;
                const fbMessages = axiosResponse.data?.messages;
                const fbReallyWorked = isSuccess && (eventsReceived === undefined || eventsReceived > 0);

                res.json({
                    success: isSuccess,
                    message: isSuccess
                        ? (eventsReceived !== undefined
                            ? `Постбек відправлено. Facebook прийняв: ${eventsReceived} подій`
                            : 'Постбек успішно відправлено')
                        : 'Постбек відхилено сервером',
                    response_status: axiosResponse.status,
                    response_body: axiosResponse.data,
                    events_received: eventsReceived,
                    fb_messages: fbMessages
                });

            } catch (err: any) {
                console.error(`❌ Resend failed for ID ${id}:`, err.message);

                // Update the log entry with the new error to reflect the latest attempt
                const newStatus = err.response?.status || 500;
                const newBody = err.response?.data || err.message;

                await query(
                    'UPDATE postback_logs SET response_status = $1, response_body = $2, created_at = CURRENT_TIMESTAMP WHERE id = $3',
                    [newStatus, JSON.stringify(newBody), id]
                );

                res.status(500).json({
                    error: 'Failed to resend postback',
                    details: err.response?.data || err.message,
                    status: newStatus
                });
            }

        } catch (error) {
            console.error('Error resending postback:', error);
            res.status(500).json({ error: 'Server error while resending postback' });
        }
    }

    /**
     * Bulk resend Facebook events from clicks table
     * POST /api/v1/admin/bulk-resend-fb
     * Queries clicks that have fb_id + fb_token + attributed=true
     * and sends fresh events to Facebook CAPI
     */
    async bulkResendFacebook(req: Request, res: Response): Promise<void> {
        try {
            const { dateFrom, dateTo, eventName } = req.body;
            const fbEventName = eventName || 'COMPLETE_REGISTRATION';

            // Build query to find attributed clicks with FB credentials
            let dateFilter = '';
            const params: any[] = [];

            if (dateFrom) {
                params.push(dateFrom);
                dateFilter += ` AND c.created_at >= $${params.length}`;
            }
            if (dateTo) {
                params.push(dateTo);
                dateFilter += ` AND c.created_at <= $${params.length}`;
            }

            const clicksResult = await query(
                `SELECT c.*, a.domain as app_domain 
                 FROM clicks c 
                 LEFT JOIN apps a ON c.app_id = a.app_id 
                 WHERE c.attributed = true 
                   AND c.fb_id IS NOT NULL AND c.fb_id != ''
                   AND c.fb_token IS NOT NULL AND c.fb_token != ''
                   ${dateFilter}
                 ORDER BY c.created_at DESC`,
                params
            );

            if (clicksResult.rows.length === 0) {
                res.json({
                    success: true,
                    message: 'Не знайдено кліків для перевідправки',
                    total: 0,
                    sent: 0,
                    failed: 0,
                    results: []
                });
                return;
            }

            console.log(`📦 Bulk FB resend: found ${clicksResult.rows.length} clicks to process`);

            const results: Array<{ click_id: string, status: string, events_received?: number, error?: string }> = [];
            let sent = 0;
            let failed = 0;

            for (const click of clicksResult.rows) {
                try {
                    const appDomain = click.app_domain || click.app_id || 'oneapps.info';
                    const payload = {
                        data: [{
                            event_name: fbEventName,
                            event_time: Math.floor(Date.now() / 1000),
                            action_source: 'website',
                            event_source_url: `https://${appDomain}`,
                            user_data: {
                                client_ip_address: click.ip_address,
                                client_user_agent: click.user_agent,
                                fbc: click.fbclid ? `fb.1.${Date.now()}.${click.fbclid}` : undefined
                            },
                            app_data: {
                                application_tracking_enabled: 1,
                                advertiser_tracking_enabled: 1
                            }
                        }],
                        access_token: click.fb_token
                    };

                    const postUrl = `https://graph.facebook.com/v18.0/${click.fb_id}/events?access_token=${click.fb_token}`;

                    const axiosResponse = await axios.post(postUrl, payload, {
                        timeout: 10000,
                        validateStatus: () => true
                    });

                    const eventsReceived = axiosResponse.data?.events_received || 0;

                    if (axiosResponse.status >= 200 && axiosResponse.status < 300 && eventsReceived > 0) {
                        sent++;
                        results.push({ click_id: click.click_id, status: 'ok', events_received: eventsReceived });
                    } else {
                        failed++;
                        results.push({
                            click_id: click.click_id,
                            status: 'rejected',
                            events_received: eventsReceived,
                            error: axiosResponse.data?.error?.message || `HTTP ${axiosResponse.status}`
                        });
                    }

                    // Small delay to avoid FB rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (err: any) {
                    failed++;
                    results.push({
                        click_id: click.click_id,
                        status: 'error',
                        error: err.message
                    });
                }
            }

            console.log(`📦 Bulk FB resend complete: ${sent} sent, ${failed} failed out of ${clicksResult.rows.length}`);

            res.json({
                success: true,
                message: `Масова відправка завершена: ${sent} успішно, ${failed} помилок`,
                total: clicksResult.rows.length,
                sent,
                failed,
                results
            });
        } catch (error: any) {
            console.error('Error in bulk FB resend:', error);
            res.status(500).json({ error: error.message || 'Failed to bulk resend' });
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
