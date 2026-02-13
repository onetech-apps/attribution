import XCTest
@testable import AttributionSDK

final class AttributionSDKTests: XCTestCase {
    
    override func setUp() {
        super.setUp()
        // Clear cache before each test
        AttributionSDK.shared.clearCache()
    }
    
    func testSDKConfiguration() {
        // Test that SDK can be configured
        AttributionSDK.configure(apiKey: "test_key", baseURL: "https://test.com")
        
        // SDK should be configured (no error when fetching)
        let expectation = self.expectation(description: "Configuration test")
        
        AttributionSDK.shared.fetchAttribution { result in
            // Should not fail with .notConfigured error
            if case .failure(let error) = result {
                XCTAssertFalse(error == .notConfigured, "SDK should be configured")
            }
            expectation.fulfill()
        }
        
        waitForExpectations(timeout: 5.0)
    }
    
    func testDeviceInfoCollection() {
        // Test that device info can be collected
        let deviceInfo = DeviceInfoCollector.collectDeviceInfo()
        
        XCTAssertFalse(deviceInfo.idfv.isEmpty, "IDFV should not be empty")
        XCTAssertFalse(deviceInfo.userAgent.isEmpty, "User agent should not be empty")
        XCTAssertFalse(deviceInfo.appVersion.isEmpty, "App version should not be empty")
        XCTAssertFalse(deviceInfo.osVersion.isEmpty, "OS version should not be empty")
        XCTAssertFalse(deviceInfo.deviceModel.isEmpty, "Device model should not be empty")
    }
    
    func testCaching() {
        // Test that attribution is cached
        XCTAssertNil(AttributionSDK.shared.getCachedAttribution(), "Cache should be empty initially")
        
        // After successful attribution, cache should be populated
        // (This would require mocking the network response)
    }
}
