/**
 * Facebook Conversion API Service
 * Sends events to Facebook for attribution and optimization
 */

import axios from 'axios';
import { eventLogger } from '../utils/eventLogger';

interface FacebookEventParams {
    eventName: string; // APP_INSTALL, COMPLETE_REGISTRATION, PURCHASE
    pixelId: string;
    accessToken: string;
    fbclid: string;
    ip: string;
    userAgent: string;
    eventTime?: number;
    value?: number;    // Revenue amount (for PURCHASE events)
    currency?: string; // Currency code, e.g. 'USD' (for PURCHASE events)
    clickId?: string;  // For logging
}

export class FacebookConversionApi {
    /**
     * Send event to Facebook Conversion API
     */
    async sendEvent(params: FacebookEventParams): Promise<void> {
        if (!params.pixelId || !params.accessToken) {
            console.log('⚠️  No Facebook credentials, skipping event');
            return;
        }

        const url = `https://graph.facebook.com/v18.0/${params.pixelId}/events`;

        const eventData: Record<string, any> = {
            event_name: params.eventName,
            event_time: params.eventTime || Math.floor(Date.now() / 1000),
            action_source: 'website',
            event_source_url: 'https://' + (process.env.DOMAIN || 'onebuy.pro'),
            user_data: {
                client_ip_address: params.ip,
                client_user_agent: params.userAgent,
                fbc: params.fbclid ? `fb.1.${Date.now()}.${params.fbclid}` : undefined,
            }
        };

        // Add revenue data for PURCHASE events (required for ROAS optimization)
        if (params.value !== undefined && params.value > 0) {
            eventData.custom_data = {
                value: params.value,
                currency: params.currency || 'USD',
            };
        }

        try {
            const response = await axios.post(
                url,
                {
                    data: [eventData],
                    access_token: params.accessToken,
                },
                {
                    timeout: 5000,
                }
            );

            console.log('✅ Facebook event sent:', {
                event: params.eventName,
                pixel_id: params.pixelId,
                events_received: response.data.events_received,
            });

            // Log successful outbound postback
            eventLogger.log('postback', `FB Outbound: ${params.eventName}`, {
                click_id: params.clickId,
                url,
                method: 'POST',
                payload: { data: [eventData], access_token: params.accessToken },
                response_status: response.status,
                response_body: response.data
            });
        } catch (error: any) {
            console.error('❌ Facebook Conversion API error:', {
                event: params.eventName,
                error: error.response?.data || error.message,
            });
            eventLogger.log('error', `Facebook API Error: ${params.eventName}`, {
                pixel_id: params.pixelId,
                error: error.response?.data || error.message
            });

            // Log failed outbound postback too
            eventLogger.log('postback', `FB Outbound Failed: ${params.eventName}`, {
                click_id: params.clickId,
                url,
                method: 'POST',
                payload: { data: [eventData], access_token: params.accessToken },
                response_status: error.response?.status || 500,
                response_body: error.response?.data || error.message
            });
            // Don't throw - we don't want to fail attribution if FB API fails
        }
    }

    /**
     * Send APP_INSTALL event
     */
    async sendAppInstall(params: Omit<FacebookEventParams, 'eventName'>): Promise<void> {
        await this.sendEvent({
            ...params,
            eventName: 'APP_INSTALL',
        });
    }

    /**
     * Send COMPLETE_REGISTRATION event
     */
    async sendRegistration(params: Omit<FacebookEventParams, 'eventName'>): Promise<void> {
        await this.sendEvent({
            ...params,
            eventName: 'COMPLETE_REGISTRATION',
        });
    }

    /**
     * Send PURCHASE event
     */
    async sendPurchase(
        params: Omit<FacebookEventParams, 'eventName'>
    ): Promise<void> {
        await this.sendEvent({
            ...params,
            eventName: 'PURCHASE',
        });
    }
}

export default new FacebookConversionApi();
