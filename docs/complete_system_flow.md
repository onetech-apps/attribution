# Повний опис роботи Attribution System

## 📋 Зміст

1. [Facebook Attribution Flow](#facebook-attribution-flow)
2. [AppsFlyer Attribution Flow](#appsflyer-attribution-flow)
3. [Keitaro Integration](#keitaro-integration)
4. [Postback Flow](#postback-flow)
5. [Database Structure](#database-structure)
6. [Code Flow](#code-flow)

---

# Facebook Attribution Flow

## 🎯 Повний цикл від реклами до конверсії

### Крок 1: Користувач бачить рекламу Facebook

**Що відбувається:**
- Facebook показує рекламу з посиланням на ваш tracking сервер
- URL містить параметри кампанії

**Приклад URL в рекламі:**
```
https://oneapps.info/t?
  sub1=buyer123&          // ID баєра (обов'язково!)
  sub2=US&                // Гео
  sub3=creative1&         // Креатив
  sub4=offer_id&          // ID оффера
  sub5=custom&            // Кастомний параметр
  fbclid=xxx&             // Facebook Click ID (автоматично)
  adsetid=123456&         // Facebook Ad Set ID
  fb_id=598428619877262&  // Facebook Pixel ID
  fb_token=xxx            // Facebook Access Token
```

---

### Крок 2: Click Tracking (Сервер)

**Endpoint:** `GET /t` або `GET /api/v1/track/click`

**Файл:** `src/controllers/clickController.ts`

**Що відбувається покроково:**

1. **Прийом запиту:**
   ```typescript
   const params = req.query;  // Всі параметри з URL
   const tenant = req.tenant; // Визначається по домену
   ```

2. **Генерація Click ID:**
   ```typescript
   const clickId = generateClickId();  // UUID v4
   // Приклад: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
   ```

3. **Збір метаданих:**
   ```typescript
   const ipAddress = req.ip;                    // "192.168.1.1"
   const userAgent = req.headers['user-agent']; // "Mozilla/5.0..."
   ```

4. **Збереження в БД (clicks table):**
   ```sql
   INSERT INTO clicks (
     click_id,      -- "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
     app_id,        -- "app_moloko" (з tenant)
     ip_address,    -- "192.168.1.1"
     user_agent,    -- "Mozilla/5.0..."
     fbclid,        -- "xxx" (з URL)
     sub1,          -- "buyer123" (з URL)
     sub2,          -- "US" (з URL)
     sub3,          -- "creative1" (з URL)
     sub4,          -- "offer_id" (з URL)
     sub5,          -- "custom" (з URL)
     adsetid,       -- "123456" (з URL)
     fb_id,         -- "598428619877262" (з URL)
     fb_token       -- "xxx" (з URL)
   )
   ```

5. **Redirect на App Store:**
   ```typescript
   const appStoreUrl = tenant.app_store_url;
   // "https://apps.apple.com/app/id123456789"
   res.redirect(302, appStoreUrl);
   ```

**Результат:**
- ✅ Click збережений в БД з усіма параметрами
- ✅ Користувач перенаправлений на App Store
- ✅ Click ID згенерований для майбутнього matching

---

### Крок 3: Install з App Store

**Що відбувається:**
- Користувач встановлює додаток з App Store
- iOS зберігає IP та User-Agent під час установки
- Додаток запускається вперше

---

### Крок 4: Attribution Request (iOS → Сервер)

**Endpoint:** `POST /api/v1/attribution`

**Файл:** `src/controllers/attributionController.ts`

**iOS SDK код:**
```swift
// 1. Збір device info
let deviceInfo = DeviceInfo(
    userAgent: "MyApp/1.0.0",
    idfv: "E47A0B08-A3B3-4947-AE9E-0063A03824B1",
    idfa: nil,  // Може бути nil
    appVersion: "1.0.0",
    osVersion: "17.0",
    deviceModel: "iPhone14,2"
)

// 2. Відправка на сервер
AttributionSDK.shared.fetchAttribution { result in
    switch result {
    case .success(let attribution):
        print("Attribution:", attribution)
    case .failure(let error):
        print("Error:", error)
    }
}
```

**Сервер - покрокова обробка:**

#### 4.1. Валідація запиту

```typescript
const deviceInfo: DeviceInfo = {
    ip: req.ip,                    // "192.168.1.1"
    user_agent: req.body.user_agent,
    idfa: req.body.idfa,           // Може бути null
    idfv: req.body.idfv,           // ОБОВ'ЯЗКОВО!
    app_version: req.body.app_version,
    os_version: req.body.os_version,
    device_model: req.body.device_model
};

if (!deviceInfo.idfv) {
    return res.status(400).json({ error: 'IDFV is required' });
}
```

#### 4.2. Перевірка існуючої attribution

```typescript
const existingAttribution = await query(
    'SELECT * FROM attributions WHERE idfv = $1',
    [deviceInfo.idfv]
);

if (existingAttribution.rows.length > 0) {
    // Вже є attribution - повернути існуючу
    return res.json({
        success: true,
        attributed: true,
        final_url: existing.final_url,
        push_sub: existing.push_sub,
        os_user_key: existing.os_user_key
    });
}
```

#### 4.3. Пошук matching click

**Файл:** `src/services/attributionService.ts`

```typescript
async findMatchingClick(deviceInfo: DeviceInfo) {
    // Шукаємо click за останні 24 години з тим самим IP
    const result = await query(
        `SELECT * FROM clicks 
         WHERE ip_address = $1 
         AND created_at >= NOW() - INTERVAL '24 hours'
         AND attributed = FALSE
         ORDER BY created_at DESC
         LIMIT 1`,
        [deviceInfo.ip]
    );
    
    if (result.rows.length === 0) {
        return null;  // Organic install
    }
    
    return result.rows[0];
}
```

**Логіка matching:**
- ✅ Той самий IP адрес
- ✅ Click не старше 24 годин
- ✅ Click ще не використаний (attributed = FALSE)
- ✅ Беремо найновіший click

#### 4.4. Fraud Detection

```typescript
async isSuspicious(click: any, deviceInfo: DeviceInfo): Promise<boolean> {
    // 1. Перевірка часу між click та install
    const timeDiff = Date.now() - new Date(click.created_at).getTime();
    if (timeDiff < 5000) {  // Менше 5 секунд
        return true;  // Занадто швидко
    }
    
    // 2. Перевірка User-Agent
    if (click.user_agent !== deviceInfo.user_agent) {
        // Різні User-Agent - підозріло, але не критично
        console.warn('Different User-Agent');
    }
    
    return false;
}
```

#### 4.5. Генерація OS User Key

```typescript
function generateOsUserKey(idfv: string): string {
    // SHA-256 hash від IDFV
    return crypto
        .createHash('sha256')
        .update(idfv)
        .digest('hex')
        .substring(0, 32);
}

// Приклад:
// IDFV: "E47A0B08-A3B3-4947-AE9E-0063A03824B1"
// OS User Key: "e47a0b08a3b34947ae9e0063a03824b1"
```

#### 4.6. Визначення Push Sub

```typescript
const pushSub = matchingClick?.sub1 || 'organic';

// Якщо є matching click:
// pushSub = "buyer123" (з click.sub1)

// Якщо organic:
// pushSub = "organic"
```

#### 4.7. Facebook APP_INSTALL Event

```typescript
if (matchingClick?.fbclid && matchingClick?.fb_id) {
    await facebookApi.sendAppInstall({
        pixelId: matchingClick.fb_id,      // "598428619877262"
        accessToken: matchingClick.fb_token,
        fbclid: matchingClick.fbclid,      // "xxx"
        ip: deviceInfo.ip,
        userAgent: deviceInfo.user_agent
    });
}
```

**Facebook Conversion API запит:**
```http
POST https://graph.facebook.com/v18.0/598428619877262/events
Content-Type: application/json

{
  "data": [{
    "event_name": "APP_INSTALL",
    "event_time": 1707234240,
    "action_source": "app",
    "user_data": {
      "client_ip_address": "192.168.1.1",
      "client_user_agent": "Mozilla/5.0...",
      "fbc": "fb.1.xxx.fbclid"
    }
  }],
  "access_token": "xxx"
}
```

#### 4.8. Побудова Keitaro URL

**Використовується unified helper:**

```typescript
// src/utils/keitaroHelper.ts
const params = extractFacebookParams(matchingClick, osUserKey, deviceInfo);

// params = {
//   click_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
//   sub1: "buyer123",
//   sub2: "US",
//   sub3: "creative1",
//   sub4: "offer_id",
//   sub5: "custom",
//   push_sub: "buyer123",
//   os_user_key: "e47a0b08a3b34947ae9e0063a03824b1",
//   fbclid: "xxx",
//   adset: "123456",
//   bundle: "com.moloko.app",
//   app_version: "1.0.0"
// }

const finalUrl = buildKeitaroUrl(params, tenant);
```

**Результат - повний Keitaro URL:**
```
https://onebuy.pro/LNCKRd7L?
click_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&
external_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&
sub1=buyer123&
sub2=US&
sub3=creative1&
sub4=offer_id&
sub5=custom&
push=buyer123&
push_sub=buyer123&
os_user_key=e47a0b08a3b34947ae9e0063a03824b1&
af_userid=e47a0b08a3b34947ae9e0063a03824b1&
fbclid=xxx&
adset=123456&
bundle=com.moloko.app&
bundle_id=com.moloko.app&
app_version=1.0.0
```

#### 4.9. Збереження Attribution в БД

```sql
INSERT INTO attributions (
  click_id,        -- "a1b2c3d4-..." (з matching click)
  os_user_key,     -- "e47a0b08a3b34947..." (генерований)
  app_id,          -- "app_moloko" (з tenant)
  ip_address,      -- "192.168.1.1"
  user_agent,      -- "MyApp/1.0.0"
  idfa,            -- NULL або "xxx"
  idfv,            -- "E47A0B08-A3B3-4947-AE9E-0063A03824B1"
  device_model,    -- "iPhone14,2"
  os_version,      -- "17.0"
  app_version,     -- "1.0.0"
  push_sub,        -- "buyer123"
  final_url,       -- "https://onebuy.pro/..."
  attribution_source  -- "facebook"
)
```

#### 4.10. Відповідь iOS додатку

```json
{
  "success": true,
  "attributed": true,
  "final_url": "https://onebuy.pro/LNCKRd7L?sub1=buyer123&...",
  "push_sub": "buyer123",
  "os_user_key": "e47a0b08a3b34947ae9e0063a03824b1",
  "click_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "campaign_data": {
    "fbclid": "xxx",
    "sub1": "buyer123",
    "sub2": "US",
    "sub3": "creative1",
    "adsetid": "123456"
  }
}
```

---

### Крок 5: Відкриття Keitaro URL (iOS)

**iOS SDK код:**
```swift
AttributionSDK.shared.fetchAttribution { result in
    if case .success(let attribution) = result,
       let finalUrl = attribution.finalUrl,
       let url = URL(string: finalUrl) {
        
        // Відкрити Safari з Keitaro URL
        UIApplication.shared.open(url)
    }
}
```

**Що відбувається:**
1. iOS відкриває Safari
2. Safari переходить на `https://onebuy.pro/LNCKRd7L?sub1=buyer123&...`
3. Keitaro обробляє запит

---

### Крок 6: Keitaro Processing

**Keitaro отримує:**
```
GET https://onebuy.pro/LNCKRd7L?
  click_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&
  sub1=buyer123&
  sub2=US&
  ...
```

**Keitaro логіка:**

1. **Знаходить потік по sub1:**
   - `sub1=buyer123` → Потік "Buyer 123 - Casino Offers"

2. **Зберігає click_id:**
   - Keitaro зберігає `click_id` як `{click_id}` токен
   - Використовується для postback

3. **Redirect на оффер:**
   ```
   https://casino-offer.com/landing?
     clickid={keitaro_click_id}&
     sub1=buyer123&
     sub2=US
   ```

**Користувач бачить:**
- Landing page оффера (казино/беттінг/нутра)

---

### Крок 7: Реєстрація на офері

**Користувач:**
1. Заповнює форму реєстрації
2. Натискає "Sign Up"

**Оффер:**
1. Створює акаунт
2. Відправляє postback в Keitaro

**Postback від оффера в Keitaro:**
```
GET https://onebuy.pro/postback?
  clickid={keitaro_click_id}&
  status=lead
```

---

### Крок 8: Postback з Keitaro на ваш сервер

**Keitaro налаштування:**
- Event: Lead
- URL: `https://oneapps.info/api/v1/postback?subid={click_id}&status=lead`

**Keitaro відправляє:**
```
GET https://oneapps.info/api/v1/postback?
  subid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&
  status=lead
```

---

### Крок 9: Postback Processing (Сервер)

**Endpoint:** `GET /api/v1/postback`

**Файл:** `src/controllers/postbackController.ts`

**Покрокова обробка:**

#### 9.1. Прийом запиту

```typescript
const { subid, status } = req.query;
// subid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
// status = "lead"
```

#### 9.2. Пошук click в БД

```typescript
const clickResult = await query(
    'SELECT * FROM clicks WHERE click_id = $1',
    [subid]
);

if (clickResult.rows.length === 0) {
    return res.status(404).json({ error: 'Click not found' });
}

const click = clickResult.rows[0];
```

#### 9.3. Перевірка Facebook credentials

```typescript
if (!click.fbclid || !click.fb_id || !click.fb_token) {
    // Немає даних для Facebook - пропускаємо
    return res.json({ 
        success: true, 
        message: 'No FB tracking' 
    });
}
```

#### 9.4. Визначення Facebook event

```typescript
let eventName: string;

switch (status) {
    case 'lead':
        eventName = 'COMPLETE_REGISTRATION';
        break;
    case 'sale':
        eventName = 'PURCHASE';
        break;
    default:
        return res.status(400).json({ 
            error: 'Invalid status' 
        });
}
```

#### 9.5. Відправка в Facebook Conversion API

```typescript
await facebookApi.sendEvent({
    eventName: 'COMPLETE_REGISTRATION',
    pixelId: click.fb_id,
    accessToken: click.fb_token,
    fbclid: click.fbclid,
    ip: click.ip_address,
    userAgent: click.user_agent
});
```

**Facebook API запит:**
```http
POST https://graph.facebook.com/v18.0/598428619877262/events

{
  "data": [{
    "event_name": "COMPLETE_REGISTRATION",
    "event_time": 1707234540,
    "action_source": "app",
    "user_data": {
      "client_ip_address": "192.168.1.1",
      "client_user_agent": "Mozilla/5.0...",
      "fbc": "fb.1.xxx.fbclid"
    }
  }],
  "access_token": "xxx"
}
```

#### 9.6. Відповідь Keitaro

```json
{
  "success": true,
  "message": "COMPLETE_REGISTRATION event sent to Facebook",
  "subid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "lead"
}
```

---

## ✅ Facebook Flow - Повний ланцюжок

```
1. FB Реклама → Click Tracking
   ↓ (зберегли: sub1-5, fbclid, fb_id, fb_token, click_id)
   
2. App Store → Install
   ↓
   
3. iOS App → Attribution Request
   ↓ (matching по IP, генерували os_user_key, push_sub)
   
4. Server → Facebook APP_INSTALL
   ↓ (відправили івент в FB)
   
5. Server → Keitaro URL
   ↓ (побудували URL з усіма параметрами)
   
6. iOS → Safari → Keitaro
   ↓ (відкрили URL, Keitaro знайшов потік)
   
7. Keitaro → Оффер
   ↓ (redirect на landing)
   
8. User → Registration
   ↓ (заповнив форму)
   
9. Offer → Keitaro Postback
   ↓ (status=lead)
   
10. Keitaro → Server Postback
    ↓ (subid=click_id, status=lead)
    
11. Server → Facebook COMPLETE_REGISTRATION
    ✅ (відправили конверсію в FB)
```

---

# AppsFlyer Attribution Flow

## 🎯 Повний цикл від реклами до конверсії

### Крок 1: Користувач бачить рекламу Moloco/Unity/TikTok

**Що відбувається:**
- Moloco/Unity/TikTok показує рекламу
- URL веде прямо на App Store (БЕЗ вашого сервера!)
- AppsFlyer трекає клік автоматично

**Приклад URL в рекламі:**
```
https://apps.apple.com/app/id123456789?
  af_sub1=buyer123&       // ID баєра (передається в AppsFlyer)
  af_sub2=US&             // Гео
  af_sub3=creative1&      // Креатив
  af_sub4=offer_id&       // ID оффера
  af_sub5=custom          // Кастомний параметр
```

**Важливо:**
- ❌ НЕ йде через ваш click tracking
- ✅ AppsFlyer автоматично фіксує клік
- ✅ Параметри `af_sub1-5` зберігаються в AppsFlyer

---

### Крок 2: AppsFlyer Click Tracking (автоматично)

**Що робить AppsFlyer:**

1. **Фіксує клік:**
   - Device fingerprint (IP, User-Agent, тощо)
   - Час кліку
   - Media source (moloco, unity, tiktok)
   - Campaign name
   - Всі `af_sub1-5` параметри

2. **Зберігає в своїй БД:**
   ```
   {
     "appsflyer_id": "1234567890-abcdef",
     "media_source": "moloco",
     "campaign": "casino_tier1",
     "af_sub1": "buyer123",
     "af_sub2": "US",
     "af_sub3": "creative1",
     "af_sub4": "offer_id",
     "af_sub5": "custom",
     "click_time": "2024-02-06T16:00:00Z"
   }
   ```

3. **Redirect на App Store:**
   - Користувач потрапляє на App Store
   - Встановлює додаток

---

### Крок 3: Install з App Store

**Що відбувається:**
- Користувач встановлює додаток
- Додаток запускається вперше
- AppsFlyer SDK ініціалізується

---

### Крок 4: AppsFlyer SDK Initialization (iOS)

**iOS код в AppDelegate:**

```swift
import AppsFlyerLib

func application(_ application: UIApplication, 
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // 1. Налаштування AppsFlyer
    AppsFlyerLib.shared().appsFlyerDevKey = "7R2968hheRdionPZ6xi255"
    AppsFlyerLib.shared().appleAppID = "id123456789"
    AppsFlyerLib.shared().delegate = self
    AppsFlyerLib.shared().isDebug = true
    
    return true
}

func applicationDidBecomeActive(_ application: UIApplication) {
    // 2. Запуск attribution
    AppsFlyerLib.shared().start()
}
```

**Що робить AppsFlyer SDK:**

1. **Збирає device info:**
   - IDFV: `E47A0B08-A3B3-4947-AE9E-0063A03824B1`
   - IDFA: (якщо дозволено)
   - IP address
   - User-Agent
   - Device model, OS version

2. **Відправляє на AppsFlyer сервер:**
   ```http
   POST https://api2.appsflyer.com/inappevent/id123456789
   
   {
     "appsflyer_dev_key": "7R2968hheRdionPZ6xi255",
     "bundle_id": "com.moloko.app",
     "idfv": "E47A0B08-A3B3-4947-AE9E-0063A03824B1",
     "ip": "192.168.1.1",
     "user_agent": "MyApp/1.0.0"
   }
   ```

3. **AppsFlyer matching:**
   - Порівнює device fingerprint з кліком
   - Знаходить matching click (якщо є)
   - Повертає attribution data

---

### Крок 5: AppsFlyer Attribution Callback (iOS)

**iOS код:**

```swift
extension AppDelegate: AppsFlyerLibDelegate {
    
    func onConversionDataSuccess(_ conversionInfo: [AnyHashable : Any]) {
        print("✅ AppsFlyer attribution:", conversionInfo)
        
        // conversionInfo = {
        //   "af_status": "Non-organic",
        //   "media_source": "moloco",
        //   "campaign": "casino_tier1",
        //   "af_sub1": "buyer123",
        //   "af_sub2": "US",
        //   "af_sub3": "creative1",
        //   "af_sub4": "offer_id",
        //   "af_sub5": "custom"
        // }
        
        let appsflyerId = AppsFlyerLib.shared().getAppsFlyerUID()
        // appsflyerId = "1234567890-abcdef"
        
        // Відправити на ваш сервер
        sendToAttributionServer(
            appsflyerId: appsflyerId,
            conversionData: conversionInfo
        )
    }
    
    func onConversionDataFail(_ error: Error) {
        print("❌ AppsFlyer error:", error)
    }
}
```

---

### Крок 6: Attribution Request на ваш сервер (iOS → Сервер)

**Endpoint:** `POST /api/v1/attribution/appsflyer`

**iOS SDK код:**

```swift
func sendToAttributionServer(
    appsflyerId: String,
    conversionData: [AnyHashable: Any]
) {
    let idfv = UIDevice.current.identifierForVendor?.uuidString ?? ""
    
    // Використати AttributionSDK
    AttributionSDK.shared.handleAppsFlyerAttribution(
        appsflyerId: appsflyerId,
        conversionData: conversionData as! [String: Any]
    ) { result in
        switch result {
        case .success(let attribution):
            // Отримали final_url
            if let finalUrl = attribution.finalUrl,
               let url = URL(string: finalUrl) {
                UIApplication.shared.open(url)
            }
        case .failure(let error):
            print("Error:", error)
        }
    }
}
```

**HTTP запит:**
```http
POST https://oneapps.info/api/v1/attribution/appsflyer
X-API-Key: test-key
Content-Type: application/json

{
  "appsflyer_id": "1234567890-abcdef",
  "customer_user_id": "E47A0B08-A3B3-4947-AE9E-0063A03824B1",
  "media_source": "moloco",
  "campaign": "casino_tier1",
  "af_sub1": "buyer123",
  "af_sub2": "US",
  "af_sub3": "creative1",
  "af_sub4": "offer_id",
  "af_sub5": "custom"
}
```

---

### Крок 7: AppsFlyer Attribution Processing (Сервер)

**Файл:** `src/routes/appsflyerRoutes.ts`

**Покрокова обробка:**

#### 7.1. Валідація запиту

```typescript
const {
    appsflyer_id,      // "1234567890-abcdef"
    customer_user_id,  // "E47A0B08-A3B3-4947-AE9E-0063A03824B1" (IDFV)
    media_source,      // "moloco"
    campaign,          // "casino_tier1"
    af_sub1,           // "buyer123"
    af_sub2,           // "US"
    af_sub3,           // "creative1"
    af_sub4,           // "offer_id"
    af_sub5            // "custom"
} = req.body;

if (!appsflyer_id || !customer_user_id) {
    return res.status(400).json({ 
        error: 'Missing required fields' 
    });
}
```

#### 7.2. Генерація OS User Key

```typescript
const osUserKey = generateOsUserKey(customer_user_id);
// osUserKey = "e47a0b08a3b34947ae9e0063a03824b1"
```

#### 7.3. Визначення Push Sub

```typescript
const pushSub = af_sub1 || 'organic';
// pushSub = "buyer123"
```

#### 7.4. Побудова Keitaro URL (unified helper)

```typescript
const { buildKeitaroUrl, extractAppsFlyerParams } = require('../utils/keitaroHelper');

const keitaroParams = extractAppsFlyerParams(
    appsflyer_id,
    { media_source, campaign, af_sub1, af_sub2, af_sub3, af_sub4, af_sub5 },
    osUserKey,
    { app_version: req.body.app_version }
);

const finalUrl = buildKeitaroUrl(keitaroParams, req.tenant);
```

**Результат - повний Keitaro URL:**
```
https://onebuy.pro/LNCKRd7L?
click_id=1234567890-abcdef&
external_id=1234567890-abcdef&
sub1=buyer123&
sub2=US&
sub3=creative1&
sub4=offer_id&
sub5=custom&
push=buyer123&
push_sub=buyer123&
os_user_key=e47a0b08a3b34947ae9e0063a03824b1&
af_userid=e47a0b08a3b34947ae9e0063a03824b1&
media_source=moloco&
source=moloco&
campaign=casino_tier1&
bundle=com.moloko.app&
bundle_id=com.moloko.app&
app_version=1.0.0
```

#### 7.5. Збереження Attribution в БД

```sql
INSERT INTO attributions (
  os_user_key,         -- "e47a0b08a3b34947..."
  app_id,              -- "app_moloko"
  attribution_source,  -- "appsflyer"
  click_id,            -- "1234567890-abcdef" (appsflyer_id!)
  appsflyer_id,        -- "1234567890-abcdef"
  ip_address,          -- "192.168.1.1"
  user_agent,          -- "MyApp/1.0.0"
  idfv,                -- "E47A0B08-A3B3-4947-AE9E-0063A03824B1"
  media_source,        -- "moloco"
  campaign,            -- "casino_tier1"
  push_sub,            -- "buyer123"
  final_url,           -- "https://onebuy.pro/..."
  af_sub1,             -- "buyer123"
  af_sub2,             -- "US"
  af_sub3,             -- "creative1"
  af_sub4,             -- "offer_id"
  af_sub5              -- "custom"
)
```

#### 7.6. Відповідь iOS додатку

```json
{
  "success": true,
  "attributed": true,
  "final_url": "https://onebuy.pro/LNCKRd7L?sub1=buyer123&...",
  "push_sub": "buyer123",
  "os_user_key": "e47a0b08a3b34947ae9e0063a03824b1",
  "click_id": "1234567890-abcdef",
  "campaign_data": {
    "appsflyer_id": "1234567890-abcdef",
    "media_source": "moloco",
    "campaign": "casino_tier1",
    "sub1": "buyer123",
    "sub2": "US",
    "sub3": "creative1",
    "sub4": "offer_id",
    "sub5": "custom"
  }
}
```

---

### Крок 8-11: Аналогічно Facebook

Далі flow такий самий як у Facebook:

8. **iOS відкриває Keitaro URL** → Safari
9. **Keitaro** знаходить потік по `sub1=buyer123`
10. **Redirect на оффер** → Landing page
11. **Реєстрація** → Postback

---

### Крок 12: Postback з Keitaro (AppsFlyer)

**Keitaro налаштування:**
- Event: Lead
- URL: `https://oneapps.info/api/v1/postback/appsflyer?appsflyer_id={click_id}&idfv={sub5}&event=registration`

**Keitaro відправляє:**
```
GET https://oneapps.info/api/v1/postback/appsflyer?
  appsflyer_id=1234567890-abcdef&
  idfv=E47A0B08-A3B3-4947-AE9E-0063A03824B1&
  event=registration
```

---

### Крок 13: AppsFlyer Postback Processing (Сервер)

**Endpoint:** `GET /api/v1/postback/appsflyer`

**Файл:** `src/routes/appsflyerRoutes.ts`

**Покрокова обробка:**

#### 13.1. Прийом запиту

```typescript
const {
    appsflyer_id,  // "1234567890-abcdef"
    idfv,          // "E47A0B08-A3B3-4947-AE9E-0063A03824B1"
    event,         // "registration"
    amount,        // Для deposit
    currency       // Для deposit
} = req.query;
```

#### 13.2. Валідація

```typescript
if (!appsflyer_id || !idfv || !event) {
    return res.status(400).json({ 
        error: 'Missing required parameters' 
    });
}

if (!req.tenant?.appsflyer_enabled || !req.tenant?.appsflyer_dev_key) {
    return res.status(400).json({ 
        error: 'AppsFlyer not enabled' 
    });
}
```

#### 13.3. Ініціалізація AppsFlyer Service

```typescript
const afService = new AppsFlyerEventsService(
    req.tenant.appsflyer_dev_key,  // "7R2968hheRdionPZ6xi255"
    req.tenant.bundle_id           // "com.moloko.app"
);
```

#### 13.4. Відправка події в AppsFlyer S2S API

**Для registration:**
```typescript
await afService.sendRegistration(
    appsflyer_id,  // "1234567890-abcdef"
    idfv           // "E47A0B08-A3B3-4947-AE9E-0063A03824B1"
);
```

**AppsFlyer S2S API запит:**
```http
POST https://api2.appsflyer.com/inappevent/com.moloko.app
Content-Type: application/json

{
  "appsflyer_id": "1234567890-abcdef",
  "customer_user_id": "E47A0B08-A3B3-4947-AE9E-0063A03824B1",
  "eventName": "af_complete_registration",
  "eventValue": {
    "af_content_id": "registration",
    "af_registration_method": "email"
  },
  "eventTime": "2024-02-06T16:05:00.000Z",
  "af_events_api": "true",
  "appsflyer_dev_key": "7R2968hheRdionPZ6xi255"
}
```

**Для deposit:**
```typescript
await afService.sendDeposit(
    appsflyer_id,
    idfv,
    parseFloat(amount as string),
    currency as string || 'USD'
);
```

**AppsFlyer S2S API запит:**
```http
POST https://api2.appsflyer.com/inappevent/com.moloko.app

{
  "appsflyer_id": "1234567890-abcdef",
  "customer_user_id": "E47A0B08-A3B3-4947-AE9E-0063A03824B1",
  "eventName": "af_purchase",
  "eventValue": {
    "af_revenue": 100,
    "af_currency": "USD",
    "af_content_id": "deposit",
    "af_content_type": "first_deposit"
  },
  "eventTime": "2024-02-06T16:10:00.000Z",
  "af_events_api": "true",
  "appsflyer_dev_key": "7R2968hheRdionPZ6xi255"
}
```

#### 13.5. AppsFlyer → Moloco

**AppsFlyer автоматично:**
- Отримує івент `af_complete_registration` або `af_purchase`
- Відправляє postback в Moloco/Unity/TikTok
- Moloco оптимізує кампанію на основі конверсій

---

## ✅ AppsFlyer Flow - Повний ланцюжок

```
1. Moloco Реклама → AppsFlyer Click Tracking
   ↓ (AppsFlyer зберіг: af_sub1-5, media_source, campaign)
   
2. App Store → Install
   ↓
   
3. iOS App → AppsFlyer SDK
   ↓ (AppsFlyer matching, повернув attribution)
   
4. iOS App → Ваш сервер (attribution/appsflyer)
   ↓ (зберегли: appsflyer_id як click_id, af_sub1-5, push_sub)
   
5. Server → Keitaro URL
   ↓ (побудували URL з усіма параметрами)
   
6. iOS → Safari → Keitaro
   ↓ (відкрили URL, Keitaro знайшов потік)
   
7. Keitaro → Оффер
   ↓ (redirect на landing)
   
8. User → Registration
   ↓ (заповнив форму)
   
9. Offer → Keitaro Postback
   ↓ (status=lead)
   
10. Keitaro → Server Postback (appsflyer)
    ↓ (appsflyer_id, event=registration)
    
11. Server → AppsFlyer S2S API
    ↓ (af_complete_registration)
    
12. AppsFlyer → Moloco
    ✅ (postback з конверсією)
```

---

# Ключові відмінності Facebook vs AppsFlyer

## Facebook

✅ **Click tracking через ваш сервер**
- URL в рекламі → `https://oneapps.info/t?sub1=...`
- Зберігаємо в `clicks` table
- Генеруємо `click_id` (UUID)

✅ **Attribution matching по IP**
- Шукаємо click за IP + 24 години
- Fraud detection

✅ **Facebook Conversion API**
- Відправляємо `APP_INSTALL` одразу після attribution
- Відправляємо `COMPLETE_REGISTRATION` / `PURCHASE` з postback

## AppsFlyer

✅ **Click tracking через AppsFlyer**
- URL в рекламі → `https://apps.apple.com/app/id123?af_sub1=...`
- AppsFlyer зберігає клік
- AppsFlyer генерує `appsflyer_id`

✅ **Attribution matching через AppsFlyer SDK**
- AppsFlyer SDK робить matching
- Повертає `conversionData` в callback

✅ **AppsFlyer S2S Events API**
- НЕ відправляємо install (AppsFlyer робить автоматично)
- Відправляємо `af_complete_registration` / `af_purchase` з postback
- AppsFlyer → Moloco (автоматичний postback)

---

# Що однакове для обох джерел

✅ **Keitaro URL structure** - однакові параметри
✅ **push_sub** - sub1 або af_sub1
✅ **os_user_key** - hash(IDFV)
✅ **final_url** - повертається iOS
✅ **Postback flow** - Offer → Keitaro → Server → FB/AppsFlyer
✅ **Database** - `attributions` table для обох

---

**Готово! Система повністю описана до найдрібніших деталей.** 🎉
