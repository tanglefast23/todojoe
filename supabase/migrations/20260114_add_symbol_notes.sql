-- Migration: Add symbol_notes table for per-holding notes
-- Run this in your Supabase SQL Editor to enable cloud sync for notes

CREATE TABLE IF NOT EXISTS symbol_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto')),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one note per symbol per portfolio per asset type
  UNIQUE (portfolio_id, symbol, asset_type)
);

-- Index for faster lookups by portfolio
CREATE INDEX IF NOT EXISTS idx_symbol_notes_portfolio ON symbol_notes(portfolio_id);

-- Index for faster lookups by symbol
CREATE INDEX IF NOT EXISTS idx_symbol_notes_symbol ON symbol_notes(symbol);

-- Enable RLS (Row Level Security) - allow all for now since this is a shared app
ALTER TABLE symbol_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (no auth in this app)
CREATE POLICY "Allow all operations on symbol_notes"
  ON symbol_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_symbol_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER symbol_notes_updated_at
  BEFORE UPDATE ON symbol_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_symbol_notes_updated_at();
