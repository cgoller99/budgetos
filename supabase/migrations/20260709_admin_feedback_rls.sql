-- Enable RLS on admin feedback (policies existed but RLS was never turned on)

ALTER TABLE public.admin_feedback_reports ENABLE ROW LEVEL SECURITY;
