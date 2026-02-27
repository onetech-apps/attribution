// Type definitions for attribution system

export interface ClickData {
    click_id: string;
    ip_address: string;
    user_agent: string;
    fbclid?: string;
    sub1?: string;
    sub2?: string;
    sub3?: string;
    sub4?: string;
    sub5?: string;
    adsetid?: string;
    final_url?: string;
    fb_id?: string; // Facebook Pixel ID
    fb_token?: string; // Facebook Access Token
    attributed: boolean;
    attributed_at?: Date;
    created_at: Date;
}

export interface DeviceInfo {
    ip: string;
    user_agent: string;
    idfa?: string;
    idfv: string;
    app_version: string;
    os_version: string;
    device_model: string;
    bundle?: string; // App bundle identifier
}

export interface AttributionData {
    id?: number;
    click_id?: string;
    os_user_key: string;
    ip_address: string;
    user_agent: string;
    idfa?: string;
    idfv: string;
    device_model: string;
    os_version: string;
    app_version: string;
    push_sub: string;
    final_url?: string;
    created_at?: Date;
}

export interface AttributionResponse {
    success: boolean;
    attributed: boolean;
    final_url?: string;
    push_sub: string;
    os_user_key: string;
    click_id?: string;
    campaign_data?: {
        fbclid?: string;
        sub1?: string;
        sub2?: string;
        sub3?: string;
        adsetid?: string;
    };
}

export interface ApiKey {
    id?: number;
    app_name: string;
    api_key: string;
    active: boolean;
    created_at?: Date;
}
