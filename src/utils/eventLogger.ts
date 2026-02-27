import { query } from '../config/database';

export interface LogEvent {
    id: string;
    timestamp: number;
    type: 'click' | 'attribution' | 'postback' | 'error' | 'system';
    summary: string;
    details?: any;
}

class EventLogger {
    private events: LogEvent[] = [];
    private readonly MAX_EVENTS = 200;

    log(type: LogEvent['type'], summary: string, details?: any) {
        const event: LogEvent = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            type,
            summary,
            details
        };

        this.events.unshift(event);

        if (this.events.length > this.MAX_EVENTS) {
            this.events = this.events.slice(0, this.MAX_EVENTS);
        }

        // Also log to console for persistence in standard logs
        if (type === 'error') {
            console.error(`[${type.toUpperCase()}] ${summary}`, details || '');
            this.logErrorToDb(summary, details);
        } else {
            console.log(`[${type.toUpperCase()}] ${summary}`);
            if (type === 'postback') {
                this.logPostbackToDb(details);
            }
        }
    }

    private async logPostbackToDb(details: any) {
        try {
            if (!details) return;
            const { click_id, url, method, payload, response_status, response_body } = details;

            await query(
                `INSERT INTO postback_logs (click_id, url, method, payload, response_status, response_body) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    click_id || null,
                    url || '',
                    method || 'GET',
                    JSON.stringify(payload || {}),
                    response_status || 0,
                    typeof response_body === 'string' ? response_body : JSON.stringify(response_body || '')
                ]
            );
        } catch (err) {
            console.error('Failed to log postback to DB:', err);
        }
    }

    private async logErrorToDb(message: string, details: any) {
        try {
            const stack = details?.stack || (details instanceof Error ? details.stack : '');
            const metadata = JSON.stringify(details || {});

            await query(
                `INSERT INTO error_logs (type, message, stack, metadata) 
                 VALUES ($1, $2, $3, $4)`,
                ['general', message, stack, metadata]
            );
        } catch (err) {
            console.error('Failed to log error to DB:', err);
        }
    }

    getEvents(since?: number): LogEvent[] {
        if (!since) {
            return this.events;
        }
        return this.events.filter(e => e.timestamp > since);
    }

    clear() {
        this.events = [];
    }
}

export const eventLogger = new EventLogger();
