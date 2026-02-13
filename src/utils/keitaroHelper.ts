import { AppTenant } from '../middleware/tenantMiddleware';

/**
 * Unified parameters for Keitaro URL building
 * Works for both Facebook and AppsFlyer attribution sources
 */
export interface KeitaroParams {
    // Unified parameters (для обох джерел)
    click_id?: string;           // clicks.click_id для FB, appsflyer_id для AppsFlyer
    sub1?: string;               // clicks.sub1 або af_sub1
    sub2?: string;               // clicks.sub2 або af_sub2
    sub3?: string;               // clicks.sub3 або af_sub3
    sub4?: string;               // clicks.sub4 або af_sub4
    sub5?: string;               // clicks.sub5 або af_sub5
    sub6?: string;               // IDFV пристрою (для AppsFlyer postback)
    push_sub?: string;           // sub1 або af_sub1, або 'organic'
    os_user_key: string;         // hash(IDFV) - завжди є

    // Facebook-specific
    fbclid?: string;             // Facebook Click ID
    adset?: string;              // Facebook Ad Set ID

    // AppsFlyer-specific
    media_source?: string;       // moloco, unity, tiktok, google
    campaign?: string;           // Назва кампанії

    // Device info
    bundle?: string;             // Bundle ID
    app_version?: string;        // Версія додатку
}

/**
 * Build Keitaro campaign URL with all parameters
 * Unified builder for both Facebook and AppsFlyer
 * 
 * @param params - Unified parameters
 * @param tenant - App tenant configuration
 * @returns Full Keitaro URL with all parameters
 */
export function buildKeitaroUrl(params: KeitaroParams, tenant?: AppTenant): string {
    // Get base URL from tenant or environment
    const baseUrl = tenant?.keitaro_campaign_url ||
        process.env.KEITARO_CAMPAIGN_URL ||
        'https://onebuy.pro/LNCKRd7L';

    const urlParams = new URLSearchParams();

    // ===== Unified parameters (для обох джерел) =====

    // Click ID (для postback)
    if (params.click_id) {
        urlParams.append('click_id', params.click_id);
        urlParams.append('external_id', params.click_id);  // Alias для Keitaro
    }

    // Sub parameters (buyer ID, geo, creative, etc.)
    if (params.sub1) urlParams.append('sub1', params.sub1);
    if (params.sub2) urlParams.append('sub2', params.sub2);
    if (params.sub3) urlParams.append('sub3', params.sub3);
    if (params.sub4) urlParams.append('sub4', params.sub4);
    if (params.sub5) urlParams.append('sub5', params.sub5);
    if (params.sub6) urlParams.append('sub6', params.sub6);  // IDFV для AppsFlyer postback

    // Push sub (для push notifications)
    if (params.push_sub) {
        urlParams.append('push', params.push_sub);
        urlParams.append('push_sub', params.push_sub);  // Alias
    }

    // OS User Key (унікальний ключ користувача)
    urlParams.append('os_user_key', params.os_user_key);
    urlParams.append('af_userid', params.os_user_key);  // Alias для сумісності

    // ===== Facebook-specific parameters =====

    if (params.fbclid) {
        urlParams.append('fbclid', params.fbclid);
    }

    if (params.adset) {
        urlParams.append('adset', params.adset);
    }

    // ===== AppsFlyer-specific parameters =====

    if (params.media_source) {
        urlParams.append('media_source', params.media_source);
        urlParams.append('source', params.media_source);  // Alias
    }

    if (params.campaign) {
        urlParams.append('campaign', params.campaign);
    }

    // ===== Device info =====

    if (params.bundle) {
        urlParams.append('bundle', params.bundle);
    }

    if (params.app_version) {
        urlParams.append('app_version', params.app_version);
    }

    // Bundle ID з tenant
    if (tenant?.bundle_id) {
        urlParams.append('bundle_id', tenant.bundle_id);
    }

    const finalUrl = `${baseUrl}?${urlParams.toString()}`;

    console.log('🔗 Built Keitaro URL:', {
        source: params.fbclid ? 'facebook' : params.media_source ? 'appsflyer' : 'unknown',
        click_id: params.click_id?.substring(0, 10) + '...',
        push_sub: params.push_sub,
        url_length: finalUrl.length
    });

    return finalUrl;
}

/**
 * Extract Keitaro params from Facebook click
 */
export function extractFacebookParams(click: any, osUserKey: string, deviceInfo: any): KeitaroParams {
    return {
        click_id: click?.click_id || undefined,
        sub1: click?.sub1 || undefined,
        sub2: click?.sub2 || undefined,
        sub3: click?.sub3 || undefined,
        sub4: click?.sub4 || undefined,
        sub5: click?.sub5 || undefined,
        sub6: deviceInfo.idfv || undefined,  // IDFV в sub6
        push_sub: click?.sub1 || 'organic',
        os_user_key: osUserKey,
        fbclid: click?.fbclid || undefined,
        adset: click?.adsetid || undefined,
        bundle: deviceInfo.bundle,
        app_version: deviceInfo.app_version
    };
}

/**
 * Extract Keitaro params from AppsFlyer attribution
 */
export function extractAppsFlyerParams(
    appsflyerId: string,
    conversionData: any,
    osUserKey: string,
    deviceInfo: any
): KeitaroParams {
    return {
        click_id: appsflyerId,
        sub1: conversionData.af_sub1 || undefined,
        sub2: conversionData.af_sub2 || undefined,
        sub3: conversionData.af_sub3 || undefined,
        sub4: conversionData.af_sub4 || undefined,
        sub5: conversionData.af_sub5 || undefined,
        sub6: conversionData.idfv || deviceInfo.idfv || undefined,  // IDFV в sub6
        push_sub: conversionData.af_sub1 || 'organic',
        os_user_key: osUserKey,
        media_source: conversionData.media_source || undefined,
        campaign: conversionData.campaign || undefined,
        bundle: deviceInfo.bundle,
        app_version: deviceInfo.app_version
    };
}
