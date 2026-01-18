-- Migration: Remove per-user auth, add shared owner profiles
-- Run this in Supabase SQL Editor

-- 1. Create owners table (replaces auth-based users)
CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_master BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Modify portfolios table: remove user_id, add owner_ids array
-- First, add the new column
ALTER TABLE portfolios
ADD COLUMN IF NOT EXISTS owner_ids UUID[] DEFAULT '{}';

-- Drop the user_id foreign key constraint if it exists
ALTER TABLE portfolios
DROP CONSTRAINT IF EXISTS portfolios_user_id_fkey;

-- Make user_id nullable (we'll keep it for backwards compatibility but not use it)
ALTER TABLE portfolios
ALTER COLUMN user_id DROP NOT NULL;

-- 3. Create app_settings table (replaces per-user settings)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  auto_refresh_enabled BOOLEAN DEFAULT TRUE,
  refresh_interval_seconds INTEGER DEFAULT 30,
  metrics_mode TEXT DEFAULT 'simple' CHECK (metrics_mode IN ('simple', 'pro')),
  currency TEXT DEFAULT 'USD',
  risk_free_rate NUMERIC DEFAULT 0.05,
  active_portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO app_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- 4. Create tracked_symbols table (for Quick Overview)
CREATE TABLE IF NOT EXISTS tracked_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT DEFAULT 'stock' CHECK (asset_type IN ('stock', 'crypto')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol, asset_type)
);

-- 5. Disable RLS on all tables (no per-user auth anymore)
ALTER TABLE portfolios DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE owners DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_symbols DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can insert own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can update own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can delete own portfolios" ON portfolios;

DROP POLICY IF EXISTS "Users can view accounts in own portfolios" ON accounts;
DROP POLICY IF EXISTS "Users can insert accounts in own portfolios" ON accounts;
DROP POLICY IF EXISTS "Users can update accounts in own portfolios" ON accounts;
DROP POLICY IF EXISTS "Users can delete accounts in own portfolios" ON accounts;

DROP POLICY IF EXISTS "Users can view transactions in own portfolios" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions in own portfolios" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in own portfolios" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in own portfolios" ON transactions;

-- 6. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_owners_updated_at ON owners;
CREATE TRIGGER update_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Grant public access (anon key can read/write everything)
GRANT ALL ON owners TO anon;
GRANT ALL ON portfolios TO anon;
GRANT ALL ON accounts TO anon;
GRANT ALL ON transactions TO anon;
GRANT ALL ON app_settings TO anon;
GRANT ALL ON tracked_symbols TO anon;
