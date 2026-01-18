-- Migration: Create separate todo_owners table for TODO app
-- This allows the TODO app to have independent users from the investment tracker
-- Both apps share the same Supabase database but have separate user lists
-- Run this in Supabase SQL Editor

-- Create todo_owners table (mirrors owners structure but is separate)
CREATE TABLE IF NOT EXISTS todo_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',  -- Empty for non-admin accounts
  is_master BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow all operations (no per-user auth)
ALTER TABLE todo_owners ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public access pattern for household app)
CREATE POLICY "Allow all todo_owners operations" ON todo_owners
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_todo_owners_is_master ON todo_owners(is_master);
CREATE INDEX IF NOT EXISTS idx_todo_owners_created_at ON todo_owners(created_at);
