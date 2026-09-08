ALTER TABLE public.ai_team_tasks
  DROP CONSTRAINT IF EXISTS ai_team_tasks_owner_check;

ALTER TABLE public.ai_team_tasks
  ADD CONSTRAINT ai_team_tasks_owner_check
  CHECK (
    owner IN (
      'chief_of_staff',
      'engineering',
      'qa',
      'analytics',
      'product',
      'growth',
      'customer',
      'critic'
    )
  );
