-- Buxme OS V5.1: cover composite mission foreign keys for efficient parent updates/deletes.

CREATE INDEX IF NOT EXISTS ai_team_mission_events_mission_owner_idx
  ON public.ai_team_mission_events (mission_id, created_by);

CREATE INDEX IF NOT EXISTS ai_team_mission_changes_mission_owner_idx
  ON public.ai_team_mission_changes (mission_id, created_by);

CREATE INDEX IF NOT EXISTS ai_team_mission_verifications_mission_owner_idx
  ON public.ai_team_mission_verifications (mission_id, created_by);
