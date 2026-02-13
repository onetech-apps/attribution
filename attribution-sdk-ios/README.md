# Attribution SDK for iOS

Swift Package для інтеграції системи атрибуції в iOS додатки.

## Вимоги

- iOS 13.0+
- Swift 5.9+
- Xcode 14.0+

## Встановлення

### Swift Package Manager

1. В Xcode: File → Add Package Dependencies
2. Введіть URL репозиторію (або локальний шлях для розробки)
3. Виберіть версію
4. Додайте `AttributionSDK` до вашого target

### Локальна розробка

```swift
// В Package.swift вашого проекту
dependencies: [
    .package(path: "../attribution-sdk-ios")
]
```

## Використання

### 1. Конфігурація

В `AppDelegate.swift` або `SceneDelegate.swift`:

```swift
import AttributionSDK

func application(_ application: UIApplication, 
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // Налаштування SDK
    AttributionSDK.configure(
        apiKey: "your_api_key_here",
        baseURL: "https://oneapps.info"
    )
    
    return true
}
```

### 2. Отримання даних атрибуції

```swift
import AttributionSDK

// Виклик при першому запуску додатка
AttributionSDK.shared.fetchAttribution { result in
    switch result {
    case .success(let attribution):
        print("✅ Attribution successful!")
        print("Attributed: \(attribution.attributed)")
        print("OS User Key: \(attribution.osUserKey)")
        print("Push Sub: \(attribution.pushSub)")
        
        if let finalURL = attribution.finalUrl {
            print("Final URL: \(finalURL)")
            // Відкрити WebView або Safari
            openURL(finalURL)
        }
        
        if let campaignData = attribution.campaignData {
            print("Campaign: \(campaignData.sub1 ?? "N/A")")
        }
        
        // Відправити OS User Key в OneSignal
        OneSignal.setExternalUserId(attribution.osUserKey)
        
    case .failure(let error):
        print("❌ Attribution failed: \(error.localizedDescription)")
    }
}
```

### 3. Інтеграція з OneSignal

```swift
import OneSignal

// Після отримання attribution
AttributionSDK.shared.fetchAttribution { result in
    if case .success(let attribution) = result {
        // Встановити External User ID
        OneSignal.setExternalUserId(attribution.osUserKey)
        
        // Додати тег з push_sub
        OneSignal.sendTag("push_sub", value: attribution.pushSub)
        
        // Якщо є campaign data
        if let campaign = attribution.campaignData {
            OneSignal.sendTag("campaign", value: campaign.sub1 ?? "organic")
        }
    }
}
```

### 4. Відкриття Final URL

```swift
import SafariServices

func openURL(_ urlString: String) {
    guard let url = URL(string: urlString) else { return }
    
    // Варіант 1: Safari View Controller (рекомендовано)
    let safariVC = SFSafariViewController(url: url)
    present(safariVC, animated: true)
    
    // Варіант 2: Зовнішній Safari
    // UIApplication.shared.open(url)
    
    // Варіант 3: WebView в додатку
    // let webView = WKWebView()
    // webView.load(URLRequest(url: url))
}
```

### 5. Кешування

SDK автоматично кешує результат першого запиту:

```swift
// Отримати кешовані дані (якщо є)
if let cached = AttributionSDK.shared.getCachedAttribution() {
    print("Cached attribution: \(cached.osUserKey)")
}

// Очистити кеш
AttributionSDK.shared.clearCache()
```

## Структура відповіді

```swift
public struct AttributionData {
    public let success: Bool           // Чи успішний запит
    public let attributed: Bool        // Чи знайдено matching click
    public let finalUrl: String?       // URL для відкриття
    public let pushSub: String         // Значення для push системи
    public let osUserKey: String       // Унікальний ключ користувача
    public let clickId: String?        // ID кліка (якщо attributed)
    public let campaignData: CampaignData?  // Дані кампанії
}

public struct CampaignData {
    public let fbclid: String?
    public let sub1: String?
    public let sub2: String?
    public let sub3: String?
    public let adsetid: String?
}
```

## Обробка помилок

```swift
AttributionSDK.shared.fetchAttribution { result in
    switch result {
    case .success(let attribution):
        // Успіх
        handleAttribution(attribution)
        
    case .failure(let error):
        switch error {
        case .notConfigured:
            print("SDK не налаштовано")
        case .networkError(let networkError):
            print("Помилка мережі: \(networkError)")
        case .serverError(let message):
            print("Помилка сервера: \(message)")
        case .invalidResponse:
            print("Невалідна відповідь")
        default:
            print("Інша помилка: \(error)")
        }
    }
}
```

## Приклад повної інтеграції

```swift
import UIKit
import AttributionSDK
import OneSignal

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // 1. Налаштування Attribution SDK
        AttributionSDK.configure(
            apiKey: "test_api_key_12345",
            baseURL: "https://oneapps.info"
        )
        
        // 2. Налаштування OneSignal
        OneSignal.initWithLaunchOptions(launchOptions)
        OneSignal.setAppId("YOUR_ONESIGNAL_APP_ID")
        
        // 3. Отримання attribution (тільки при першому запуску)
        if isFirstLaunch() {
            fetchAttributionData()
        }
        
        return true
    }
    
    func fetchAttributionData() {
        AttributionSDK.shared.fetchAttribution { result in
            switch result {
            case .success(let attribution):
                print("✅ Attribution: \(attribution.attributed ? "Paid" : "Organic")")
                
                // Відправка в OneSignal
                OneSignal.setExternalUserId(attribution.osUserKey)
                OneSignal.sendTag("push_sub", value: attribution.pushSub)
                
                // Відкриття final URL якщо є
                if let finalURL = attribution.finalUrl {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        self.openFinalURL(finalURL)
                    }
                }
                
                // Збереження що attribution вже виконано
                UserDefaults.standard.set(true, forKey: "attribution_completed")
                
            case .failure(let error):
                print("❌ Attribution error: \(error)")
            }
        }
    }
    
    func isFirstLaunch() -> Bool {
        return !UserDefaults.standard.bool(forKey: "attribution_completed")
    }
    
    func openFinalURL(_ urlString: String) {
        guard let url = URL(string: urlString),
              let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            return
        }
        
        let safariVC = SFSafariViewController(url: url)
        rootViewController.present(safariVC, animated: true)
    }
}
```

## Best Practices

### 1. Викликати тільки один раз

```swift
// Перевіряти чи вже викликали attribution
if !UserDefaults.standard.bool(forKey: "attribution_completed") {
    AttributionSDK.shared.fetchAttribution { result in
        // ...
        UserDefaults.standard.set(true, forKey: "attribution_completed")
    }
}
```

### 2. Обробляти помилки gracefully

```swift
AttributionSDK.shared.fetchAttribution { result in
    if case .failure(let error) = result {
        // Логувати помилку, але не блокувати роботу додатка
        print("Attribution failed: \(error)")
        // Продовжити як organic user
    }
}
```

### 3. Timeout для мережевих запитів

SDK використовує стандартний URLSession timeout. Для кастомізації:

```swift
// В майбутніх версіях буде додано параметр timeout
```

## Troubleshooting

### Помилка "SDK not configured"

Переконайтеся що викликали `AttributionSDK.configure()` перед `fetchAttribution()`.

### Помилка "Invalid API key"

Перевірте що API ключ правильний та активний в базі даних.

### Не працює attribution matching

- Перевірте що backend запущено
- Перевірте що клік був створений перед відкриттям додатка
- Перевірте що IP адреси співпадають (для тестування)

## License

ISC
