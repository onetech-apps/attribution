import { Router, Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantMiddleware';
import { AppsFlyerEventsService } from '../services/appsflyerEventsService';
import { generateOsUserKey } from '../utils/helpers';

const router = Router();

/**
 * AppsFlyer attribution callback
 * Отримує дані атрибуції з iOS додатку після install
 */
router.post('/attribution/appsflyer', async (req: TenantRequest, res: Response) => {
    const {
        appsflyer_id,      // AppsFlyer Device ID
        customer_user_id,  // IDFV
        media_source,      // moloco, unity, tiktok, google
        campaign,
        af_sub1,           // Buyer ID
        af_sub2,           // Geo
        af_sub3,           // Creative
        af_sub4,           // Custom
        af_sub5            // Custom
    } = req.body;

    try {
        // Валідація
        if (!appsflyer_id || !customer_user_id) {
            res.status(400).json({ error: 'Missing required fields: appsflyer_id, customer_user_id' });
            return;
        }

        const osUserKey = generateOsUserKey(customer_user_id);
        const pushSub = af_sub1 || 'organic';

        // Використати unified Keitaro helper
        const { buildKeitaroUrl, extractAppsFlyerParams } = require('../utils/keitaroHelper');

        const keitaroParams = extractAppsFlyerParams(
            appsflyer_id,
            { media_source, campaign, af_sub1, af_sub2, af_sub3, af_sub4, af_sub5 },
            osUserKey,
            { app_version: req.body.app_version, idfv: customer_user_id }
        );

        const finalUrl = buildKeitaroUrl(keitaroParams, req.tenant);

        // Зберігаємо атрибуцію в БД
        await query(
            `INSERT INTO attributions 
             (os_user_key, app_id, attribution_source, click_id, appsflyer_id, 
              ip_address, user_agent, idfv, media_source, campaign, push_sub, final_url,
              af_sub1, af_sub2, af_sub3, af_sub4, af_sub5)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             ON CONFLICT (os_user_key) DO UPDATE SET
                appsflyer_id = EXCLUDED.appsflyer_id,
                media_source = EXCLUDED.media_source,
                campaign = EXCLUDED.campaign,
                push_sub = EXCLUDED.push_sub,
                final_url = EXCLUDED.final_url,
                af_sub1 = EXCLUDED.af_sub1,
                af_sub2 = EXCLUDED.af_sub2`,
            [
                osUserKey,
                req.tenant?.app_id || 'default',
                'appsflyer',
                appsflyer_id,              // click_id = appsflyer_id
                appsflyer_id,
                req.ip || 'unknown',
                req.get('user-agent') || 'unknown',
                customer_user_id,
                media_source || null,
                campaign || null,
                pushSub,
                finalUrl,
                af_sub1 || null,
                af_sub2 || null,
                af_sub3 || null,
                af_sub4 || null,
                af_sub5 || null
            ]
        );

        console.log('✅ AppsFlyer attribution saved:', {
            appsflyer_id: appsflyer_id.substring(0, 10) + '...',
            media_source,
            campaign,
            push_sub: pushSub
        });

        // Повернути final_url для iOS (як з Facebook)
        res.json({
            success: true,
            attributed: true,
            final_url: finalUrl,
            push_sub: pushSub,
            os_user_key: osUserKey,
            click_id: appsflyer_id,
            campaign_data: {
                appsflyer_id,
                media_source,
                campaign,
                sub1: af_sub1,
                sub2: af_sub2,
                sub3: af_sub3,
                sub4: af_sub4,
                sub5: af_sub5
            }
        });

    } catch (error) {
        console.error('❌ AppsFlyer attribution error:', error);
        res.status(500).json({ error: 'Failed to save attribution' });
    }
});

/**
 * AppsFlyer postback endpoint (з Keitaro)
 * Отримує GET запит з Keitaro та відправляє івент в AppsFlyer
 */
router.get('/postback/appsflyer', async (req: TenantRequest, res: Response) => {
    const {
        appsflyer_id,  // AppsFlyer Device ID (з click_id в Keitaro)
        idfv,          // IDFV користувача (з sub5 в Keitaro)
        event,         // 'registration' або 'deposit'
        amount,        // Сума депозиту
        currency       // Валюта
    } = req.query;

    try {
        // Валідація
        if (!appsflyer_id || !idfv || !event) {
            res.status(400).json({
                error: 'Missing required parameters: appsflyer_id, idfv, event'
            });
            return;
        }

        // Перевірка tenant
        if (!req.tenant) {
            res.status(400).json({ error: 'Tenant not found' });
            return;
        }

        // Перевірка чи AppsFlyer увімкнено для цього додатку
        if (!req.tenant.appsflyer_enabled || !req.tenant.appsflyer_dev_key) {
            res.status(400).json({
                error: 'AppsFlyer not enabled for this app'
            });
            return;
        }

        // Ініціалізуємо AppsFlyer service
        const afService = new AppsFlyerEventsService(
            req.tenant.appsflyer_dev_key,
            req.tenant.bundle_id
        );

        // Відправляємо івент в AppsFlyer
        if (event === 'registration') {
            await afService.sendRegistration(
                appsflyer_id as string,
                idfv as string
            );

            console.log('✅ AppsFlyer registration sent:', {
                appsflyer_id: (appsflyer_id as string).substring(0, 10) + '...',
                app: req.tenant.app_name
            });

        } else if (event === 'deposit') {
            if (!amount) {
                res.status(400).json({ error: 'Amount required for deposit event' });
                return;
            }

            await afService.sendDeposit(
                appsflyer_id as string,
                idfv as string,
                parseFloat(amount as string),
                (currency as string) || 'USD'
            );

            console.log('✅ AppsFlyer deposit sent:', {
                appsflyer_id: (appsflyer_id as string).substring(0, 10) + '...',
                amount,
                currency: currency || 'USD',
                app: req.tenant.app_name
            });

        } else {
            res.status(400).json({
                error: 'Invalid event type. Use: registration or deposit'
            });
            return;
        }

        res.json({
            success: true,
            message: `AppsFlyer ${event} event sent successfully`
        });

    } catch (error: any) {
        console.error('❌ AppsFlyer postback error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send event to AppsFlyer'
        });
    }
});

export default router;
