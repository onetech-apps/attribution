-- Unified Attribution Parameters Migration
-- Додає поля для уніфікації Facebook та AppsFlyer attribution

-- 1. Додати click_id для AppsFlyer (буде містити appsflyer_id)
ALTER TABLE attributions 
ADD COLUMN IF NOT EXISTS click_id VARCHAR(64);

-- 2. Додати push_sub для уніфікації (замість окремого поля)
-- Це буде містити sub1 для FB або af_sub1 для AppsFlyer
ALTER TABLE attributions 
ADD COLUMN IF NOT EXISTS push_sub VARCHAR(255);

-- 3. Додати app_id для multi-tenant підтримки
ALTER TABLE attributions 
ADD COLUMN IF NOT EXISTS app_id VARCHAR(50) DEFAULT 'default';

-- 4. Створити індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_attributions_click_id_unified 
ON attributions(click_id) WHERE click_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attributions_app_id 
ON attributions(app_id);

CREATE INDEX IF NOT EXISTS idx_attributions_push_sub 
ON attributions(push_sub) WHERE push_sub IS NOT NULL;

-- 5. Додати коментарі для документації
COMMENT ON COLUMN attributions.click_id IS 
'Unified click ID: clicks.click_id для Facebook, appsflyer_id для AppsFlyer';

COMMENT ON COLUMN attributions.push_sub IS 
'Unified push sub parameter: sub1 для Facebook, af_sub1 для AppsFlyer, або organic';

COMMENT ON COLUMN attributions.app_id IS 
'Multi-tenant app identifier';

-- 6. Міграція існуючих даних (якщо є)
-- Для Facebook attribution: копіювати push_sub якщо вже існує
UPDATE attributions 
SET click_id = (
    SELECT click_id FROM clicks 
    WHERE clicks.click_id = attributions.click_id
)
WHERE attribution_source = 'facebook' 
AND click_id IS NULL;

-- Для AppsFlyer: використати appsflyer_id як click_id
UPDATE attributions 
SET click_id = appsflyer_id
WHERE attribution_source = 'appsflyer' 
AND appsflyer_id IS NOT NULL 
AND click_id IS NULL;

-- Успішно виконано
SELECT 'Migration completed successfully' AS status;
