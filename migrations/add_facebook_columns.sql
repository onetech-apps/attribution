-- Add Facebook Pixel credentials columns to clicks table
ALTER TABLE clicks 
ADD COLUMN IF NOT EXISTS fb_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS fb_token TEXT;
