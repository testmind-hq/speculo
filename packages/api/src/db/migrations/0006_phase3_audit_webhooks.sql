CREATE TYPE "public"."audit_action" AS ENUM(
  'login', 'spec_uploaded', 'spec_updated', 'service_deleted',
  'grant_created', 'grant_revoked', 'token_created', 'token_revoked',
  'user_created', 'user_disabled', 'team_created'
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" "audit_action" NOT NULL,
  "target_id" varchar(255),
  "target_name" varchar(255),
  "meta" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" ("user_id");
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "provider_type" varchar(50) NOT NULL DEFAULT 'feishu',
  "events" text[] NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "users"("id") NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
