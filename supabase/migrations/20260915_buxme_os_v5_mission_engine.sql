-- Buxme OS V5.1: persistent, server-admin-only mission engine.
-- Additive only. No client role receives a policy or table privilege.

CREATE TABLE public.ai_team_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  run_id uuid NULL REFERENCES public.ai_team_runs (id) ON DELETE SET NULL,
  operation_id uuid NOT NULL,
  command text NOT NULL CHECK (char_length(command) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'received'
    CHECK (
      status IN (
        'received',
        'planning',
        'running',
        'waiting_approval',
        'verifying',
        'completed',
        'partial',
        'failed',
        'stopped'
      )
    ),
  autonomy_level text NOT NULL DEFAULT 'assist'
    CHECK (autonomy_level IN ('observe', 'assist', 'act', 'autopilot')),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  stop_requested_at timestamptz NULL,
  elapsed_ms integer NULL CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
  verified boolean NOT NULL DEFAULT false,
  final_report jsonb NULL
    CHECK (final_report IS NULL OR jsonb_typeof(final_report) = 'object'),
  context jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(context) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, created_by),
  UNIQUE (created_by, operation_id)
);

CREATE INDEX ai_team_missions_owner_created_idx
  ON public.ai_team_missions (created_by, created_at DESC);
CREATE INDEX ai_team_missions_owner_status_idx
  ON public.ai_team_missions (created_by, status, updated_at DESC);
CREATE INDEX ai_team_missions_run_idx
  ON public.ai_team_missions (run_id)
  WHERE run_id IS NOT NULL;

CREATE TABLE public.ai_team_mission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL,
  created_by uuid NOT NULL,
  phase text NOT NULL CHECK (char_length(phase) BETWEEN 1 AND 80),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
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
  tool_name text NULL
    CHECK (tool_name IS NULL OR char_length(tool_name) BETWEEN 1 AND 100),
  status text NOT NULL
    CHECK (
      status IN (
        'pending',
        'running',
        'completed',
        'warning',
        'failed',
        'stopped'
      )
    ),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 160),
  detail text NULL CHECK (detail IS NULL OR char_length(detail) <= 1000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mission_id, created_by)
    REFERENCES public.ai_team_missions (id, created_by) ON DELETE CASCADE,
  UNIQUE (mission_id, ordinal)
);

CREATE INDEX ai_team_mission_events_owner_mission_ordinal_idx
  ON public.ai_team_mission_events (created_by, mission_id, ordinal);
CREATE INDEX ai_team_mission_events_owner_created_idx
  ON public.ai_team_mission_events (created_by, created_at DESC);

CREATE TABLE public.ai_team_mission_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL,
  created_by uuid NOT NULL,
  target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 60),
  target_ref text NOT NULL CHECK (char_length(target_ref) BETWEEN 1 AND 500),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  before_snapshot jsonb NULL,
  after_snapshot jsonb NULL,
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mission_id, created_by)
    REFERENCES public.ai_team_missions (id, created_by) ON DELETE CASCADE
);

CREATE INDEX ai_team_mission_changes_owner_mission_created_idx
  ON public.ai_team_mission_changes (created_by, mission_id, created_at);

CREATE TABLE public.ai_team_mission_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL,
  created_by uuid NOT NULL,
  check_type text NOT NULL CHECK (char_length(check_type) BETWEEN 1 AND 100),
  status text NOT NULL
    CHECK (status IN ('passed', 'failed', 'not_applicable')),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (mission_id, created_by)
    REFERENCES public.ai_team_missions (id, created_by) ON DELETE CASCADE,
  UNIQUE (mission_id, check_type)
);

CREATE INDEX ai_team_mission_verifications_owner_mission_created_idx
  ON public.ai_team_mission_verifications (created_by, mission_id, created_at);

ALTER TABLE public.ai_team_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_team_mission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_team_mission_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_team_mission_verifications ENABLE ROW LEVEL SECURITY;

-- Deliberately no anon/authenticated policies. Protected admin routes use the
-- service-role client and every query is additionally scoped by created_by.
REVOKE ALL ON public.ai_team_missions
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.ai_team_mission_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.ai_team_mission_changes
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.ai_team_mission_verifications
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.ai_team_missions TO service_role;
GRANT SELECT, INSERT ON public.ai_team_mission_events TO service_role;
GRANT SELECT, INSERT ON public.ai_team_mission_changes TO service_role;
GRANT SELECT, INSERT ON public.ai_team_mission_verifications TO service_role;
