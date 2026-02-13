import { query } from '../config/database';
import { config } from '../config';
import { ClickData, DeviceInfo } from '../types';
import { calculateUserAgentSimilarity } from '../utils/helpers';

export class AttributionService {
    /**
     * Find matching click for attribution
     */
    async findMatchingClick(deviceInfo: DeviceInfo): Promise<ClickData | null> {
        try {
            const windowHours = config.attribution.windowHours;
            const minSimilarity = config.attribution.minUserAgentSimilarity;

            // Get clicks from the last 24 hours with matching IP
            const result = await query(
                `SELECT * FROM clicks 
         WHERE ip_address = $1 
         AND created_at >= NOW() - INTERVAL '${windowHours} hours'
         AND created_at < NOW()
         AND attributed = false
         ORDER BY created_at DESC`,
                [deviceInfo.ip]
            );

            if (result.rows.length === 0) {
                return null;
            }

            // Find best match by User-Agent similarity
            let bestMatch: ClickData | null = null;
            let bestScore = 0;

            for (const click of result.rows) {
                const score = calculateUserAgentSimilarity(
                    click.user_agent,
                    deviceInfo.user_agent
                );

                if (score > bestScore && score >= minSimilarity) {
                    bestScore = score;
                    bestMatch = click;
                }
            }

            // Mark click as attributed
            if (bestMatch) {
                await query(
                    'UPDATE clicks SET attributed = true, attributed_at = NOW() WHERE click_id = $1',
                    [bestMatch.click_id]
                );
            }

            return bestMatch;
        } catch (error) {
            console.error('Error finding matching click:', error);
            throw error;
        }
    }

    /**
     * Check if attribution is suspicious (fraud detection)
     */
    async isSuspicious(click: ClickData, deviceInfo: DeviceInfo): Promise<boolean> {
        try {
            // Check time window (too fast = suspicious)
            const clickTime = new Date(click.created_at).getTime();
            const now = Date.now();
            const timeDiff = (now - clickTime) / 1000; // seconds

            if (timeDiff < 5) {
                console.warn('Suspicious: Attribution too fast', { timeDiff });
                return true;
            }

            // Check for too many attributions from same IP in last hour
            const result = await query(
                `SELECT COUNT(*) as count FROM attributions 
         WHERE ip_address = $1 
         AND created_at >= NOW() - INTERVAL '1 hour'`,
                [deviceInfo.ip]
            );

            const count = parseInt(result.rows[0].count, 10);
            if (count > 5) {
                console.warn('Suspicious: Too many attributions from same IP', { count, ip: deviceInfo.ip });
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking fraud:', error);
            return false;
        }
    }
}

export default new AttributionService();
