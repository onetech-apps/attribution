// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AttributionSDK",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "AttributionSDK",
            targets: ["AttributionSDK"]
        ),
    ],
    dependencies: [
        // AppsFlyer SDK
        .package(url: "https://github.com/AppsFlyerSDK/AppsFlyerFramework.git", from: "6.14.0"),
    ],
    targets: [
        .target(
            name: "AttributionSDK",
            dependencies: [
                .product(name: "AppsFlyerLib", package: "AppsFlyerFramework"),
            ]
        ),
        .testTarget(
            name: "AttributionSDKTests",
            dependencies: ["AttributionSDK"]
        ),
    ]
)
