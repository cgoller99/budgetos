-- AI Mission Control V4: safe, user-scoped operational activity stream.
-- This migration is additive. Activity is written and read through protected
-- admin APIs using the service-role client.

CREATE TABLE public.ai_team_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  created_by uuid NOT NULL,
  run_id uuid NULL REFERENCES public.ai_team_runs (id) ON DELETE SET NULL,
  agent_id text NULL
    CHECK (
      agent_id IN (
        'chief_of_staff',
        'engineering',
        'qa',
        'analytics',
        'product',
        'growth',
        'customer',
        'critic'
      )
    ),
  phase text NOT NULL CHECK (char_length(phase) BETWEEN 1 AND 80),
  status text NOT NULL
    CHECK (status IN ('pending', 'running', 'completed', 'warning', 'failed')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  detail text NULL CHECK (detail IS NULL OR char_length(detail) <= 1000),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, operation_id, ordinal)
);

CREATE INDEX ai_team_activity_events_operation_ordinal_idx
  ON public.ai_team_activity_events (operation_id, ordinal);
CREATE INDEX ai_team_activity_events_created_by_created_idx
  ON public.ai_team_activity_events (created_by, created_at DESC);
CREATE INDEX ai_team_activity_events_run_idx
  ON public.ai_team_activity_events (run_id);

ALTER TABLE public.ai_team_activity_events ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies are created. The protected admin API scopes
-- service-role reads and updates to the authenticated administrator.
REVOKE ALL ON public.ai_team_activity_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_team_activity_events TO service_role;
