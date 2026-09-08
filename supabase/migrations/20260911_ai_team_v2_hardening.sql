-- Mission Control V2 hardening after the additive V2 schema.

REVOKE EXECUTE ON FUNCTION public.prevent_ai_team_decision_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS ai_team_playbooks_created_by_favorite_updated_idx
  ON public.ai_team_playbooks (created_by, favorite DESC, updated_at DESC);
