-- Admin dashboard: profile flags, feedback queue, event logs

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_founder_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_active_at_idx
  ON public.profiles (last_active_at DESC);

CREATE INDEX IF NOT EXISTS profiles_is_disabled_idx
  ON public.profiles (is_disabled)
  WHERE is_disabled = true;

CREATE TABLE IF NOT EXISTS public.admin_feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  report_type text NOT NULL CHECK (report_type IN ('feedback', 'bug')),
  message text NOT NULL,
  screenshot_url text,
  browser text,
  page_path text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'investigating', 'fixed', 'closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_feedback_reports_status_idx
  ON public.admin_feedback_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_feedback_reports_user_idx
  ON public.admin_feedback_reports (user_id);

CREATE TABLE IF NOT EXISTS public.admin_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (
    event_type IN ('error', 'stripe', 'plaid', 'auth', 'api_failure')
  ),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_event_logs_created_at_idx
  ON public.admin_event_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_event_logs_event_type_idx
  ON public.admin_event_logs (event_type, created_at DESC);

ALTER TABLE public.admin_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_feedback_reports_insert_own
  ON public.admin_feedback_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY admin_feedback_reports_select_own
  ON public.admin_feedback_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin API uses service role only for cross-user reads/writes on logs.
