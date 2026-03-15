-- Phase 2: Team management, cross-team grants, tsvector search

-- Extend user_role enum
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'team_owner';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'team_member';

-- New enum for team member roles
DO $$ BEGIN
  CREATE TYPE "team_member_role" AS ENUM('owner', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Teams table
CREATE TABLE IF NOT EXISTS "teams" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"         varchar(100) UNIQUE NOT NULL,
  "display_name" varchar(200),
  "description"  text,
  "is_default"   boolean DEFAULT false NOT NULL,
  "is_deletable" boolean DEFAULT true NOT NULL,
  "created_by"   uuid REFERENCES "users"("id"),
  "created_at"   timestamptz DEFAULT now() NOT NULL
);

-- Team members table
CREATE TABLE IF NOT EXISTS "team_members" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id"   uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "user_id"   uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"      "team_member_role" NOT NULL DEFAULT 'member',
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("team_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_team_members_team_user" ON "team_members"("team_id", "user_id");

-- Add team_id to services (nullable, assigned during upload or admin reassignment)
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "team_id" uuid REFERENCES "teams"("id");

-- Cross-team grants table
CREATE TABLE IF NOT EXISTS "cross_team_grants" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_team_id"    uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "service_id"       uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "branches"         text[],
  "grantee_team_id"  uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "grantee_user_id"  uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "granted_by"       uuid NOT NULL REFERENCES "users"("id"),
  "expires_at"       timestamptz,
  "created_at"       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "grantee_exclusive" CHECK (
    (grantee_team_id IS NULL) != (grantee_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "idx_grant_owner"   ON "cross_team_grants"("owner_team_id");
CREATE INDEX IF NOT EXISTS "idx_grant_service" ON "cross_team_grants"("service_id");
CREATE INDEX IF NOT EXISTS "idx_grant_team"    ON "cross_team_grants"("grantee_team_id");
CREATE INDEX IF NOT EXISTS "idx_grant_user"    ON "cross_team_grants"("grantee_user_id");

-- Add is_active to users (for soft disable)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

-- Add tsvector column to endpoint_index for full-text search
ALTER TABLE "endpoint_index" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "idx_endpoint_search" ON "endpoint_index" USING GIN("search_vector");

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_endpoint_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english',
    coalesce(NEW.path, '') || ' ' ||
    coalesce(NEW.summary, '') || ' ' ||
    coalesce(NEW.operation_id, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS endpoint_search_trigger ON "endpoint_index";
CREATE TRIGGER endpoint_search_trigger
BEFORE INSERT OR UPDATE ON "endpoint_index"
FOR EACH ROW EXECUTE FUNCTION update_endpoint_search_vector();

-- Backfill search_vector for existing rows
UPDATE "endpoint_index" SET "search_vector" = to_tsvector('english',
  coalesce(path, '') || ' ' ||
  coalesce(summary, '') || ' ' ||
  coalesce(operation_id, '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
);
