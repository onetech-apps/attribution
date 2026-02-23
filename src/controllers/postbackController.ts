import { Request, Response } from 'express';
import { query } from '../config/database';
import facebookApi from '../services/facebookConversionApi';
import { eventLogger } from '../utils/eventLogger';


export class PostbackController {
    /**
     * Handle postback from offer (via Keitaro)
     * GET /api/v1/postback?subid={click_id}&status={lead|sale}
     */
    async handlePostback(req: Request, res: Response): Promise<void> {
        try {
            const { subid, status, amount, currency } = req.query;

            if (!subid) {
                res.status(400).json({ error: 'Missing subid parameter' });
                return;
            }

            if (!status) {
                res.status(400).json({ error: 'Missing status parameter' });
                return;
            }

            console.log('📥 Postback received:', { subid, status, amount: amount || 'n/a', currency: currency || 'n/a' });

            // Find click by click_id (subid = external_id = click_id)
            const clickResult = await query(
                'SELECT * FROM clicks WHERE click_id = $1',
                [subid]
            );

            if (clickResult.rows.length === 0) {
                console.warn('⚠️  Click not found for subid:', subid);

                const responseBody = {
                    error: `Клік не знайдено за ID: ${(subid as string).substring(0, 20)}...`,
                    click_id: subid,
                    status
                };

                eventLogger.log('postback', `Postback ignored: Click not found`, {
                    click_id: subid,
                    url: req.originalUrl,
                    method: req.method,
                    payload: req.query,
                    response_status: 404,
                    response_body: responseBody
                });

                res.status(404).json(responseBody);
                return;
            }

            const click = clickResult.rows[0];

            // Check if we have Facebook credentials
            if (!click.fbclid || !click.fb_id || !click.fb_token) {
                console.log('⚠️  No Facebook credentials for this click, skipping FB event');

                const responseBody = {
                    success: true,
                    message: `Постбек отримано (статус: ${status}). Клік знайдено, але немає FB Pixel — подію у Facebook не відправлено.`,
                    click_id: subid,
                    status,
                    click_found: true,
                    fb_tracking: false,
                    fb_reason: !click.fbclid ? 'Немає fbclid' : !click.fb_id ? 'Немає FB Pixel ID' : 'Немає FB Token'
                };

                eventLogger.log('postback', `Postback: ${status} (no FB)`, {
                    click_id: subid,
                    url: req.originalUrl,
                    method: req.method,
                    payload: req.query,
                    response_status: 200,
                    response_body: responseBody
                });

                res.json(responseBody);
                return;
            }

            // Common Facebook event params
            const fbParams = {
                pixelId: click.fb_id,
                accessToken: click.fb_token,
                fbclid: click.fbclid,
                ip: click.ip_address,
                userAgent: click.user_agent,
            };

            let eventName: string;

            switch (status) {
                case 'lead':
                    eventName = 'COMPLETE_REGISTRATION';
                    await facebookApi.sendRegistration(fbParams);
                    break;
                case 'sale':
                    eventName = 'PURCHASE';
                    // Parse revenue data from Keitaro postback
                    const purchaseValue = amount ? parseFloat(amount as string) : undefined;
                    const purchaseCurrency = (currency as string) || 'USD';
                    await facebookApi.sendPurchase({
                        ...fbParams,
                        value: purchaseValue,
                        currency: purchaseCurrency,
                    });
                    console.log(`💰 Revenue data: ${purchaseValue} ${purchaseCurrency}`);
                    break;
                default:
                    console.warn('⚠️  Unknown status:', status);
                    res.status(400).json({ error: 'Invalid status. Use: lead or sale' });
                    return;
            }

            console.log(`✅ Facebook ${eventName} event sent for subid: ${subid}`);

            eventLogger.log('postback', `Postback: ${status} (${eventName})`, {
                click_id: subid,
                url: req.originalUrl,
                method: req.method,
                payload: req.query,
                response_status: 200,
                response_body: { success: true, message: `${eventName} sent`, subid, status, amount, currency }
            });

            res.json({
                success: true,
                message: `${eventName} event sent to Facebook`,
                subid,
                status,
                ...(amount ? { revenue: parseFloat(amount as string), currency: currency || 'USD' } : {}),
            });
        } catch (error: any) {
            console.error('Error handling postback:', error);

            eventLogger.log('error', `Postback failed: ${error?.message || 'Unknown error'}`, {
                stack: error?.stack,
                metadata: { query: req.query, url: req.originalUrl }
            });

            // Also log the failed postback attempt
            eventLogger.log('postback', `Postback Failed: ${req.query.status || 'unknown'}`, {
                click_id: req.query.subid,
                url: req.originalUrl,
                method: req.method,
                payload: req.query,
                response_status: 500,
                response_body: { error: error?.message }
            });

            res.status(500).json({ error: 'Failed to process postback' });
        }
    }

    /**
     * Get postback statistics (for debugging)
     * GET /api/v1/postback/stats
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            // This would require a postbacks table to track
            // For now, just return a placeholder
            res.json({
                message: 'Postback stats not implemented yet',
                note: 'Events are sent directly to Facebook without storing',
            });
        } catch (error) {
            console.error('Error getting postback stats:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    }
}

export default new PostbackController();
