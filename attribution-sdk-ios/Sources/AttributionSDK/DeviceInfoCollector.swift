import Foundation
import UIKit

/// Helper class for collecting device information
class DeviceInfoCollector {
    
    /// Get User-Agent string
    static func getUserAgent() -> String {
        let systemVersion = UIDevice.current.systemVersion
        let model = getDeviceModel()
        let appVersion = getAppVersion()
        
        return "Mozilla/5.0 (iPhone; CPU iPhone OS \(systemVersion.replacingOccurrences(of: ".", with: "_")) like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/\(appVersion)"
    }
    
    /// Get IDFV (Identifier for Vendor)
    static func getIDFV() -> String {
        return UIDevice.current.identifierForVendor?.uuidString ?? ""
    }
    
    /// Get IDFA (requires ATTrackingManager permission)
    static func getIDFA() -> String? {
        // Note: Requires import AdSupport and ATTrackingManager authorization
        // For now, returning nil. Can be implemented when needed.
        return nil
    }
    
    /// Get app version
    static func getAppVersion() -> String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    /// Get OS version
    static func getOSVersion() -> String {
        return UIDevice.current.systemVersion
    }
    
    /// Get device model
    static func getDeviceModel() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let modelCode = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0)
            }
        }
        return modelCode ?? "Unknown"
    }
    
    /// Collect all device info
    static func collectDeviceInfo() -> DeviceInfo {
        return DeviceInfo(
            userAgent: getUserAgent(),
            idfv: getIDFV(),
            idfa: getIDFA(),
            appVersion: getAppVersion(),
            osVersion: getOSVersion(),
            deviceModel: getDeviceModel()
        )
    }
}
