import dotenv from 'dotenv';

dotenv.config();

export const config = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        env: process.env.NODE_ENV || 'development',
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'attribution_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
    },
    security: {
        apiSecretKey: process.env.API_SECRET_KEY || 'change_this_in_production',
    },
    attribution: {
        windowHours: parseInt(process.env.ATTRIBUTION_WINDOW_HOURS || '24', 10),
        minUserAgentSimilarity: parseFloat(process.env.MIN_USER_AGENT_SIMILARITY || '0.7'),
    },
};
