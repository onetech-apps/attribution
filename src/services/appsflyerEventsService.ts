import axios from 'axios';
import { eventLogger } from '../utils/eventLogger';

/**
 * AppsFlyer S2S Events API Service
 * Відправляє in-app події в AppsFlyer для передачі в рекламні мережі
 */
export class AppsFlyerEventsService {
    private devKey: string;
    private appId: string;
    private baseUrl: string = 'https://api2.appsflyer.com/inappevent';

    constructor(devKey: string, appId: string) {
        this.devKey = devKey;
        this.appId = appId;
    }

    /**
     * Відправити in-app event в AppsFlyer
     */
    async sendEvent(
        appsflyerId: string,
        idfv: string,
        eventName: string,
        eventValue?: Record<string, any>,
        clickId?: string
    ): Promise<void> {
        const url = `${this.baseUrl}/${this.appId}`;

        const payload = {
            appsflyer_id: appsflyerId,
            customer_user_id: idfv,
            eventName: eventName,
            eventValue: eventValue || {},
            eventTime: new Date().toISOString()
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'authentication': this.devKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log('✅ AppsFlyer S2S event sent:', {
                eventName,
                appsflyerId: appsflyerId.substring(0, 10) + '...',
                status: response.status
            });

            // Log successful outbound postback to AppsFlyer
            eventLogger.log('postback', `AppsFlyer Outbound: ${eventName}`, {
                click_id: clickId || appsflyerId, // Use clickId or appsflyerId
                url,
                method: 'POST',
                payload,
                response_status: response.status,
                response_body: response.data
            });

        } catch (error: any) {
            console.error('❌ AppsFlyer S2S error:', {
                eventName,
                error: error.response?.data || error.message
            });
            eventLogger.log('error', `AppsFlyer S2S Error: ${eventName}`, {
                appsflyer_id: appsflyerId,
                error: error.response?.data || error.message
            });

            // Log failed outbound postback to AppsFlyer
            eventLogger.log('postback', `AppsFlyer Outbound Failed: ${eventName}`, {
                click_id: clickId || appsflyerId,
                url,
                method: 'POST',
                payload,
                response_status: error.response?.status || 500,
                response_body: error.response?.data || error.message
            });
            throw new Error(`AppsFlyer API error: ${error.message}`);
        }
    }

    /**
     * Відправити івент реєстрації
     */
    async sendRegistration(appsflyerId: string, idfv: string): Promise<void> {
        await this.sendEvent(
            appsflyerId,
            idfv,
            'af_complete_registration',
            {
                af_content_id: 'registration',
                af_registration_method: 'email'
            }
        );
    }

    /**
     * Відправити івент депозиту (purchase)
     */
    async sendDeposit(
        appsflyerId: string,
        idfv: string,
        amount: number,
        currency: string = 'USD'
    ): Promise<void> {
        await this.sendEvent(
            appsflyerId,
            idfv,
            'af_purchase',
            {
                af_revenue: amount,
                af_currency: currency,
                af_content_id: 'deposit',
                af_content_type: 'first_deposit'
            }
        );
    }

    /**
     * Відправити кастомний івент
     */
    async sendCustomEvent(
        appsflyerId: string,
        idfv: string,
        eventName: string,
        eventValue?: Record<string, any>
    ): Promise<void> {
        await this.sendEvent(appsflyerId, idfv, eventName, eventValue);
    }
}

export default AppsFlyerEventsService;
