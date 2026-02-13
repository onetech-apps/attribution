import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Log only slow queries (>500ms)
    if (duration > 500) {
      console.log('⚠️ Slow query', { text: text.substring(0, 80), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Initialize database tables
export const initDatabase = async () => {
  try {
    // Create clicks table
    await query(`
      CREATE TABLE IF NOT EXISTS clicks (
        id SERIAL PRIMARY KEY,
        click_id VARCHAR(64) UNIQUE NOT NULL,
        app_id VARCHAR(100),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT NOT NULL,
        fbclid VARCHAR(255),
        sub1 VARCHAR(255),
        sub2 VARCHAR(255),
        sub3 VARCHAR(255),
        sub4 VARCHAR(255),
        sub5 VARCHAR(255),
        adsetid VARCHAR(255),
        fb_id VARCHAR(255),
        fb_token TEXT,
        final_url TEXT,
        attributed BOOLEAN DEFAULT FALSE,
        attributed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for clicks table
    await query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_ip_created 
      ON clicks(ip_address, created_at);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_click_id 
      ON clicks(click_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_created_at 
      ON clicks(created_at);
    `);

    // Create attributions table
    await query(`
      CREATE TABLE IF NOT EXISTS attributions (
        id SERIAL PRIMARY KEY,
        click_id VARCHAR(64),
        os_user_key VARCHAR(64) UNIQUE NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT NOT NULL,
        idfa VARCHAR(64),
        idfv VARCHAR(64),
        device_model VARCHAR(100),
        os_version VARCHAR(20),
        app_version VARCHAR(20),
        push_sub VARCHAR(255),
        final_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for attributions table
    await query(`
      CREATE INDEX IF NOT EXISTS idx_attributions_os_user_key 
      ON attributions(os_user_key);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_attributions_click_id 
      ON attributions(click_id);
    `);

    // Create api_keys table
    await query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        app_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_api_key 
      ON api_keys(api_key);
    `);

    // Create apps table (multi-tenant)
    await query(`
      CREATE TABLE IF NOT EXISTS apps (
        id SERIAL PRIMARY KEY,
        app_id VARCHAR(100) UNIQUE NOT NULL,
        domain VARCHAR(200) UNIQUE NOT NULL,
        team_id VARCHAR(20) NOT NULL,
        bundle_id VARCHAR(100) NOT NULL,
        app_name VARCHAR(200),
        api_key VARCHAR(64) UNIQUE NOT NULL,
        app_store_url TEXT,
        appsflyer_dev_key VARCHAR(100),
        appsflyer_enabled BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_apps_domain ON apps(domain);
    `);

    // Add columns that may be missing from older schemas
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS attribution_source VARCHAR(20) DEFAULT 'facebook'`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS appsflyer_id VARCHAR(100)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS media_source VARCHAR(100)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS campaign VARCHAR(255)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub1 VARCHAR(255)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub2 VARCHAR(255)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub3 VARCHAR(255)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub4 VARCHAR(255)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS af_sub5 VARCHAR(255)`);
    await query(`ALTER TABLE attributions ADD COLUMN IF NOT EXISTS app_id VARCHAR(100)`);

    // Drop legacy FK constraints that cause issues in dev (app_id='default' not in apps table)
    await query(`ALTER TABLE clicks DROP CONSTRAINT IF EXISTS clicks_app_id_fkey`);
    await query(`ALTER TABLE attributions DROP CONSTRAINT IF EXISTS attributions_app_id_fkey`);

    // Create postback_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS postback_logs (
        id SERIAL PRIMARY KEY,
        click_id VARCHAR(64),
        url TEXT,
        method VARCHAR(10),
        payload TEXT,
        response_status INTEGER,
        response_body TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_postback_logs_created 
      ON postback_logs(created_at);
    `);

    // Create error_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        stack TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_error_logs_created 
      ON error_logs(created_at);
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};
