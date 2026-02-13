# Attribution System

Система атрибуції для iOS додатків (заміна AppsFlyer).

## Технологічний стек

- **Backend:** Node.js + TypeScript + Express
- **Database:** PostgreSQL
- **Cache:** Redis
- **Runtime:** Node.js 18+

## Встановлення

### 1. Клонування репозиторію

```bash
git clone <repository-url>
cd attribution-system
```

### 2. Встановлення залежностей

```bash
npm install
```

### 3. Налаштування бази даних

Встановіть PostgreSQL та створіть базу даних:

```bash
# PostgreSQL
createdb attribution_db
```

### 4. Налаштування Redis

Встановіть та запустіть Redis:

```bash
# Windows (через WSL або Docker)
docker run -d -p 6379:6379 redis

# Linux/Mac
redis-server
```

### 5. Конфігурація

Створіть файл `.env` на основі `.env.example`:

```bash
cp .env.example .env
```

Відредагуйте `.env` та вкажіть свої налаштування:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=attribution_db
DB_USER=postgres
DB_PASSWORD=your_password
```

## Запуск

### Development режим

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

## API Endpoints

### 1. Click Tracking (публічний)

```
GET /api/v1/track/click?fbclid=test123&sub1=campaign1&sub2=value2
```

**Параметри:**
- `fbclid` - Facebook Click ID
- `sub1`, `sub2`, `sub3`, `sub4`, `sub5` - Субпараметри кампанії
- `adsetid` - ID рекламного набору
- `final_url` - Фінальний URL (опціонально)

**Відповідь:** Редирект на App Store

### 2. Attribution API (потребує API key)

```
POST /api/v1/attribution
Headers: X-API-Key: your_api_key
Content-Type: application/json

{
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0...)",
  "idfv": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  "idfa": "optional",
  "app_version": "1.0.0",
  "os_version": "16.0",
  "device_model": "iPhone14,2"
}
```

**Відповідь:**

```json
{
  "success": true,
  "attributed": true,
  "final_url": "https://example.com/offer",
  "push_sub": "campaign1",
  "os_user_key": "generated_md5_hash",
  "click_id": "clk_abc123",
  "campaign_data": {
    "fbclid": "test123",
    "sub1": "campaign1",
    "sub2": "value2"
  }
}
```

### 3. Statistics

```
GET /api/v1/clicks/stats
GET /api/v1/attribution/stats
```

## Створення API ключа

Підключіться до бази даних та виконайте:

```sql
INSERT INTO api_keys (app_name, api_key, active)
VALUES ('iOS App', 'your_generated_api_key_here', true);
```

Або використайте Node.js:

```javascript
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('hex');
console.log('API Key:', apiKey);
```

## Структура проекту

```
attribution-system/
├── src/
│   ├── config/          # Конфігурація (DB, Redis)
│   ├── controllers/     # API контролери
│   ├── middleware/      # Express middleware
│   ├── models/          # Моделі даних
│   ├── routes/          # API роути
│   ├── services/        # Бізнес-логіка
│   ├── types/           # TypeScript типи
│   ├── utils/           # Утиліти
│   └── index.ts         # Точка входу
├── dist/                # Скомпільований код
├── .env                 # Змінні оточення
├── package.json
└── tsconfig.json
```

## Тестування

### Тест click tracking

```bash
curl "http://localhost:3000/api/v1/track/click?fbclid=test123&sub1=campaign1"
```

### Тест attribution

```bash
curl -X POST http://localhost:3000/api/v1/attribution \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    "idfv": "test-idfv-12345",
    "app_version": "1.0.0",
    "os_version": "16.0",
    "device_model": "iPhone14,2"
  }'
```

## Deployment

Дивіться документацію в `implementation_plan.md` для інструкцій з розгортання на VPS/VDS.

## License

ISC
