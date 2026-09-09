-- AI Team admin ownership hardening.
-- Keep each admin's runs, approvals, execution packets, and daily briefs isolated.

ALTER TABLE public.ai_team_founder_briefs
  DROP CONSTRAINT IF EXISTS ai_team_founder_briefs_brief_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS ai_team_founder_briefs_generated_by_date_key
  ON public.ai_team_founder_briefs (generated_by, brief_date);

CREATE INDEX IF NOT EXISTS ai_team_runs_created_by_created_idx
  ON public.ai_team_runs (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_team_execution_packets_created_by_created_idx
  ON public.ai_team_execution_packets (created_by, created_at DESC);

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
  v_run_owner uuid;
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

  SELECT created_by
  INTO v_run_owner
  FROM public.ai_team_runs
  WHERE id = v_task.run_id;

  IF v_run_owner IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'AI Team task is not owned by this admin';
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

REVOKE ALL ON FUNCTION public.record_ai_team_approval_decision(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_team_approval_decision(
  uuid, uuid, text, text, text
) TO service_role;

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

  SELECT * INTO STRICT v_run
  FROM public.ai_team_runs
  WHERE id = v_task.run_id;

  IF v_run.created_by IS DISTINCT FROM p_created_by THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'AI Team task is not owned by this admin';
  END IF;

  SELECT * INTO v_decision
  FROM public.ai_team_approval_decisions
  WHERE task_id = v_task.id
    AND run_id = v_run.id
    AND actor_id = p_created_by
  FOR SHARE;

  IF NOT FOUND OR v_decision.decision <> 'approved' OR v_task.status <> 'approved' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'An immutable APPROVED decision by this admin is required before execution staging';
  END IF;

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