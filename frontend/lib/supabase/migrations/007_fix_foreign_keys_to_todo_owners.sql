-- Migration: Fix foreign keys to reference todo_owners instead of owners
-- The TODO app uses todo_owners table, not the investment tracker's owners table
-- This fixes the cross-device sync issue where inserts fail due to FK violations
-- Run this in Supabase SQL Editor

-- First, ensure todo_owners table exists (from migration 006)
-- If not, the foreign key changes will fail

-- Drop existing foreign key constraints on tasks table
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_completed_by_fkey;

-- Drop existing foreign key constraints on running_tab table
ALTER TABLE running_tab DROP CONSTRAINT IF EXISTS running_tab_initialized_by_fkey;

-- Drop existing foreign key constraints on expenses table
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_approved_by_fkey;

-- Drop existing foreign key constraints on tab_history table
ALTER TABLE tab_history DROP CONSTRAINT IF EXISTS tab_history_created_by_fkey;

-- Drop existing foreign key constraints on app_permissions table
ALTER TABLE app_permissions DROP CONSTRAINT IF EXISTS app_permissions_owner_id_fkey;

-- Add new foreign key constraints pointing to todo_owners
-- tasks table
ALTER TABLE tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES todo_owners(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES todo_owners(id) ON DELETE SET NULL;

-- running_tab table
ALTER TABLE running_tab
  ADD CONSTRAINT running_tab_initialized_by_fkey
  FOREIGN KEY (initialized_by) REFERENCES todo_owners(id) ON DELETE SET NULL;

-- expenses table
ALTER TABLE expenses
  ADD CONSTRAINT expenses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES todo_owners(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES todo_owners(id) ON DELETE SET NULL;

-- tab_history table
ALTER TABLE tab_history
  ADD CONSTRAINT tab_history_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES todo_owners(id) ON DELETE SET NULL;

-- app_permissions table
-- Note: This one is NOT NULL and CASCADE, different from others
ALTER TABLE app_permissions
  ADD CONSTRAINT app_permissions_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES todo_owners(id) ON DELETE CASCADE;

-- Verify the changes
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM
  information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('tasks', 'running_tab', 'expenses', 'tab_history', 'app_permissions');
