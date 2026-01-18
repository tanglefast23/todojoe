-- Migration: Add per-owner personalization tables
-- Run this in Supabase SQL Editor after 002_shared_data_schema.sql

-- =====================================================
-- 1. OWNER DASHBOARDS (per-owner widget layouts)
-- =====================================================
CREATE TABLE IF NOT EXISTS owner_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  widgets JSONB NOT NULL DEFAULT '[]',
  layouts JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

-- =====================================================
-- 2. OWNER SETTINGS (per-owner preferences)
-- Each owner has their own settings (refresh rate, currency, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS owner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  auto_refresh_enabled BOOLEAN DEFAULT TRUE,
  refresh_interval_seconds INTEGER DEFAULT 30,
  metrics_mode TEXT DEFAULT 'simple' CHECK (metrics_mode IN ('simple', 'pro')),
  currency TEXT DEFAULT 'CAD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

-- =====================================================
-- 3. SELL PLANS (per-owner planned trades)
-- Each owner has their own buy/sell plans
-- =====================================================
CREATE TABLE IF NOT EXISTS sell_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto')),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('sell', 'buy')),
  target_quantity NUMERIC,
  target_price NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by owner
CREATE INDEX IF NOT EXISTS idx_sell_plans_owner_id ON sell_plans(owner_id);
CREATE INDEX IF NOT EXISTS idx_sell_plans_portfolio_id ON sell_plans(portfolio_id);

-- =====================================================
-- 4. TAGS (shared across all owners)
-- Tags can be applied to transactions for categorization
-- =====================================================
-- First, check if table exists and add missing columns/constraints
DO $$
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6B7280',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Add is_default column if it doesn't exist (for existing tables)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tags' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE tags ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tags' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE tags ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tags' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tags ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add unique constraint on name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tags' AND constraint_type = 'UNIQUE'
    AND constraint_name = 'tags_name_key'
  ) THEN
    -- First check if there are duplicates and remove them
    DELETE FROM tags a USING tags b
    WHERE a.id > b.id AND a.name = b.name;
    -- Then add the unique constraint
    ALTER TABLE tags ADD CONSTRAINT tags_name_key UNIQUE (name);
  END IF;
END $$;

-- Note: Default tags insertion skipped - existing table may have different schema
-- Tags will be synced from the app's local store

-- =====================================================
-- 5. UPDATED_AT TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS update_owner_dashboards_updated_at ON owner_dashboards;
CREATE TRIGGER update_owner_dashboards_updated_at
  BEFORE UPDATE ON owner_dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_owner_settings_updated_at ON owner_settings;
CREATE TRIGGER update_owner_settings_updated_at
  BEFORE UPDATE ON owner_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sell_plans_updated_at ON sell_plans;
CREATE TRIGGER update_sell_plans_updated_at
  BEFORE UPDATE ON sell_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. DISABLE RLS (household trust model)
-- =====================================================
ALTER TABLE owner_dashboards DISABLE ROW LEVEL SECURITY;
ALTER TABLE owner_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE sell_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. GRANT PUBLIC ACCESS
-- =====================================================
GRANT ALL ON owner_dashboards TO anon;
GRANT ALL ON owner_settings TO anon;
GRANT ALL ON sell_plans TO anon;
GRANT ALL ON tags TO anon;

-- =====================================================
-- 8. CLEANUP: Drop old app_settings if migrating
-- (Keep commented out - run manually after verifying data migration)
-- =====================================================
-- DROP TABLE IF EXISTS app_settings;
