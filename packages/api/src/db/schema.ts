import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  integer, timestamp, index, uniqueIndex, customType,
} from 'drizzle-orm/pg-core'

// tsvector is not a native Drizzle type; customType wraps it for schema declaration
const tsvector = customType<{ data: string }>({
  dataType() { return 'tsvector' },
})

export const userRoleEnum = pgEnum('user_role', ['super_admin', 'team_owner', 'team_member', 'guest'])
export const tokenScopeEnum = pgEnum('token_scope', ['read', 'write'])
export const teamMemberRoleEnum = pgEnum('team_member_role', ['owner', 'member'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('guest'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  displayName: varchar('display_name', { length: 200 }),
  description: text('description'),
  isDefault: boolean('is_default').default(false).notNull(),
  isDeletable: boolean('is_deletable').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: teamMemberRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  teamUserUnique: uniqueIndex('idx_team_members_team_user').on(t.teamId, t.userId),
}))

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  displayName: varchar('display_name', { length: 200 }),
  teamId: uuid('team_id').references(() => teams.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const specVersions = pgTable('spec_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id').references(() => services.id).notNull(),
  branch: varchar('branch', { length: 200 }).notNull(),
  commitSha: varchar('commit_sha', { length: 40 }),
  specContent: text('spec_content').notNull(),
  specHash: varchar('spec_hash', { length: 64 }),
  endpointCount: integer('endpoint_count').default(0).notNull(),
  isLatest: boolean('is_latest').default(true).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
})

export const endpointIndex = pgTable('endpoint_index', {
  id: uuid('id').primaryKey().defaultRandom(),
  specId: uuid('spec_id').references(() => specVersions.id, { onDelete: 'cascade' }).notNull(),
  serviceName: varchar('service_name', { length: 100 }).notNull(),
  branch: varchar('branch', { length: 200 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  path: text('path').notNull(),
  operationId: varchar('operation_id', { length: 200 }),
  summary: text('summary'),
  tags: text('tags').array(),
  searchVector: tsvector('search_vector'),
}, (t) => ({
  serviceBranchIdx: index('idx_endpoint_service_branch').on(t.serviceName, t.branch),
}))

export const crossTeamGrants = pgTable('cross_team_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerTeamId: uuid('owner_team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'cascade' }).notNull(),
  branches: text('branches').array(),
  granteeTeamId: uuid('grantee_team_id').references(() => teams.id, { onDelete: 'cascade' }),
  granteeUserId: uuid('grantee_user_id').references(() => users.id, { onDelete: 'cascade' }),
  grantedBy: uuid('granted_by').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  grantOwnerIdx: index('idx_grant_owner').on(t.ownerTeamId),
  grantServiceIdx: index('idx_grant_service').on(t.serviceId),
  grantTeamIdx: index('idx_grant_team').on(t.granteeTeamId),
  grantUserIdx: index('idx_grant_user').on(t.granteeUserId),
}))

export const mcpTokens = pgTable('mcp_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  tokenHash: text('token_hash').notNull(),
  prefix: varchar('prefix', { length: 24 }).notNull(),
  scope: tokenScopeEnum('scope').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditActionEnum = pgEnum('audit_action', [
  'login',
  'spec_uploaded',
  'spec_updated',
  'service_deleted',
  'grant_created',
  'grant_revoked',
  'token_created',
  'token_revoked',
  'user_created',
  'user_disabled',
  'team_created',
])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // SET NULL on delete: audit log persists when a user is deleted, userId just becomes null
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: auditActionEnum('action').notNull(),
  targetId: varchar('target_id', { length: 255 }),
  targetName: varchar('target_name', { length: 255 }),
  meta: text('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  createdAtIdx: index('idx_audit_logs_created_at').on(t.createdAt),
  actionIdx: index('idx_audit_logs_action').on(t.action),
  userIdx: index('idx_audit_logs_user').on(t.userId),
}))

export const webhookConfigs = pgTable('webhook_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  // NULL = global webhook (fires for all teams); non-null = team-scoped webhook
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  providerType: varchar('provider_type', { length: 50 }).notNull().default('feishu'),
  events: text('events').array().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
