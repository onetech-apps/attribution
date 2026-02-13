import UIKit
import AttributionSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // =============================================
        // ВАРІАНТ 1: Тільки Facebook (server-side attribution)
        // =============================================
        //
        // AttributionSDK.configure(
        //     apiKey: "your_api_key",
        //     baseURL: "https://your-app-domain.com"
        // )
        //
        // if isFirstLaunch() {
        //     performFacebookAttribution()
        // }
        
        // =============================================
        // ВАРІАНТ 2: Facebook + AppsFlyer (повна інтеграція)
        // =============================================
        
        AttributionSDK.configure(
            apiKey: "test_api_key_12345",
            baseURL: "http://localhost:3000",      // Для тестування
            // baseURL: "https://your-app-domain.com",  // Для production
            appsFlyerDevKey: "YOUR_APPSFLYER_DEV_KEY",
            appleAppID: "123456789"
        )
        
        // Callback для AppsFlyer attribution
        AttributionSDK.shared.onAppsFlyerAttribution = { result in
            switch result {
            case .success(let attribution):
                print("✅ AppsFlyer Attribution:")
                print("   OS User Key: \(attribution.osUserKey)")
                print("   Push Sub: \(attribution.pushSub)")
                
                if let finalURL = attribution.finalUrl {
                    print("   Final URL: \(finalURL)")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        self.openURL(finalURL)
                    }
                }
                
                UserDefaults.standard.set(true, forKey: "attribution_completed")
                
                // OneSignal integration
                // OneSignal.setExternalUserId(attribution.osUserKey)
                // OneSignal.sendTag("push_sub", value: attribution.pushSub)
                
            case .failure(let error):
                print("❌ AppsFlyer attribution failed: \(error)")
            }
        }
        
        // Facebook attribution (для Facebook кампаній)
        if isFirstLaunch() {
            performFacebookAttribution()
        }
        
        return true
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Запускаємо AppsFlyer SDK (обов'язково в didBecomeActive!)
        AttributionSDK.shared.startAppsFlyer()
    }
    
    // MARK: - Facebook Attribution
    
    func performFacebookAttribution() {
        print("📱 Fetching Facebook attribution...")
        
        AttributionSDK.shared.fetchAttribution { result in
            switch result {
            case .success(let attribution):
                print("✅ Facebook Attribution:")
                print("   Attributed: \(attribution.attributed)")
                print("   OS User Key: \(attribution.osUserKey)")
                print("   Push Sub: \(attribution.pushSub)")
                
                if let finalURL = attribution.finalUrl {
                    print("   Final URL: \(finalURL)")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        self.openURL(finalURL)
                    }
                }
                
                UserDefaults.standard.set(true, forKey: "attribution_completed")
                
            case .failure(let error):
                print("❌ Facebook attribution failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Helpers
    
    func isFirstLaunch() -> Bool {
        return !UserDefaults.standard.bool(forKey: "attribution_completed")
    }
    
    func openURL(_ urlString: String) {
        guard let url = URL(string: urlString) else {
            print("❌ Invalid URL: \(urlString)")
            return
        }
        
        print("🌐 Opening URL: \(url)")
        
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
    }
}
