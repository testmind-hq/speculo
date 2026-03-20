-- Add content hash for deduplication of identical spec uploads
ALTER TABLE "spec_versions" ADD COLUMN IF NOT EXISTS "spec_hash" varchar(64);
