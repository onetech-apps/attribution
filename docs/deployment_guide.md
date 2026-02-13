# Деплой Attribution System на VPS — Покрокова інструкція

## 1. Вибір VPS

### Мінімальні вимоги

| Параметр | Мінімум | Рекомендовано |
|----------|---------|---------------|
| **RAM** | 1 GB | **2 GB** |
| **CPU** | 1 vCPU | **2 vCPU** |
| **Диск** | 20 GB SSD | **40 GB SSD** |
| **ОС** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **Трафік** | 1 TB | Unlimited |

> **1 GB RAM** — вистачить до ~50K кліків/день. Node.js (~80MB) + PostgreSQL (~200MB) + Redis (~50MB) = ~400MB, решта для ОС.
>
> **2 GB RAM** — комфортно до ~500K кліків/день, є запас для пікових навантажень.

### Рекомендовані провайдери

| Провайдер | Тариф 2GB | Ціна/міс | Коментар |
|-----------|-----------|----------|----------|
| **Hetzner** | CX22 (2 vCPU, 4 GB) | ~€4.5 | 🏆 Найкращий price/performance, EU дата-центри |
| **Contabo** | VPS S (4 vCPU, 8 GB) | ~€6.5 | Багато ресурсів за ціну |
| **DigitalOcean** | Basic (1 vCPU, 2 GB) | $12 | Простий інтерфейс, добра документація |
| **Vultr** | Cloud Compute (1 vCPU, 2 GB) | $12 | Швидкий API, багато локацій |
| **OVH** | VPS Starter (2 vCPU, 2 GB) | ~€4 | Дешевий, EU |

> 💡 **Рекомендація:** Hetzner CX22 — оптимальний вибір. Якщо бюджет обмежений — Contabo.

### Вибір локації

- **Європа (Німеччина/Фінляндія)** — якщо трафік з EU
- **США (Нью-Йорк/Чикаго)** — якщо трафік з US
- Головне — ближче до джерела трафіку для мінімальної латентності редіректів

---

## 2. Початкове налаштування сервера

### 2.1. Підключення

```bash
ssh root@YOUR_SERVER_IP
```

### 2.2. Оновлення системи

```bash
apt update && apt upgrade -y
```

### 2.3. Створення користувача (не root)

```bash
adduser deploy
usermod -aG sudo deploy
```

### 2.4. SSH ключ (опціонально, але рекомендовано)

```bash
# На локальній машині:
ssh-copy-id deploy@YOUR_SERVER_IP
```

### 2.5. Базовий firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## 3. Встановлення залежностей

### 3.1. Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v  # Має показати v20.x
```

### 3.2. PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE attribution_db;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'СИЛЬНИЙ_ПАРОЛЬ_ТУТ';"
```

### 3.3. Redis

```bash
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server
redis-cli ping  # Має відповісти PONG
```

### 3.4. Nginx (reverse proxy)

```bash
apt install -y nginx
systemctl enable nginx
```

### 3.5. Certbot (SSL)

```bash
apt install -y certbot python3-certbot-nginx
```

---

## 4. Деплой коду

### 4.1. Клонування або завантаження

```bash
su - deploy
mkdir -p /home/deploy/apps
cd /home/deploy/apps

# Варіант 1: Git
git clone YOUR_REPO_URL attribution-system

# Варіант 2: SCP з локальної машини
# На локальній машині:
scp -r ./attribution-system deploy@YOUR_SERVER_IP:/home/deploy/apps/
```

### 4.2. Встановлення залежностей

```bash
cd /home/deploy/apps/attribution-system
npm install
```

### 4.3. Збірка TypeScript

```bash
npm run build
```

### 4.4. Налаштування .env

```bash
cp .env.example .env
nano .env
```

Вміст `.env` для продакшну:

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=attribution_db
DB_USER=postgres
DB_PASSWORD=СИЛЬНИЙ_ПАРОЛЬ_ТУТ

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security — ОБОВ'ЯЗКОВО ЗМІНИТИ!
API_SECRET_KEY=згенеруй_випадковий_рядок_мінімум_32_символи

# Attribution
ATTRIBUTION_WINDOW_HOURS=24
MIN_USER_AGENT_SIMILARITY=0.7

# Keitaro (якщо використовуєте)
KEITARO_CAMPAIGN_URL=https://your-keitaro-domain.com/campaign
APP_BUNDLE_ID=com.yourcompany.yourapp
```

Згенерувати секретний ключ:
```bash
openssl rand -hex 32
```

---

## 5. Налаштування PM2 (менеджер процесів)

PM2 = автоперезапуск при крашах + автостарт при ребуті сервера.

### 5.1. Встановлення

```bash
sudo npm install -g pm2
```

### 5.2. Запуск додатку

```bash
cd /home/deploy/apps/attribution-system
pm2 start dist/index.js --name "attribution" --max-memory-restart 300M
```

### 5.3. Автозапуск при ребуті

```bash
pm2 startup
# Виконати команду, яку PM2 покаже
pm2 save
```

### 5.4. Корисні команди PM2

```bash
pm2 status              # Статус всіх процесів
pm2 logs attribution    # Показати логи
pm2 restart attribution # Перезапустити
pm2 monit               # Моніторинг CPU/RAM в реальному часі
```

---

## 6. Налаштування Nginx + SSL

### 6.1. Направити домен на сервер

У DNS-налаштуваннях домену додати A-запис:

```
track.myapp.com → YOUR_SERVER_IP
```

Зачекати 5-15 хвилин на пропагацію DNS.

### 6.2. Конфігурація Nginx

```bash
sudo nano /etc/nginx/sites-available/attribution
```

Вміст:

```nginx
server {
    listen 80;
    server_name track.myapp.com;

    # Redirect tracking links (швидкий прохід)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Таймаути
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
    }

    # Обмеження доступу до дашборду (опціонально)
    # location ~ ^/(dashboard|apps|testing)\.html$ {
    #     allow YOUR_IP;
    #     deny all;
    #     proxy_pass http://127.0.0.1:3000;
    # }
}
```

### 6.3. Активувати конфігурацію

```bash
sudo ln -s /etc/nginx/sites-available/attribution /etc/nginx/sites-enabled/
sudo nginx -t          # Перевірити синтаксис
sudo systemctl reload nginx
```

### 6.4. SSL сертифікат (Let's Encrypt)

```bash
sudo certbot --nginx -d track.myapp.com
```

Certbot автоматично:
- Отримає SSL сертифікат
- Налаштує Nginx для HTTPS
- Додасть auto-renewal (автопродовження)

---

## 7. Захист дашборду

> ⚠️ **Дашборд не має автентифікації!** Обов'язково обмежте доступ.

### Варіант 1: Basic Auth (найпростіший)

```bash
# Встановити утиліту
sudo apt install -y apache2-utils

# Створити файл паролів
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Введіть пароль

# Додати в Nginx конфіг (в блок location /):
# auth_basic "Attribution Admin";
# auth_basic_user_file /etc/nginx/.htpasswd;
```

Оновлений блок Nginx:

```nginx
    # Дашборд — захищений
    location ~ ^/(dashboard|apps|testing)\.html$ {
        auth_basic "Attribution Admin";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # API admin ендпоінти — теж захищені
    location /api/v1/admin/ {
        auth_basic "Attribution Admin";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Трекінг — відкритий
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
```

### Варіант 2: IP whitelist

```nginx
    location ~ ^/(dashboard|apps|testing)\.html$ {
        allow 1.2.3.4;     # Ваш IP
        deny all;
        proxy_pass http://127.0.0.1:3000;
    }
```

---

## 8. Перевірка після деплою

### Чеклист

```bash
# 1. Перевірити що сервер працює
curl https://track.myapp.com/health
# Має повернути: {"status":"ok","timestamp":"..."}

# 2. Перевірити трекінг кліку
curl -I "https://track.myapp.com/?sub1=test&sub2=check"
# Має повернути redirect (302)

# 3. Перевірити дашборд
# Відкрити в браузері: https://track.myapp.com/dashboard.html

# 4. Перевірити логи PM2
pm2 logs attribution --lines 20

# 5. Перевірити PostgreSQL
sudo -u postgres psql -d attribution_db -c "SELECT COUNT(*) FROM clicks;"
```

---

## 9. Оновлення коду

```bash
cd /home/deploy/apps/attribution-system

# Завантажити нову версію
git pull
# або scp нових файлів

# Перезбірка
npm install
npm run build

# Перезапуск
pm2 restart attribution
```

---

## 10. Бекапи БД

### Автоматичний щоденний бекап

```bash
sudo nano /etc/cron.d/attribution-backup
```

```cron
0 3 * * * deploy pg_dump -U postgres attribution_db | gzip > /home/deploy/backups/attribution_$(date +\%Y\%m\%d).sql.gz
```

```bash
mkdir -p /home/deploy/backups
```

### Ручний бекап

```bash
pg_dump -U postgres attribution_db > backup.sql
```

### Відновлення

```bash
psql -U postgres attribution_db < backup.sql
```

---

## Коротка послідовність дій

```
1. Купити VPS (Hetzner CX22, ~€4.5/міс)
2. Підключитись по SSH
3. apt update && apt upgrade
4. Встановити: Node.js 20, PostgreSQL, Redis, Nginx
5. Створити базу: attribution_db
6. Завантажити код, npm install, npm run build
7. Налаштувати .env (ОБОВ'ЯЗКОВО змінити API_SECRET_KEY!)
8. Запустити через PM2
9. Направити домен → IP сервера (A-запис)
10. Налаштувати Nginx → proxy на порт 3000
11. Отримати SSL через certbot
12. Захистити дашборд (Basic Auth або IP whitelist)
13. Перевірити /health та дашборд
14. Налаштувати бекапи
```
