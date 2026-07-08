-- Enable RLS on admin feedback (policies existed but RLS was never turned on).
-- Safe to re-run.

ALTER TABLE public.admin_feedback_reports ENABLE ROW LEVEL SECURITY;

-- Defense in depth: authenticated users may only insert/select their own rows
-- (policies created in 20260705_admin_dashboard.sql).
DROP POLICY IF EXISTS admin_feedback_reports_insert_own ON public.admin_feedback_reports;
CREATE POLICY admin_feedback_reports_insert_own
  ON public.admin_feedback_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_feedback_reports_select_own ON public.admin_feedback_reports;
CREATE POLICY admin_feedback_reports_select_own
  ON public.admin_feedback_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Remove broad table grants from anon (RLS alone is not always enough if grants exist).
REVOKE ALL ON public.admin_feedback_reports FROM anon;
