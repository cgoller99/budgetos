-- Beta readiness: extended feedback, beta management, guided onboarding progress

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS beta_status text NOT NULL DEFAULT 'approved'
    CHECK (beta_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS profiles_beta_status_idx
  ON public.profiles (beta_status);

ALTER TABLE public.admin_feedback_reports
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS recording_url text;

ALTER TABLE public.admin_feedback_reports
  DROP CONSTRAINT IF EXISTS admin_feedback_reports_status_check;

ALTER TABLE public.admin_feedback_reports
  ADD CONSTRAINT admin_feedback_reports_status_check
  CHECK (status IN ('new', 'investigating', 'planned', 'in_progress', 'completed', 'closed'));

ALTER TABLE public.admin_feedback_reports
  DROP CONSTRAINT IF EXISTS admin_feedback_reports_report_type_check;

ALTER TABLE public.admin_feedback_reports
  ADD CONSTRAINT admin_feedback_reports_report_type_check
  CHECK (report_type IN ('feedback', 'bug', 'feature_request'));

CREATE INDEX IF NOT EXISTS admin_feedback_reports_type_idx
  ON public.admin_feedback_reports (report_type, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_feedback_reports_message_idx
  ON public.admin_feedback_reports USING gin (to_tsvector('english', coalesce(message, '')));

CREATE TABLE IF NOT EXISTS public.beta_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  invite_only boolean NOT NULL DEFAULT false,
  max_beta_users integer,
  waitlist_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.beta_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.beta_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  source text NOT NULL DEFAULT 'beta_page',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS beta_waitlist_email_lower_idx
  ON public.beta_waitlist (lower(email));

CREATE INDEX IF NOT EXISTS beta_waitlist_status_idx
  ON public.beta_waitlist (status, created_at DESC);

ALTER TABLE public.beta_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_waitlist ENABLE ROW LEVEL SECURITY;

-- Public waitlist signup via API (service role). No direct client policies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY feedback_attachments_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY feedback_attachments_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
