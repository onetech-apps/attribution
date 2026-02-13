-- AppsFlyer Integration
-- Add AppsFlyer support to apps table and attributions

-- 1. Add AppsFlyer configuration to apps table
ALTER TABLE apps ADD COLUMN IF NOT EXISTS appsflyer_dev_key VARCHAR(100);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS appsflyer_enabled BOOLEAN DEFAULT FALSE;

-- 2. Add AppsFlyer fields to attributions table
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS attribution_source VARCHAR(20) DEFAULT 'facebook';
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS appsflyer_id VARCHAR(100);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS media_source VARCHAR(100);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS campaign VARCHAR(255);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub1 VARCHAR(255);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub2 VARCHAR(255);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub3 VARCHAR(255);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub4 VARCHAR(255);
ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub5 VARCHAR(255);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attributions_appsflyer_id ON attributions(appsflyer_id);
CREATE INDEX IF NOT EXISTS idx_attributions_source ON attributions(attribution_source);
CREATE INDEX IF NOT EXISTS idx_attributions_media_source ON attributions(media_source);

-- 4. Add comments
COMMENT ON COLUMN apps.appsflyer_dev_key IS 'AppsFlyer Developer Key';
COMMENT ON COLUMN apps.appsflyer_enabled IS 'Enable AppsFlyer attribution for this app';
COMMENT ON COLUMN attributions.attribution_source IS 'Attribution source: facebook or appsflyer';
COMMENT ON COLUMN attributions.appsflyer_id IS 'AppsFlyer Device ID';
COMMENT ON COLUMN attributions.media_source IS 'Media source: moloco, unity, tiktok, google, etc';
COMMENT ON COLUMN attributions.campaign IS 'Campaign name from AppsFlyer';
