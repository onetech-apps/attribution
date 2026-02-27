import { Request, Response } from 'express';
import { query } from '../config/database';
import { DeviceInfo, AttributionResponse } from '../types';
import { generateOsUserKey } from '../utils/helpers';
import attributionService from '../services/attributionService';
import facebookApi from '../services/facebookConversionApi';
import { eventLogger } from '../utils/eventLogger';


export class AttributionController {
    /**
     * Fetch attribution data for iOS app
     * POST /api/v1/attribution
     */
    async fetchAttribution(req: Request, res: Response): Promise<void> {
        try {
            const deviceInfo: DeviceInfo = {
                ip: req.ip || req.socket?.remoteAddress || '',
                user_agent: req.body.user_agent || req.headers['user-agent'] || '',
                idfa: req.body.idfa,
                idfv: req.body.idfv,
                app_version: req.body.app_version,
                os_version: req.body.os_version,
                device_model: req.body.device_model,
            };

            // Validate required fields
            if (!deviceInfo.idfv) {
                res.status(400).json({ error: 'IDFV is required' });
                return;
            }

            // Check if this device already has attribution
            const existingAttribution = await query(
                'SELECT * FROM attributions WHERE idfv = $1',
                [deviceInfo.idfv]
            );

            if (existingAttribution.rows.length > 0) {
                const existing = existingAttribution.rows[0];
                const response: AttributionResponse = {
                    success: true,
                    attributed: !!existing.click_id,
                    final_url: existing.final_url,
                    push_sub: existing.push_sub,
                    os_user_key: existing.os_user_key,
                    click_id: existing.click_id,
                };

                console.log('✅ Returning existing attribution:', { os_user_key: existing.os_user_key });
                res.json(response);
                return;
            }

            // Find matching click
            const matchingClick = await attributionService.findMatchingClick(deviceInfo);

            // Check for fraud
            if (matchingClick) {
                const isSuspicious = await attributionService.isSuspicious(
                    matchingClick,
                    deviceInfo
                );
                if (isSuspicious) {
                    console.warn('⚠️ Suspicious attribution detected, treating as organic');
                }
            }

            // Generate OS User Key
            const osUserKey = generateOsUserKey(deviceInfo.idfv);

            // Determine push_sub
            const pushSub = matchingClick?.sub1 || 'organic';

            // Send Facebook event if we have fbclid and pixel credentials
            if (matchingClick?.fbclid && matchingClick?.fb_id) {
                console.log('📱 Sending Facebook APP_INSTALL event...');
                const facebookApi = (await import('../services/facebookConversionApi')).default;
                await facebookApi.sendAppInstall({
                    pixelId: matchingClick.fb_id,
                    accessToken: matchingClick.fb_token || '',
                    fbclid: matchingClick.fbclid,
                    ip: deviceInfo.ip,
                    userAgent: deviceInfo.user_agent,
                    clickId: matchingClick.click_id
                });
            }

            // Build Keitaro campaign URL as final_url
            const finalUrl = this.buildKeitaroCampaignUrl(matchingClick, osUserKey, pushSub, deviceInfo, (req as any).tenant);

            // Save attribution
            await query(
                `INSERT INTO attributions 
        (click_id, os_user_key, app_id, ip_address, user_agent, idfa, idfv, device_model, os_version, app_version, push_sub, final_url, attribution_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    matchingClick?.click_id || null,
                    osUserKey,
                    (req as any).tenant?.app_id || 'default',
                    deviceInfo.ip,
                    deviceInfo.user_agent,
                    deviceInfo.idfa || null,
                    deviceInfo.idfv,
                    deviceInfo.device_model,
                    deviceInfo.os_version,
                    deviceInfo.app_version,
                    pushSub,
                    finalUrl,
                    'facebook'
                ]
            );

            // Build response
            const response: AttributionResponse = {
                success: true,
                attributed: !!matchingClick,
                final_url: finalUrl || undefined,
                push_sub: pushSub,
                os_user_key: osUserKey,
                click_id: matchingClick?.click_id,
                campaign_data: matchingClick
                    ? {
                        fbclid: matchingClick.fbclid,
                        sub1: matchingClick.sub1,
                        sub2: matchingClick.sub2,
                        sub3: matchingClick.sub3,
                        adsetid: matchingClick.adsetid,
                    }
                    : undefined,
            };

            console.log('✅ Attribution completed:', {
                attributed: response.attributed,
                os_user_key: osUserKey,
                push_sub: pushSub,
            });

            eventLogger.log('attribution', `Attribution request: ${response.attributed ? 'MATCHED' : 'ORGANIC'}`, {
                idfv: deviceInfo.idfv,
                click_id: matchingClick?.click_id,
                push_sub: pushSub,
                final_url: finalUrl
            });

            res.json(response);
        } catch (error: any) {
            console.error('Error in attribution:', error?.message || error);
            eventLogger.log('error', `Attribution failed: ${error?.message || 'Unknown error'}`);
            res.status(500).json({ error: 'Failed to process attribution' });
        }
    }

    /**
     * Build Keitaro campaign URL with all parameters
     * This URL will be opened by iOS app, and Keitaro will redirect to actual offer
     */
    private buildKeitaroCampaignUrl(
        matchingClick: any,
        osUserKey: string,
        pushSub: string,
        deviceInfo: DeviceInfo,
        tenant?: any
    ): string | null {
        // Use unified Keitaro helper
        const { buildKeitaroUrl, extractFacebookParams } = require('../utils/keitaroHelper');

        const params = extractFacebookParams(matchingClick, osUserKey, deviceInfo);
        return buildKeitaroUrl(params, tenant);
    }

    /**
     * Get attribution statistics
     * GET /api/v1/attribution/stats
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const totalAttributions = await query('SELECT COUNT(*) as count FROM attributions');
            const attributedInstalls = await query(
                'SELECT COUNT(*) as count FROM attributions WHERE click_id IS NOT NULL'
            );
            const organicInstalls = await query(
                'SELECT COUNT(*) as count FROM attributions WHERE click_id IS NULL'
            );

            res.json({
                total_attributions: parseInt(totalAttributions.rows[0].count, 10),
                attributed_installs: parseInt(attributedInstalls.rows[0].count, 10),
                organic_installs: parseInt(organicInstalls.rows[0].count, 10),
                attribution_rate:
                    (parseInt(attributedInstalls.rows[0].count, 10) /
                        parseInt(totalAttributions.rows[0].count, 10)) *
                    100,
            });
        } catch (error) {
            console.error('Error getting attribution stats:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    }
}

export default new AttributionController();
