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

  INSERT INTO public.ai_team_runs (
    id,
    created_by,
    goal,
    source,
    model,
    summary,
    snapshot,
    created_at
  )
  VALUES (
    v_run_id,
    p_created_by,
    p_goal,
    p_source,
    p_model,
    p_summary,
    p_snapshot,
    p_created_at
  );

  INSERT INTO public.ai_team_tasks (
    run_id,
    owner,
    status,
    title,
    objective,
    evidence,
    requires_approval,
    approval_reason,
    created_at
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

REVOKE ALL ON FUNCTION public.save_ai_team_run_atomic(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz,
  jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_ai_team_run_atomic(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz,
  jsonb
) TO service_role;
