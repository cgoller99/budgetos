ALTER TABLE public.admin_event_logs
  DROP CONSTRAINT IF EXISTS admin_event_logs_event_type_check;

ALTER TABLE public.admin_event_logs
  ADD CONSTRAINT admin_event_logs_event_type_check
  CHECK (
    event_type IN (
      'error',
      'stripe',
      'plaid',
      'auth',
      'api_failure',
      'ai_team'
    )
  );
