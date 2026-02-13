# Інструкція для iOS розробника: Інтеграція Attribution System

## 📋 Зміст

1. [Підготовка AppsFlyer](#1-підготовка-appsflyer)
2. [Реєстрація додатку](#2-реєстрація-додатку-на-сервері)
3. [Інтеграція SDK в Xcode](#3-інтеграція-sdk-в-xcode)
4. [Код інтеграції](#4-код-інтеграції)
5. [Налаштування Keitaro постбеків](#5-налаштування-keitaro-постбеків)
6. [Тестування](#6-тестування)
7. [Публікація в App Store](#7-публікація-в-app-store)

---

## 1. Підготовка AppsFlyer

> ⚠️ Цей крок потрібен тільки якщо використовуєте джерела трафіку через AppsFlyer (Moloco, Unity, TikTok). Для Facebook-only кампаній пропустіть цей крок.

### 1.1. Створити додаток в AppsFlyer

1. Увійти в [AppsFlyer Dashboard](https://hq1.appsflyer.com/)
2. **Add app** → вибрати iOS
3. Заповнити:
   - **App name** — назва додатку
   - **Apple App ID** — з App Store Connect (тільки цифри, без `id`)
   - **Bundle ID** — `com.company.appname`
4. Зберегти

### 1.2. Отримати Dev Key

1. **Settings** → **App Settings**
2. Скопіювати **Dev Key** (виглядає як: `7R2968hheRdionPZ6xi255`)
3. Зберегти — знадобиться для SDK

### 1.3. Додати інтеграції (media sources)

1. **Integrated Partners** → шукати потрібне джерело:
   - **Moloco** — увімкнути, вказати API key
   - **Unity Ads** — увімкнути, вказати Game ID
   - **TikTok** — увімкнути, вказати Pixel ID
2. Для кожного — увімкнути **Install** та **In-App Events**

### 1.4. Зберегти дані

Запишіть:
- ✅ **AppsFlyer Dev Key**: `_______________`
- ✅ **Apple App ID**: `_______________`

---

## 2. Реєстрація додатку на сервері

### 2.1. Додати домен в Cloudflare

1. Увійти в [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Вибрати домен (або додати новий)
3. **DNS** → додати A-запис:
   - **Name**: `@`
   - **Content**: `89.167.63.233`
   - **Proxy**: ✅ ON (помаранчева хмарка)
4. **SSL/TLS** → вибрати режим **Flexible**

### 2.2. Зареєструвати додаток в системі

1. Відкрити: `https://oneapps.info/apps.html`
2. Ввести пароль: *(отримати у адміна)*
3. Натиснути **"Додати додаток"**
4. Заповнити поля:

| Поле | Опис | Приклад |
|------|------|---------|
| **Назва** | Назва прілендінга/додатка | `Casino Stars` |
| **Домен** | Домен для трекінгу кліків | `casinostars.com` |
| **Bundle ID** | Bundle з Xcode проєкту | `com.company.casinostars` |
| **Team ID** | Apple Developer Team ID | `A1B2C3D4E5` |
| **API Key** | Ключ для SDK (придумати) | `cs_api_key_2024` |
| **App Store URL** | Лінк на App Store | `https://apps.apple.com/app/id123456789` |
| **AppsFlyer Dev Key** | З кроку 1.2 (якщо є) | `7R2968hheRdionPZ6xi255` |

5. Натиснути **"Зберегти"**

### 2.3. Дані для SDK

Після реєстрації запишіть:
- ✅ **Домен прілу**: `https://casinostars.com`
- ✅ **API Key**: `cs_api_key_2024`
- ✅ **AppsFlyer Dev Key**: `7R2968hheRdionPZ6xi255` (якщо є)
- ✅ **Apple App ID**: `123456789`

---

## 3. Інтеграція SDK в Xcode

### 3.1. Додати пакет

**Варіант A — через Git (рекомендовано):**

1. Xcode → **File** → **Add Package Dependencies**
2. Вставити URL репозиторію: `https://github.com/ВАШ_РЕПО/attribution-sdk-ios.git`
3. Вибрати версію → **Add Package**

**Варіант B — локально:**

1. Скопіювати папку `attribution-sdk-ios` в проєкт
2. Xcode → **File** → **Add Package Dependencies**
3. Вибрати **Add Local** → обрати папку SDK

### 3.2. Імпортувати в Target

1. Xcode → ваш Target → **General** → **Frameworks, Libraries, and Embedded Content**
2. Натиснути **+** → додати `AttributionSDK`

---

## 4. Код інтеграції

### 4.1. Тільки Facebook (без AppsFlyer)

```swift
import UIKit
import AttributionSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // ============================================
        // ⚡ ЗМІНИТИ ЦІ ЗНАЧЕННЯ НА СВОЇ:
        // ============================================
        AttributionSDK.configure(
            apiKey: "cs_api_key_2024",              // API Key з кроку 2.2
            baseURL: "https://casinostars.com"       // Домен прілу з кроку 2.1
        )
        
        // Attribution при першому запуску
        if !UserDefaults.standard.bool(forKey: "attribution_completed") {
            fetchAttribution()
        }
        
        return true
    }
    
    func fetchAttribution() {
        AttributionSDK.shared.fetchAttribution { result in
            switch result {
            case .success(let attribution):
                print("✅ Attribution: \(attribution.attributed ? "Paid" : "Organic")")
                print("   OS User Key: \(attribution.osUserKey)")
                
                // Відкрити Keitaro URL якщо є (тільки для paid трафіку)
                if let finalURL = attribution.finalUrl {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        if let url = URL(string: finalURL) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                
                // Позначити що attribution вже виконано
                UserDefaults.standard.set(true, forKey: "attribution_completed")
                
                // Якщо використовуєте OneSignal:
                // OneSignal.setExternalUserId(attribution.osUserKey)
                // OneSignal.sendTag("push_sub", value: attribution.pushSub)
                
            case .failure(let error):
                print("❌ Attribution error: \(error)")
                // Додаток продовжує працювати як organic
            }
        }
    }
}
```

### 4.2. Facebook + AppsFlyer (повна інтеграція)

```swift
import UIKit
import AttributionSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // ============================================
        // ⚡ ЗМІНИТИ ЦІ ЗНАЧЕННЯ НА СВОЇ:
        // ============================================
        AttributionSDK.configure(
            apiKey: "cs_api_key_2024",                  // API Key з кроку 2.2
            baseURL: "https://casinostars.com",          // Домен прілу
            appsFlyerDevKey: "7R2968hheRdionPZ6xi255",  // AppsFlyer Dev Key з кроку 1.2
            appleAppID: "123456789"                      // Apple App ID (тільки цифри!)
        )
        
        // Callback для AppsFlyer attribution
        AttributionSDK.shared.onAppsFlyerAttribution = { result in
            switch result {
            case .success(let attribution):
                print("✅ AppsFlyer Attribution:")
                print("   OS User Key: \(attribution.osUserKey)")
                
                if let finalURL = attribution.finalUrl {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        if let url = URL(string: finalURL) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                
                UserDefaults.standard.set(true, forKey: "attribution_completed")
                
            case .failure(let error):
                print("❌ AppsFlyer attribution failed: \(error)")
            }
        }
        
        // Facebook attribution при першому запуску
        if !UserDefaults.standard.bool(forKey: "attribution_completed") {
            fetchAttribution()
        }
        
        return true
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Запуск AppsFlyer (ОБОВ'ЯЗКОВО в didBecomeActive!)
        AttributionSDK.shared.startAppsFlyer()
    }
    
    func fetchAttribution() {
        AttributionSDK.shared.fetchAttribution { result in
            switch result {
            case .success(let attribution):
                print("✅ Facebook Attribution:")
                print("   Attributed: \(attribution.attributed)")
                print("   OS User Key: \(attribution.osUserKey)")
                
                if let finalURL = attribution.finalUrl {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        if let url = URL(string: finalURL) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
                
                UserDefaults.standard.set(true, forKey: "attribution_completed")
                
            case .failure(let error):
                print("❌ Attribution error: \(error)")
            }
        }
    }
}
```

### 4.3. Що міняти в кожному новому додатку

| Параметр | Де взяти | Приклад |
|----------|----------|---------|
| `apiKey` | Сторінка "Додатки" (apps.html) | `"cs_api_key_2024"` |
| `baseURL` | Домен прілу | `"https://casinostars.com"` |
| `appsFlyerDevKey` | AppsFlyer Dashboard | `"7R2968hheRdionPZ6xi255"` |
| `appleAppID` | App Store Connect | `"123456789"` |

> ⚠️ **ВАЖЛИВО**: `baseURL` — це домен **прілу** (тобто домен який був зареєстрований в apps.html), НЕ домен дашборду (`oneapps.info`).

---

## 5. Налаштування Keitaro постбеків

В Keitaro потрібно додати S2S постбеки які повідомлять наш сервер про конверсії.
Наш сервер далі відправить івент у Facebook Conversion API або AppsFlyer.

> ⚠️ **ВАЖЛИВО**: Ми передаємо наш `click_id` в Keitaro через параметр `external_id` в URL кампанії. Тому в постбеках використовуємо макрос **`{external_id}`**.

### 5.1. Всі постбеки — зведена таблиця

| Тип | Keitaro S2S Postback URL |
|-----|--------------------------|
| **Facebook Lead** | `https://oneapps.info/api/v1/postback?subid={external_id}&status=lead` |
| **Facebook Sale** | `https://oneapps.info/api/v1/postback?subid={external_id}&status=sale&amount={revenue}&currency={currency}` |
| **AppsFlyer Registration** | `https://oneapps.info/api/v1/postback/appsflyer?appsflyer_id={external_id}&idfv={sub5}&event=registration` |
| **AppsFlyer Deposit** | `https://oneapps.info/api/v1/postback/appsflyer?appsflyer_id={external_id}&idfv={sub5}&event=deposit&amount={revenue}&currency={currency}` |

> Всі `{...}` — це макроси Keitaro, які автоматично підставлять значення.

### 5.2. Налаштування в Keitaro (Facebook)

1. Зайти в **Кампанію** → **Postback URLs**
2. Додати постбек для **Lead**:

| Поле | Значення |
|------|----------|
| **URL** | `https://oneapps.info/api/v1/postback?subid={external_id}&status=lead` |
| **Event** | Lead / Registration |
| **Method** | GET |

3. Додати постбек для **Sale** (з ревеню):

| Поле | Значення |
|------|----------|
| **URL** | `https://oneapps.info/api/v1/postback?subid={external_id}&status=sale&amount={revenue}&currency={currency}` |
| **Event** | Sale / Purchase |
| **Method** | GET |

### 5.3. Налаштування в Keitaro (AppsFlyer)

1. Додати постбек для **Registration**:

| Поле | Значення |
|------|----------|
| **URL** | `https://oneapps.info/api/v1/postback/appsflyer?appsflyer_id={external_id}&idfv={sub5}&event=registration` |
| **Event** | Registration |
| **Method** | GET |

2. Додати постбек для **Deposit** (з ревеню):

| Поле | Значення |
|------|----------|
| **URL** | `https://oneapps.info/api/v1/postback/appsflyer?appsflyer_id={external_id}&idfv={sub5}&event=deposit&amount={revenue}&currency={currency}` |
| **Event** | Deposit |
| **Method** | GET |

### 5.4. Опис параметрів

| Параметр | Що передає | Звідки отримується |
|----------|------------|-------------------|
| `subid` / `appsflyer_id` | Наш click_id або AppsFlyer ID | Keitaro макрос `{external_id}` |
| `status` | Тип конверсії: `lead` або `sale` | Вручну вказується |
| `event` | Тип AppsFlyer: `registration` або `deposit` | Вручну вказується |
| `amount` | Сума ревеню | Keitaro макрос `{revenue}` |
| `currency` | Валюта (USD, EUR тощо) | Keitaro макрос `{currency}` |
| `idfv` | IDFV пристрою (для AppsFlyer) | Keitaro макрос `{sub5}` |

### 5.4. URL для реклами (Facebook)

Трекінг-лінк для Facebook реклами:

```
https://ДОМЕН_ПРІЛУ/t?sub1=BUYER_ID&sub2=GEO&sub3=CREATIVE&sub4=OFFER&sub5=CUSTOM&fb_id=PIXEL_ID&fb_token=ACCESS_TOKEN
```

**Приклад:**
```
https://casinostars.com/t?sub1=buyer_ivan&sub2=UA&sub3=creative_v2&sub4=casino_stars&fbclid={{fbclid}}&adsetid={{adset.id}}&fb_id=598428619877262&fb_token=EAAG...
```

> `{{fbclid}}` і `{{adset.id}}` — це макроси Facebook, вони автоматично підставляються.

---

## 6. Тестування

### 6.1. Перевірка домену

Відкрити в браузері:
```
https://ДОМЕН_ПРІЛУ/health
```
Має повернути: `{"status":"ok"}`

### 6.2. Тестовий клік

```bash
curl "https://ДОМЕН_ПРІЛУ/t?sub1=test_buyer&sub2=UA&sub3=test_creative"
```
Має зробити редірект на App Store URL.

### 6.3. Тестування через дашборд

1. Відкрити `https://oneapps.info/testing.html`
2. Вкладка **"Верифікація"** — перевірити трекінг-лінк
3. Вкладка **"Симулятор"** — пройти повний цикл attribution
4. Вкладка **"Ручні інструменти"** — тест постбеків

### 6.4. Перевірка в дашборді

1. Відкрити `https://oneapps.info/dashboard.html`
2. Перевірити що тестовий клік зʼявився в таблиці "Кліки"
3. Перевірити attribution в таблиці "Атрибуції"

---

## 7. Публікація в App Store

### Чекліст перед відправкою на ревью:

- [ ] SDK додано в проєкт
- [ ] `apiKey`, `baseURL` вказують на **production** домен прілу
- [ ] `appsFlyerDevKey` і `appleAppID` вказані (якщо використовується AppsFlyer)
- [ ] Домен прілу зареєстрований в `apps.html`
- [ ] DNS A-запис в Cloudflare створений з проксі ON
- [ ] `https://ДОМЕН_ПРІЛУ/health` повертає `{"status":"ok"}`
- [ ] Постбеки в Keitaro налаштовані на `https://oneapps.info/api/v1/postback?...`
- [ ] Тестовий клік проходить успішно
- [ ] Attribution працює коректно

### Порядок дій:

1. ✅ Зробити всі кроки 1-6 вище
2. ✅ Збілдити Archive в Xcode
3. ✅ Залити в App Store Connect
4. ✅ Відправити на ревью
5. ⏳ Дочекатись аппрува
6. ✅ Увімкнути кампанію в Facebook/AppsFlyer

---

## ❓ FAQ

**Q: Що якщо attribution не знайшла matching click?**
A: SDK поверне `attributed: false`, `pushSub: "organic"`, і `finalUrl: null`. Додаток працює як звичайний organic install.

**Q: Скільки часу дійсний клік для attribution?**
A: 24 години. Після цього клік вважається протухшим.

**Q: Чи потрібен AppsFlyer для Facebook кампаній?**
A: Ні. Facebook attribution працює повністю через наш сервер (IP matching). AppsFlyer потрібен тільки для Moloco, Unity, TikTok.

**Q: Де дивитись конверсії?**
A: В дашборді `https://oneapps.info/dashboard.html` → вкладка "Логи".

**Q: Як змінити пароль дашборду?**
A: Відредагувати файл `public/auth.js` на сервері, змінна `ADMIN_PASSWORD`.
