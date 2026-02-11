-- JV Tables Migration
-- Creates the jv_tasks and jv_scheduled_events tables used by the app.
-- These are the actual tables referenced by the TypeScript code.

-- JV Tasks table
CREATE TABLE IF NOT EXISTS jv_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'regular' CHECK (priority IN ('regular', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  attachment_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- JV Scheduled Events table
CREATE TABLE IF NOT EXISTS jv_scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  source TEXT NOT NULL DEFAULT 'local',
  google_event_id TEXT,
  google_calendar_id TEXT,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jv_tasks_status ON jv_tasks(status);
CREATE INDEX IF NOT EXISTS idx_jv_tasks_created_at ON jv_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jv_scheduled_events_status ON jv_scheduled_events(status);
CREATE INDEX IF NOT EXISTS idx_jv_scheduled_events_scheduled_at ON jv_scheduled_events(scheduled_at);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_jv_tasks_updated_at ON jv_tasks;
CREATE TRIGGER update_jv_tasks_updated_at
  BEFORE UPDATE ON jv_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jv_scheduled_events_updated_at ON jv_scheduled_events;
CREATE TRIGGER update_jv_scheduled_events_updated_at
  BEFORE UPDATE ON jv_scheduled_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
