-- TODO App Tables Migration
-- Run this in Supabase SQL Editor to add tables for the TODO app

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'regular' CHECK (priority IN ('regular', 'urgent')),
  created_by UUID REFERENCES owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_by UUID REFERENCES owners(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Running Tab (singleton for household balance)
CREATE TABLE IF NOT EXISTS running_tab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initial_balance NUMERIC(15, 0) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15, 0) NOT NULL DEFAULT 0,
  initialized_by UUID REFERENCES owners(id) ON DELETE SET NULL,
  initialized_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC(15, 0) NOT NULL,
  created_by UUID REFERENCES owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES owners(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  attachment_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tab History (audit log)
CREATE TABLE IF NOT EXISTS tab_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('initial', 'add', 'expense_approved', 'expense_rejected')),
  amount NUMERIC(15, 0) NOT NULL,
  description TEXT,
  related_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  created_by UUID REFERENCES owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Permissions (extends owner capabilities)
CREATE TABLE IF NOT EXISTS app_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE UNIQUE,
  can_complete_tasks BOOLEAN DEFAULT false,
  can_approve_expenses BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_tab_history_created_at ON tab_history(created_at DESC);

-- Disable RLS on new tables (consistent with existing schema)
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE running_tab DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE tab_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_permissions DISABLE ROW LEVEL SECURITY;

-- Grant public access (anon key can read/write everything)
GRANT ALL ON tasks TO anon;
GRANT ALL ON running_tab TO anon;
GRANT ALL ON expenses TO anon;
GRANT ALL ON tab_history TO anon;
GRANT ALL ON app_permissions TO anon;

-- Add updated_at triggers for new tables
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_running_tab_updated_at ON running_tab;
CREATE TRIGGER update_running_tab_updated_at
  BEFORE UPDATE ON running_tab
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_permissions_updated_at ON app_permissions;
CREATE TRIGGER update_app_permissions_updated_at
  BEFORE UPDATE ON app_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
