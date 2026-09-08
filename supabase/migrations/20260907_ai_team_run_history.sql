-- Durable, server-only AI Team plan history.

CREATE TABLE IF NOT EXISTS public.ai_team_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  goal text NOT NULL CHECK (char_length(goal) BETWEEN 3 AND 1000),
  source text NOT NULL CHECK (source IN ('ai', 'fallback')),
  model text CHECK (model IS NULL OR char_length(model) BETWEEN 1 AND 200),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 2000),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_team_runs_created_at_idx
  ON public.ai_team_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_team_runs_created_by_idx
  ON public.ai_team_runs (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_team_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ai_team_runs (id) ON DELETE CASCADE,
  owner text NOT NULL CHECK (
    owner IN ('chief_of_staff', 'engineering', 'qa', 'analytics')
  ),
  status text NOT NULL CHECK (
    status IN ('queued', 'running', 'needs_approval', 'completed', 'failed')
  ),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  objective text NOT NULL CHECK (char_length(objective) BETWEEN 3 AND 600),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence) = 'array'),
  requires_approval boolean NOT NULL DEFAULT false,
  approval_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_team_tasks_approval_reason_length_check CHECK (
    approval_reason IS NULL OR char_length(approval_reason) BETWEEN 1 AND 300
  ),
  CONSTRAINT ai_team_tasks_requires_approval_reason_check CHECK (
    NOT requires_approval OR approval_reason IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ai_team_tasks_run_id_idx
  ON public.ai_team_tasks (run_id, created_at, id);

CREATE INDEX IF NOT EXISTS ai_team_tasks_requires_approval_idx
  ON public.ai_team_tasks (run_id)
  WHERE requires_approval = true;

ALTER TABLE public.ai_team_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_team_tasks ENABLE ROW LEVEL SECURITY;

-- These tables are intentionally available only through the server-side
-- service-role client. No RLS policies are created.
REVOKE ALL ON public.ai_team_runs FROM anon, authenticated;
REVOKE ALL ON public.ai_team_tasks FROM anon, authenticated;
