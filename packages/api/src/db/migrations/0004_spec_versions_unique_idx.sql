-- Enforce DB-level uniqueness: only one is_latest=true row per (service_id, branch)
-- Application code already maintains this via UPDATE SET is_latest=false before INSERT,
-- but without the DB constraint concurrent uploads can still create two latest rows.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_spec_versions_service_branch_latest"
  ON "spec_versions"("service_id", "branch")
  WHERE "is_latest" = true;
