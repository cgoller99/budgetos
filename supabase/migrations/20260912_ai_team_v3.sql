-- AI Mission Control V3: approved execution staging and founder daily briefs.
-- This migration is additive. Both tables remain behind the service-role boundary.

CREATE TABLE public.ai_team_execution_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.ai_team_tasks (id) ON DELETE RESTRICT,
  run_id uuid NOT NULL REFERENCES public.ai_team_runs (id) ON DELETE RESTRICT,
  approval_decision_id uuid NOT NULL UNIQUE
    REFERENCES public.ai_team_approval_decisions (id) ON DELETE RESTRICT,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'claimed', 'completed', 'failed')),
  task_snapshot jsonb NOT NULL CHECK (jsonb_typeof(task_snapshot) = 'object'),
  run_snapshot jsonb NOT NULL CHECK (jsonb_typeof(run_snapshot) = 'object'),
  approval_snapshot jsonb NOT NULL CHECK (jsonb_typeof(approval_snapshot) = 'object'),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  proposed_branch_name text NOT NULL
    CHECK (char_length(proposed_branch_name) BETWEEN 3 AND 120),
  implementation_brief text NOT NULL
    CHECK (char_length(implementation_brief) BETWEEN 10 AND 5000),
  validation_checklist jsonb NOT NULL
    CHECK (jsonb_typeof(validation_checklist) = 'array'),
  rollback_notes text NOT NULL
    CHECK (char_length(rollback_notes) BETWEEN 10 AND 3000),
  requires_external_operator boolean NOT NULL DEFAULT true
    CHECK (requires_external_operator = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_team_execution_packets_status_created_idx
  ON public.ai_team_execution_packets (status, created_at DESC);
CREATE INDEX ai_team_execution_packets_run_idx
  ON public.ai_team_execution_packets (run_id);

CREATE TABLE public.ai_team_founder_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date date NOT NULL UNIQUE,
  generated_by uuid NOT NULL,
  source text NOT NULL DEFAULT 'deterministic'
    CHECK (source IN ('deterministic', 'ai')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  sections jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_team_founder_briefs_created_idx
  ON public.ai_team_founder_briefs (created_at DESC);

ALTER TABLE public.ai_team_execution_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_team_founder_briefs ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies are created. V3 reads and writes through the
-- existing protected admin API and its service-role client only.
REVOKE ALL ON public.ai_team_execution_packets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_team_founder_briefs FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.ai_team_execution_packets FROM service_role;
GRANT SELECT ON public.ai_team_execution_packets TO service_role;
REVOKE ALL ON public.ai_team_founder_briefs FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_team_founder_briefs TO service_role;

CREATE OR REPLACE FUNCTION public.stage_ai_team_execution_packet(
  p_task_id uuid,
  p_created_by uuid,
  p_proposed_branch_name text,
  p_implementation_brief text,
  p_validation_checklist jsonb,
  p_rollback_notes text
)
RETURNS SETOF public.ai_team_execution_packets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.ai_team_tasks%ROWTYPE;
  v_run public.ai_team_runs%ROWTYPE;
  v_decision public.ai_team_approval_decisions%ROWTYPE;
  v_packet public.ai_team_execution_packets%ROWTYPE;
BEGIN
  SELECT * INTO v_task
  FROM public.ai_team_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'AI Team task not found';
  END IF;

  SELECT * INTO v_decision
  FROM public.ai_team_approval_decisions
  WHERE task_id = v_task.id
  FOR SHARE;

  IF NOT FOUND OR v_decision.decision <> 'approved' OR v_task.status <> 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'An immutable APPROVED decision is required before execution staging';
  END IF;

  SELECT * INTO STRICT v_run
  FROM public.ai_team_runs
  WHERE id = v_task.run_id;

  IF p_proposed_branch_name IS NULL
    OR char_length(btrim(p_proposed_branch_name)) NOT BETWEEN 3 AND 120
    OR p_proposed_branch_name !~ '^[a-zA-Z0-9][a-zA-Z0-9._/-]*$'
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid proposed branch name';
  END IF;

  IF p_implementation_brief IS NULL
    OR char_length(btrim(p_implementation_brief)) NOT BETWEEN 10 AND 5000
    OR p_rollback_notes IS NULL
    OR char_length(btrim(p_rollback_notes)) NOT BETWEEN 10 AND 3000
    OR p_validation_checklist IS NULL
    OR jsonb_typeof(p_validation_checklist) <> 'array'
    OR jsonb_array_length(p_validation_checklist) = 0
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid execution packet content';
  END IF;

  INSERT INTO public.ai_team_execution_packets (
    task_id,
    run_id,
    approval_decision_id,
    created_by,
    task_snapshot,
    run_snapshot,
    approval_snapshot,
    evidence,
    proposed_branch_name,
    implementation_brief,
    validation_checklist,
    rollback_notes,
    requires_external_operator
  )
  VALUES (
    v_task.id,
    v_run.id,
    v_decision.id,
    p_created_by,
    jsonb_build_object(
      'id', v_task.id,
      'owner', v_task.owner,
      'title', v_task.title,
      'objective', v_task.objective,
      'status', v_task.status,
      'requiresApproval', v_task.requires_approval
    ),
    jsonb_build_object(
      'id', v_run.id,
      'goal', v_run.goal,
      'summary', v_run.summary,
      'source', v_run.source,
      'createdAt', v_run.created_at
    ),
    jsonb_build_object(
      'id', v_decision.id,
      'decision', v_decision.decision,
      'actorId', v_decision.actor_id,
      'actorEmail', v_decision.actor_email,
      'note', v_decision.note,
      'createdAt', v_decision.created_at
    ),
    COALESCE(v_task.evidence, '[]'::jsonb),
    btrim(p_proposed_branch_name),
    btrim(p_implementation_brief),
    p_validation_checklist,
    btrim(p_rollback_notes),
    true
  )
  RETURNING * INTO v_packet;

  RETURN NEXT v_packet;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.stage_ai_team_execution_packet(
  uuid, uuid, text, text, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_ai_team_execution_packet(
  uuid, uuid, text, text, jsonb, text
) TO service_role;
