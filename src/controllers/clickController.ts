import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateClickId } from '../utils/helpers';
import { TenantRequest } from '../middleware/tenantMiddleware';
import { eventLogger } from '../utils/eventLogger';

// Very basic in-memory debounce cache to prevent rapid double-clicks from same IP
const clickDebounceCache = new Map<string, number>();
const CLICK_DEBOUNCE_MS = 2000; // 2 seconds
export class ClickController {
    /**
     * Track advertising click
     * Supports multiple URL formats: /api/v1/track/click, /t, /click, /track, /
     */
    async trackClick(req: TenantRequest, res: Response): Promise<void> {
        try {
            const params = req.query;
            const tenant = req.tenant;

            if (!tenant) {
                res.status(400).json({ error: 'Tenant not configured' });
                return;
            }

            const clickId = generateClickId();
            const ipAddress = req.ip || req.connection.remoteAddress || '';
            const userAgent = req.headers['user-agent'] || '';

            // Debounce check: Prevent duplicate clicks from the same IP within 2 seconds
            const now = Date.now();
            const lastClickTime = clickDebounceCache.get(ipAddress);
            if (lastClickTime && (now - lastClickTime) < CLICK_DEBOUNCE_MS) {
                console.log(`⏳ Ignored duplicate click from ${ipAddress} (too fast)`);
                // Still redirect the user so their experience isn't broken
                const appStoreUrl = tenant?.app_store_url || process.env.APP_STORE_URL || 'https://apps.apple.com';
                res.redirect(302, appStoreUrl);
                return;
            }
            // Update cache
            clickDebounceCache.set(ipAddress, now);

            // Clean up tracking macros that weren't replaced by the ad network (e.g., '{{fbclid}}')
            const cleanParam = (val: any) => {
                if (!val) return null;
                if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) return null;
                return val;
            };

            const fbclid = cleanParam(params.fbclid);
            const sub1 = cleanParam(params.sub1);
            const sub2 = cleanParam(params.sub2);
            const sub3 = cleanParam(params.sub3);
            const sub4 = cleanParam(params.sub4);
            const sub5 = cleanParam(params.sub5);
            const adsetid = cleanParam(params.adsetid);
            const fb_id = cleanParam(params.fb_id);
            const fb_token = cleanParam(params.fb_token);

            // Save click to database with app_id
            await query(
                `INSERT INTO clicks 
        (click_id, app_id, ip_address, user_agent, fbclid, sub1, sub2, sub3, sub4, sub5, adsetid, fb_id, fb_token)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    clickId,
                    tenant?.app_id || 'default',  // Multi-tenant: app_id
                    ipAddress,
                    userAgent,
                    fbclid,
                    sub1,
                    sub2,
                    sub3,
                    sub4,
                    sub5,
                    adsetid,
                    fb_id,
                    fb_token,
                ]
            );

            console.log('✅ Click tracked:', {
                clickId,
                app: tenant?.app_name || 'default',
                ipAddress,
                sub1: params.sub1,
                sub2: params.sub2,
                has_fb_pixel: !!params.fb_id
            });

            eventLogger.log('click', `New click: ${params.sub1 || 'unknown_campaign'}`, {
                clickId,
                sub1: sub1,
                source: sub2,
                ip: ipAddress,
                app: tenant?.app_name
            });

            // Redirect to App Store (tenant-specific or default)
            const appStoreUrl = tenant?.app_store_url || process.env.APP_STORE_URL || 'https://apps.apple.com';

            if (!tenant?.app_store_url) {
                console.warn('⚠️ No app_store_url for tenant! Using fallback:', appStoreUrl,
                    '| Tenant:', tenant?.app_name || 'NONE',
                    '| Domain:', req.hostname);
            }

            console.log('🔄 Redirecting to App Store:', appStoreUrl);
            res.redirect(302, appStoreUrl);
        } catch (error: any) {
            console.error('Error tracking click:', error);
            eventLogger.log('error', `Click tracking failed: ${error?.message || 'Unknown error'}`);
            res.status(500).json({ error: 'Failed to track click' });
        }
    }

    /**
     * Build Keitaro campaign URL with all parameters
     */
    private buildKeitaroUrl(params: any, clickId: string): string {
        const baseUrl = process.env.KEITARO_CAMPAIGN_URL || 'https://onebuy.pro/2mMKVqHq';

        // Build query parameters for Keitaro
        const queryParams = new URLSearchParams();

        // Add all parameters that Keitaro expects
        queryParams.append('external_id', clickId);

        if (params.sub1) queryParams.append('sub1', params.sub1 as string);
        if (params.sub2) queryParams.append('sub2', params.sub2 as string);
        if (params.sub3) queryParams.append('sub3', params.sub3 as string);
        if (params.sub4) queryParams.append('sub4', params.sub4 as string);
        if (params.sub5) queryParams.append('sub5', params.sub5 as string);
        if (params.sub6) queryParams.append('sub6', params.sub6 as string);

        if (params.fbclid) queryParams.append('fbclid', params.fbclid as string);
        if (params.adsetid) queryParams.append('adset', params.adsetid as string);
        if (params.source) queryParams.append('source', params.source as string);
        if (params.campaign) queryParams.append('campaign', params.campaign as string);
        if (params.adgroup) queryParams.append('adgroup', params.adgroup as string);

        // Add any other parameters from the original request
        for (const [key, value] of Object.entries(params)) {
            if (!queryParams.has(key) && value) {
                queryParams.append(key, value as string);
            }
        }

        return `${baseUrl}?${queryParams.toString()}`;
    }

    /**
     * Get click statistics (for admin/debugging)
     * GET /api/v1/clicks/stats
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const totalClicks = await query('SELECT COUNT(*) as count FROM clicks');
            const attributedClicks = await query(
                'SELECT COUNT(*) as count FROM clicks WHERE attributed = true'
            );
            const last24h = await query(
                `SELECT COUNT(*) as count FROM clicks 
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
            );

            res.json({
                total_clicks: parseInt(totalClicks.rows[0].count, 10),
                attributed_clicks: parseInt(attributedClicks.rows[0].count, 10),
                clicks_last_24h: parseInt(last24h.rows[0].count, 10),
                attribution_rate:
                    (parseInt(attributedClicks.rows[0].count, 10) /
                        parseInt(totalClicks.rows[0].count, 10)) *
                    100,
            });
        } catch (error) {
            console.error('Error getting stats:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    }
}

export default new ClickController();
