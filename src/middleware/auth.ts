import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { eventLogger } from '../utils/eventLogger';

/**
 * Middleware to validate API key
 */
export const validateApiKey = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
            res.status(401).json({ error: 'API key required' });
            return;
        }

        // Check if API key exists in api_keys table OR apps table
        let result = await query(
            'SELECT * FROM api_keys WHERE api_key = $1 AND active = true',
            [apiKey]
        );

        // Fallback: check apps table (keys created via apps.html)
        if (result.rows.length === 0) {
            result = await query(
                'SELECT app_id as app_name, api_key, active FROM apps WHERE api_key = $1 AND active = true',
                [apiKey]
            );
        }

        if (result.rows.length === 0) {
            console.warn('⚠️ Invalid API key attempt:', apiKey.substring(0, 15) + '...');
            eventLogger.log('error', 'Authentication Failed: Invalid API Key', {
                api_key: apiKey.substring(0, 10) + '...',
                ip: req.ip,
                url: req.originalUrl
            });
            res.status(403).json({ error: 'Invalid API key' });
            return;
        }

        // Attach API key info to request
        (req as any).apiKey = result.rows[0];
        next();
    } catch (error) {
        console.error('API key validation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
