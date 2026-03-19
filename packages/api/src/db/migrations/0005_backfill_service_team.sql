-- Backfill: assign any services without a team to the default team.
-- Prevents pre-Phase-2 services from becoming invisible to non-super_admin users.
UPDATE "services"
SET "team_id" = (SELECT "id" FROM "teams" WHERE "is_default" = true LIMIT 1)
WHERE "team_id" IS NULL;
