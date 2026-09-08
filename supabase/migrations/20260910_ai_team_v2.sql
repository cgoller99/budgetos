-- AI Team Mission Control V2 persistence. Additive and server-admin only.

ALTER TABLE public.ai_team_runs
  ADD COLUMN IF NOT EXISTS runtime_metadata jsonb;

ALTER TABLE public.ai_team_runs
  DROP CONSTRAINT IF EXISTS ai_team_runs_runtime_metadata_object_check;

ALTER TABLE public.ai_team_runs
  ADD CONSTRAINT ai_team_runs_runtime_metadata_object_check
  CHECK (
    runtime_metadata IS NULL OR jsonb_typeof(runtime_metadata) = 'object'
  );

ALTER TABLE public.ai_team_tasks
  DROP CONSTRAINT IF EXISTS ai_team_tasks_status_check;

ALTER TABLE public.ai_team_tasks
  ADD CONSTRAINT ai_team_tasks_status_check
  CHECK (
    status IN (
      'queued',
      'running',
      'needs_approval',
      'approved',
      'rejected',
      'completed',
      'failed'
    )
  );

CREATE TABLE IF NOT EXISTS public.ai_team_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE
    REFERENCES public.ai_team_tasks (id) ON DELETE RESTRICT,
  run_id uuid NOT NULL
    REFERENCES public.ai_team_runs (id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  actor_email text,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_team_approval_decisions_run_created_idx
  ON public.ai_team_approval_decisions (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_team_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  description text NOT NULL DEFAULT ''
    CHECK (char_length(description) <= 500),
  category text NOT NULL CHECK (char_length(category) BETWEEN 2 AND 60),
  goal_template text NOT NULL
    CHECK (char_length(goal_template) BETWEEN 3 AND 1000),
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_team_playbooks_favorite_updated_idx
  ON public.ai_team_playbooks (favorite DESC, updated_at DESC);

ALTER TABLE public.ai_team_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_team_playbooks ENABLE ROW LEVEL SECURITY;

-- Access is exclusively through the existing server-side service-role boundary.
-- Deliberately create no anon/authenticated RLS policies.
REVOKE ALL ON public.ai_team_approval_decisions FROM anon, authenticated;
REVOKE ALL ON public.ai_team_playbooks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_ai_team_decision_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'AI Team approval decisions are immutable';
END;
$$;

DROP TRIGGER IF EXISTS ai_team_approval_decisions_immutable
  ON public.ai_team_approval_decisions;
CREATE TRIGGER ai_team_approval_decisions_immutable
  BEFORE UPDATE OR DELETE ON public.ai_team_approval_decisions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_team_decision_mutation();

CREATE OR REPLACE FUNCTION public.record_ai_team_approval_decision(
  p_task_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_decision text,
  p_note text
)
RETURNS SETOF public.ai_team_approval_decisions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task public.ai_team_tasks%ROWTYPE;
  v_record public.ai_team_approval_decisions%ROWTYPE;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid AI Team approval decision';
  END IF;

  IF p_note IS NOT NULL AND char_length(p_note) > 1000 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'AI Team approval decision note is too long';
  END IF;

  SELECT *
  INTO v_task
  FROM public.ai_team_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'AI Team approval task not found';
  END IF;

  IF NOT v_task.requires_approval OR v_task.status <> 'needs_approval' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'AI Team task is not waiting for an approval decision';
  END IF;

  INSERT INTO public.ai_team_approval_decisions (
    task_id,
    run_id,
    actor_id,
    actor_email,
    decision,
    note
  )
  VALUES (
    v_task.id,
    v_task.run_id,
    p_actor_id,
    NULLIF(btrim(p_actor_email), ''),
    p_decision,
    NULLIF(btrim(p_note), '')
  )
  RETURNING * INTO v_record;

  UPDATE public.ai_team_tasks
  SET status = p_decision
  WHERE id = v_task.id;

  RETURN NEXT v_record;
  RETURN;
END;
$$;

-- The nine-argument overload persists verified runtime metadata. The original
-- eight-argument signature remains available below for backward compatibility.
CREATE OR REPLACE FUNCTION public.save_ai_team_run_atomic(
  p_created_by uuid,
  p_goal text,
  p_source text,
  p_model text,
  p_summary text,
  p_snapshot jsonb,
  p_created_at timestamptz,
  p_tasks jsonb,
  p_runtime_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid := gen_random_uuid();
BEGIN
  IF p_tasks IS NULL
    OR jsonb_typeof(p_tasks) <> 'array'
    OR jsonb_array_length(p_tasks) = 0
  THEN
    RAISE EXCEPTION 'AI Team run must contain at least one task';
  END IF;

  IF p_runtime_metadata IS NOT NULL
    AND jsonb_typeof(p_runtime_metadata) <> 'object'
  THEN
    RAISE EXCEPTION 'AI Team runtime metadata must be an object';
  END IF;

  INSERT INTO public.ai_team_runs (
    id, created_by, goal, source, model, summary, snapshot,
    runtime_metadata, created_at
  )
  VALUES (
    v_run_id, p_created_by, p_goal, p_source, p_model, p_summary, p_snapshot,
    p_runtime_metadata, p_created_at
  );

  INSERT INTO public.ai_team_tasks (
    run_id, owner, status, title, objective, evidence,
    requires_approval, approval_reason, created_at
  )
  SELECT
    v_run_id,
    task ->> 'owner',
    task ->> 'status',
    task ->> 'title',
    task ->> 'objective',
    COALESCE(task -> 'evidence', '[]'::jsonb),
    COALESCE((task ->> 'requires_approval')::boolean, false),
    NULLIF(task ->> 'approval_reason', ''),
    p_created_at
  FROM jsonb_array_elements(p_tasks) AS task;

  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_ai_team_run_atomic(
  p_created_by uuid,
  p_goal text,
  p_source text,
  p_model text,
  p_summary text,
  p_snapshot jsonb,
  p_created_at timestamptz,
  p_tasks jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.save_ai_team_run_atomic(
    p_created_by,
    p_goal,
    p_source,
    p_model,
    p_summary,
    p_snapshot,
    p_created_at,
    p_tasks,
    NULL
  );
$$;

REVOKE ALL ON FUNCTION public.save_ai_team_run_atomic(
  uuid, text, text, text, text, jsonb, timestamptz, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_team_run_atomic(
  uuid, text, text, text, text, jsonb, timestamptz, jsonb, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.prevent_ai_team_decision_mutation()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.record_ai_team_approval_decision(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_team_approval_decision(
  uuid, uuid, text, text, text
) TO service_role;

REVOKE ALL ON public.ai_team_approval_decisions FROM service_role;
GRANT SELECT, INSERT ON public.ai_team_approval_decisions TO service_role;

REVOKE ALL ON public.ai_team_playbooks FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_team_playbooks TO service_role;
