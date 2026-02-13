import Foundation
import AppsFlyerLib
#if canImport(UIKit)
import UIKit
#endif

/// Main Attribution SDK class
/// Handles both Facebook (server-side) and AppsFlyer attribution
public class AttributionSDK: NSObject {
    
    /// Shared singleton instance
    public static let shared = AttributionSDK()
    
    private var apiKey: String?
    private var baseURL: String?
    private var cachedAttribution: AttributionData?
    
    // AppsFlyer config
    private var appsFlyerDevKey: String?
    private var appleAppID: String?
    private var appsFlyerEnabled = false
    
    /// Callback for AppsFlyer attribution result
    public var onAppsFlyerAttribution: ((Result<AttributionData, AttributionError>) -> Void)?
    
    private override init() {
        super.init()
    }
    
    // MARK: - Configuration
    
    /// Configure the SDK for Facebook-only attribution
    /// - Parameters:
    ///   - apiKey: Your API key from the attribution server
    ///   - baseURL: Base URL of your attribution server (e.g., "https://clovermaiden.store")
    public static func configure(apiKey: String, baseURL: String) {
        shared.apiKey = apiKey
        shared.baseURL = baseURL
    }
    
    /// Configure the SDK with AppsFlyer support
    /// - Parameters:
    ///   - apiKey: Your API key from the attribution server
    ///   - baseURL: Base URL of your attribution server
    ///   - appsFlyerDevKey: AppsFlyer Developer Key (from AppsFlyer dashboard)
    ///   - appleAppID: Apple App ID (numeric, e.g., "123456789")
    public static func configure(
        apiKey: String,
        baseURL: String,
        appsFlyerDevKey: String,
        appleAppID: String
    ) {
        shared.apiKey = apiKey
        shared.baseURL = baseURL
        shared.appsFlyerDevKey = appsFlyerDevKey
        shared.appleAppID = appleAppID
        shared.appsFlyerEnabled = true
        
        // Initialize AppsFlyer SDK
        shared.initAppsFlyer(devKey: appsFlyerDevKey, appID: appleAppID)
    }
    
    /// Whether AppsFlyer is enabled
    public var isAppsFlyerEnabled: Bool {
        return appsFlyerEnabled
    }
    
    // MARK: - AppsFlyer SDK Init
    
    private func initAppsFlyer(devKey: String, appID: String) {
        AppsFlyerLib.shared().appsFlyerDevKey = devKey
        AppsFlyerLib.shared().appleAppID = appID
        AppsFlyerLib.shared().delegate = self
        
        // Set IDFV as customer user ID for cross-reference
        #if canImport(UIKit)
        AppsFlyerLib.shared().customerUserID = UIDevice.current.identifierForVendor?.uuidString
        #endif
        
        // Debug mode in development
        #if DEBUG
        AppsFlyerLib.shared().isDebug = true
        #endif
        
        print("✅ AppsFlyer SDK initialized: devKey=\(devKey.prefix(6))..., appID=\(appID)")
    }
    
    /// Call this from applicationDidBecomeActive or sceneDidBecomeActive
    /// Starts AppsFlyer SDK tracking
    public func startAppsFlyer() {
        guard appsFlyerEnabled else { return }
        AppsFlyerLib.shared().start()
        print("📱 AppsFlyer SDK started")
    }
    
    // MARK: - Facebook Attribution (Server-Side)
    
    /// Fetch attribution data from the server (Facebook flow)
    /// - Parameter completion: Completion handler with Result<AttributionData, AttributionError>
    public func fetchAttribution(completion: @escaping (Result<AttributionData, AttributionError>) -> Void) {
        // Check if already cached
        if let cached = cachedAttribution {
            completion(.success(cached))
            return
        }
        
        // Validate configuration
        guard let apiKey = apiKey, let baseURL = baseURL else {
            completion(.failure(.notConfigured))
            return
        }
        
        // Collect device info
        let deviceInfo = DeviceInfoCollector.collectDeviceInfo()
        
        // Send request
        sendAttributionRequest(
            baseURL: baseURL,
            apiKey: apiKey,
            deviceInfo: deviceInfo,
            completion: completion
        )
    }
    
    /// Send attribution request to server
    private func sendAttributionRequest(
        baseURL: String,
        apiKey: String,
        deviceInfo: DeviceInfo,
        completion: @escaping (Result<AttributionData, AttributionError>) -> Void
    ) {
        // Build URL
        guard let url = URL(string: "\(baseURL)/api/v1/attribution") else {
            completion(.failure(.invalidURL))
            return
        }
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Encode body
        do {
            let encoder = JSONEncoder()
            request.httpBody = try encoder.encode(deviceInfo)
        } catch {
            completion(.failure(.decodingError(error)))
            return
        }
        
        // Send request
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            // Handle network error
            if let error = error {
                completion(.failure(.networkError(error)))
                return
            }
            
            // Check response
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(.invalidResponse))
                return
            }
            
            // Check status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMessage = String(data: data ?? Data(), encoding: .utf8) ?? "Unknown error"
                completion(.failure(.serverError(errorMessage)))
                return
            }
            
            // Check data
            guard let data = data else {
                completion(.failure(.noData))
                return
            }
            
            // Decode response
            do {
                let decoder = JSONDecoder()
                let attribution = try decoder.decode(AttributionData.self, from: data)
                
                // Cache the result
                self?.cachedAttribution = attribution
                
                completion(.success(attribution))
            } catch {
                completion(.failure(.decodingError(error)))
            }
        }
        
        task.resume()
    }
    
    // MARK: - AppsFlyer Attribution (via SDK callback)
    
    /// Handle AppsFlyer attribution callback
    /// Called internally from AppsFlyerLibDelegate or manually
    /// - Parameters:
    ///   - appsflyerId: AppsFlyer Device ID
    ///   - conversionData: Conversion data from AppsFlyer SDK
    ///   - completion: Completion handler with Result<AttributionData, AttributionError>
    public func handleAppsFlyerAttribution(
        appsflyerId: String,
        conversionData: [String: Any],
        completion: @escaping (Result<AttributionData, AttributionError>) -> Void
    ) {
        // Validate configuration
        guard let apiKey = apiKey, let baseURL = baseURL else {
            completion(.failure(.notConfigured))
            return
        }
        
        // Get IDFV
        #if canImport(UIKit)
        let idfv = UIDevice.current.identifierForVendor?.uuidString ?? ""
        #else
        let idfv = ""
        #endif
        
        // Build URL
        guard let url = URL(string: "\(baseURL)/api/v1/attribution/appsflyer") else {
            completion(.failure(.invalidURL))
            return
        }
        
        // Prepare request body
        var body: [String: Any] = [
            "appsflyer_id": appsflyerId,
            "customer_user_id": idfv
        ]
        
        // Add conversion data
        if let mediaSource = conversionData["media_source"] as? String {
            body["media_source"] = mediaSource
        }
        if let campaign = conversionData["campaign"] as? String {
            body["campaign"] = campaign
        }
        if let afSub1 = conversionData["af_sub1"] as? String {
            body["af_sub1"] = afSub1
        }
        if let afSub2 = conversionData["af_sub2"] as? String {
            body["af_sub2"] = afSub2
        }
        if let afSub3 = conversionData["af_sub3"] as? String {
            body["af_sub3"] = afSub3
        }
        if let afSub4 = conversionData["af_sub4"] as? String {
            body["af_sub4"] = afSub4
        }
        if let afSub5 = conversionData["af_sub5"] as? String {
            body["af_sub5"] = afSub5
        }
        
        // Also pass app_version
        body["app_version"] = DeviceInfoCollector.getAppVersion()
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Encode body
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(.decodingError(error)))
            return
        }
        
        // Send request
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            // Handle network error
            if let error = error {
                completion(.failure(.networkError(error)))
                return
            }
            
            // Check response
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(.invalidResponse))
                return
            }
            
            // Check status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMessage = String(data: data ?? Data(), encoding: .utf8) ?? "Unknown error"
                completion(.failure(.serverError(errorMessage)))
                return
            }
            
            // Check data
            guard let data = data else {
                completion(.failure(.noData))
                return
            }
            
            // Decode response
            do {
                let decoder = JSONDecoder()
                let attribution = try decoder.decode(AttributionData.self, from: data)
                
                // Cache the result
                self?.cachedAttribution = attribution
                
                completion(.success(attribution))
            } catch {
                completion(.failure(.decodingError(error)))
            }
        }
        
        task.resume()
    }
    
    /// Get cached attribution data (if available)
    public func getCachedAttribution() -> AttributionData? {
        return cachedAttribution
    }
    
    /// Clear cached attribution data
    public func clearCache() {
        cachedAttribution = nil
    }
}

// MARK: - AppsFlyerLibDelegate

extension AttributionSDK: AppsFlyerLibDelegate {
    
    /// Called when AppsFlyer conversion data is received (install attribution)
    public func onConversionDataSuccess(_ conversionInfo: [AnyHashable: Any]) {
        print("📱 AppsFlyer conversion data received:")
        
        let status = conversionInfo["af_status"] as? String ?? "unknown"
        print("   Status: \(status)")
        
        guard status == "Non-organic" else {
            print("   ℹ️ Organic install, skipping server attribution")
            return
        }
        
        let mediaSource = conversionInfo["media_source"] as? String ?? ""
        print("   Media Source: \(mediaSource)")
        
        // Get AppsFlyer ID
        let appsflyerId = AppsFlyerLib.shared().getAppsFlyerUID()
        
        // Convert to [String: Any]
        var conversionData: [String: Any] = [:]
        for (key, value) in conversionInfo {
            if let stringKey = key as? String {
                conversionData[stringKey] = value
            }
        }
        
        // Send to our server
        handleAppsFlyerAttribution(
            appsflyerId: appsflyerId,
            conversionData: conversionData
        ) { [weak self] result in
            switch result {
            case .success(let attribution):
                print("✅ AppsFlyer attribution saved to server")
                print("   OS User Key: \(attribution.osUserKey)")
                print("   Final URL: \(attribution.finalUrl ?? "N/A")")
                
                // Notify via callback
                self?.onAppsFlyerAttribution?(.success(attribution))
                
            case .failure(let error):
                print("❌ AppsFlyer server attribution failed: \(error)")
                self?.onAppsFlyerAttribution?(.failure(error))
            }
        }
    }
    
    /// Called when AppsFlyer conversion data request fails
    public func onConversionDataFail(_ error: Error) {
        print("❌ AppsFlyer conversion data failed: \(error)")
        onAppsFlyerAttribution?(.failure(.networkError(error)))
    }
}
