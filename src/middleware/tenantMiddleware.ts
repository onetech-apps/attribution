import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export interface AppTenant {
    app_id: string;
    domain: string;
    team_id: string;  // Apple Developer Team ID
    bundle_id: string;
    app_name: string;
    api_key: string;
    app_store_url: string;
    keitaro_campaign_url?: string;  // Keitaro campaign URL

    // AppsFlyer
    appsflyer_dev_key?: string;
    appsflyer_enabled?: boolean;
}

export interface TenantRequest extends Request {
    tenant?: AppTenant;
}

/**
 * Tenant Middleware - визначає додаток по домену
 */
export async function tenantMiddleware(
    req: TenantRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const hostname = req.hostname;

        // Admin routes, postbacks don't need a specific tenant
        const skipPaths = ['/api/v1/admin', '/api/v1/postback', '/health'];
        if (skipPaths.some(p => req.path.startsWith(p))) {
            next();
            return;
        }

        // Знаходимо додаток по домену
        const result = await query(
            'SELECT * FROM apps WHERE domain = $1 AND active = TRUE',
            [hostname]
        );

        if (result.rows.length === 0) {
            // Використовуємо дефолтний тенант якщо домен не зареєстрований
            req.tenant = {
                app_id: 'default',
                domain: hostname,
                team_id: 'DEV123',
                bundle_id: 'com.default.app',
                app_name: 'Default App',
                api_key: process.env.API_SECRET_KEY || 'test_api_key_12345',
                app_store_url: process.env.APP_STORE_URL || '',
                appsflyer_dev_key: process.env.APPSFLYER_DEV_KEY || '',
                appsflyer_enabled: true,
            };
            next();
            return;
        }

        // Додаємо tenant до request
        req.tenant = result.rows[0] as AppTenant;

        next();
    } catch (error) {
        console.error('❌ Tenant middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
