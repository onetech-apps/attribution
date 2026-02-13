import crypto from 'crypto';

/**
 * Generate a unique click ID
 */
export const generateClickId = (): string => {
    return 'clk_' + crypto.randomBytes(16).toString('hex');
};

/**
 * Generate OS User Key from IDFV
 */
export const generateOsUserKey = (idfv: string): string => {
    return crypto.createHash('md5').update(idfv + process.env.API_SECRET_KEY).digest('hex');
};

/**
 * Generate unique API key
 */
export function generateApiKey(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(16).toString('hex');
    return `${timestamp}_${randomPart}`;
}

/**
 * Calculate User-Agent similarity score
 */
export const calculateUserAgentSimilarity = (ua1: string, ua2: string): number => {
    const ua1Lower = ua1.toLowerCase();
    const ua2Lower = ua2.toLowerCase();

    let score = 0;

    // Check for iOS
    if (ua1Lower.includes('iphone') && ua2Lower.includes('iphone')) {
        score += 0.5;
    } else if (ua1Lower.includes('ipad') && ua2Lower.includes('ipad')) {
        score += 0.5;
    }

    // Check for OS version similarity
    const osVersionRegex = /os (\d+)[_.](\d+)/i;
    const match1 = ua1Lower.match(osVersionRegex);
    const match2 = ua2Lower.match(osVersionRegex);

    if (match1 && match2) {
        if (match1[1] === match2[1]) {
            score += 0.3;
        }
    }

    // Check for similar device characteristics
    if (
        (ua1Lower.includes('mobile') && ua2Lower.includes('mobile')) ||
        (ua1Lower.includes('safari') && ua2Lower.includes('safari'))
    ) {
        score += 0.2;
    }

    return score;
};

/**
 * Parse User-Agent string to extract device info
 */
export const parseUserAgent = (userAgent: string): {
    os?: string;
    osVersion?: string;
    device?: string;
    browser?: string;
} => {
    const ua = userAgent.toLowerCase();
    const result: any = {};

    // Detect OS
    if (ua.includes('iphone')) {
        result.os = 'iOS';
        result.device = 'iPhone';
    } else if (ua.includes('ipad')) {
        result.os = 'iOS';
        result.device = 'iPad';
    }

    // Extract OS version
    const osVersionMatch = ua.match(/os (\d+)[_.](\d+)/);
    if (osVersionMatch) {
        result.osVersion = `${osVersionMatch[1]}.${osVersionMatch[2]}`;
    }

    // Detect browser
    if (ua.includes('safari')) {
        result.browser = 'Safari';
    } else if (ua.includes('chrome')) {
        result.browser = 'Chrome';
    }

    return result;
};
