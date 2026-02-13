import Foundation

/// Attribution response from the server
public struct AttributionData: Codable {
    public let success: Bool
    public let attributed: Bool
    public let finalUrl: String?
    public let pushSub: String
    public let osUserKey: String
    public let clickId: String?
    public let campaignData: CampaignData?
    
    enum CodingKeys: String, CodingKey {
        case success
        case attributed
        case finalUrl = "final_url"
        case pushSub = "push_sub"
        case osUserKey = "os_user_key"
        case clickId = "click_id"
        case campaignData = "campaign_data"
    }
}

/// Campaign data from attribution
public struct CampaignData: Codable {
    // Facebook
    public let fbclid: String?
    public let adsetid: String?
    
    // AppsFlyer
    public let appsflyerId: String?
    public let mediaSource: String?
    public let campaign: String?
    
    // Unified subs (для обох джерел)
    public let sub1: String?
    public let sub2: String?
    public let sub3: String?
    public let sub4: String?
    public let sub5: String?
    
    enum CodingKeys: String, CodingKey {
        case fbclid
        case adsetid
        case appsflyerId = "appsflyer_id"
        case mediaSource = "media_source"
        case campaign
        case sub1, sub2, sub3, sub4, sub5
    }
}

/// Device information to send to attribution API
struct DeviceInfo: Codable {
    let userAgent: String
    let idfv: String
    let idfa: String?
    let appVersion: String
    let osVersion: String
    let deviceModel: String
    
    enum CodingKeys: String, CodingKey {
        case userAgent = "user_agent"
        case idfv
        case idfa
        case appVersion = "app_version"
        case osVersion = "os_version"
        case deviceModel = "device_model"
    }
}
