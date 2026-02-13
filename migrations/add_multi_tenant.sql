-- Multi-tenant support: Apps table (simplified)
CREATE TABLE IF NOT EXISTS apps (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(200) UNIQUE NOT NULL,
    team_id VARCHAR(20) NOT NULL,  -- Apple Developer Team ID (для AASA)
    bundle_id VARCHAR(100) NOT NULL,
    app_name VARCHAR(200),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    app_store_url TEXT,  -- Посилання на App Store для конкретного додатку
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add app_id to clicks (no FK constraint - app may not exist in dev mode)
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS app_id VARCHAR(100);

-- Add app_id to attributions (no FK constraint - app may not exist in dev mode)
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS app_id VARCHAR(100);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_apps_domain ON apps(domain);
CREATE INDEX IF NOT EXISTS idx_clicks_app_id ON clicks(app_id);
CREATE INDEX IF NOT EXISTS idx_attributions_app_id ON attributions(app_id);

-- Insert example apps
INSERT INTO apps (app_id, domain, team_id, bundle_id, app_name, api_key, app_store_url)
VALUES 
    ('com.company.app-a', '1king.genuoh.shop', 'ABC123DEF4', 'com.company.app-a', 'App A', 'app_a_key_12345', 'https://apps.apple.com/app/id123456'),
    ('com.company.app-b', 'app-b-track.com', 'ABC123DEF4', 'com.company.app-b', 'App B', 'app_b_key_67890', 'https://apps.apple.com/app/id789012')
ON CONFLICT (app_id) DO NOTHING;

-- Якщо таблиця вже існує з keitaro_url, видаляємо цю колонку
ALTER TABLE apps DROP COLUMN IF EXISTS keitaro_url;
