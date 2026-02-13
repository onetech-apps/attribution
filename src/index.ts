import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { initDatabase } from './config/database';
import { tenantMiddleware } from './middleware/tenantMiddleware';
import clickRoutes from './routes/clickRoutes';
import attributionRoutes from './routes/attributionRoutes';
import postbackRoutes from './routes/postbackRoutes';
import adminRoutes from './routes/adminRoutes';
import appRoutes from './routes/appRoutes';
import appleRoutes from './routes/appleRoutes';
import appsflyerRoutes from './routes/appsflyerRoutes';
import path from 'path';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (dashboard) - before tenant middleware
app.use(express.static(path.join(__dirname, '../public')));

// Trust proxy for correct IP detection
app.set('trust proxy', true);

// Health check endpoint (before tenant middleware)
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Multi-tenant middleware (detect app by domain)
app.use(tenantMiddleware);

// Apple App Site Association (must be before other routes)
app.use(appleRoutes);

// API routes
app.use(clickRoutes);  // Includes /api/v1/track/click, /t, /click, /
app.use('/api/v1', attributionRoutes);
app.use('/api/v1', postbackRoutes);
app.use('/api/v1', adminRoutes);
app.use('/api/v1', appRoutes);
app.use('/api/v1', appsflyerRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const startServer = async () => {
    try {
        console.log('🚀 Starting Attribution System...');

        // Initialize database tables
        await initDatabase();

        // Start server
        const PORT = config.server.port;
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📊 Environment: ${config.server.env}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`📍 Click tracking: http://localhost:${PORT}/api/v1/track/click`);
            console.log(`🎯 Attribution API: http://localhost:${PORT}/api/v1/attribution`);
            console.log(`📥 Postback API: http://localhost:${PORT}/api/v1/postback`);
            console.log(`📊 Admin Dashboard: http://localhost:${PORT}/dashboard.html`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Prevent silent crashes
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
});

export default app;
