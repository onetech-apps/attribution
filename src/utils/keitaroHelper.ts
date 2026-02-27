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
        'https://onebuy.pro/2mMKVqHq';

    const urlParams = new URLSearchParams();

    // ===== Keitaro campaign parameters (matching macros exactly) =====

    // app_name = {app_name}
    if (tenant?.app_name) {
        urlParams.append('app_name', tenant.app_name);
    }

    // appsflyer_id = {appsflyer_id}
    if (params.click_id) {
        urlParams.append('appsflyer_id', params.click_id);
    }

    // customer_user_id = {customer_user_id}
    urlParams.append('customer_user_id', params.os_user_key);

    // source = {media_source}
    if (params.media_source) {
        urlParams.append('source', params.media_source);
    }

    // bundle = {bundle}
    const bundleValue = params.bundle || tenant?.bundle_id;
    if (bundleValue) {
        urlParams.append('bundle', bundleValue);
    }

    // campaign = {campaign}
    if (params.campaign) {
        urlParams.append('campaign', params.campaign);
    }

    // af_sub1 = {af_sub1}
    if (params.sub1) urlParams.append('af_sub1', params.sub1);

    // af_sub2 = {af_sub2}
    if (params.sub2) urlParams.append('af_sub2', params.sub2);

    // push_sub = {push_sub}
    if (params.push_sub) {
        urlParams.append('push_sub', params.push_sub);
    }

    // ===== Additional parameters =====

    // Sub parameters (for Keitaro internal routing)
    if (params.sub1) urlParams.append('sub1', params.sub1);
    if (params.sub2) urlParams.append('sub2', params.sub2);
    if (params.sub3) urlParams.append('sub3', params.sub3);
    if (params.sub4) urlParams.append('sub4', params.sub4);
    if (params.sub5) urlParams.append('sub5', params.sub5);
    if (params.sub6) urlParams.append('sub6', params.sub6);  // IDFV

    // Click ID & external ID (for postback routing)
    if (params.click_id) {
        urlParams.append('click_id', params.click_id);
        urlParams.append('external_id', params.click_id);
    }

    // OS User Key
    urlParams.append('os_user_key', params.os_user_key);

    // Push (alias)
    if (params.push_sub) {
        urlParams.append('push', params.push_sub);
    }

    // Facebook-specific
    if (params.fbclid) urlParams.append('fbclid', params.fbclid);
    if (params.adset) {
        urlParams.append('adset', params.adset);
        urlParams.append('sub_id_18', params.adset);
    }

    // App version
    if (params.app_version) urlParams.append('app_version', params.app_version);

    const finalUrl = `${baseUrl}?${urlParams.toString()}`;

    console.log('🔗 Built Keitaro URL:', {
        source: params.fbclid ? 'facebook' : params.media_source ? `appsflyer/${params.media_source}` : 'organic',
        app_name: tenant?.app_name || 'unknown',
        click_id: params.click_id?.substring(0, 10) + '...',
        push_sub: params.push_sub,
        bundle: bundleValue,
        campaign: params.campaign,
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
        media_source: click?.fbclid ? 'facebook' : undefined,  // source=facebook для FB кліків
        campaign: click?.sub1 || undefined,  // sub1 як назва кампанії
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
        sub6: conversionData.idfv || deviceInfo.idfv || undefined,
        push_sub: conversionData.af_sub1 || 'organic',
        os_user_key: osUserKey,
        media_source: conversionData.media_source || undefined,
        campaign: conversionData.campaign || undefined,
        bundle: deviceInfo.bundle || undefined,
        app_version: deviceInfo.app_version
    };
}
