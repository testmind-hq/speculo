import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  integer, timestamp, index,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['super_admin', 'guest'])
export const tokenScopeEnum = pgEnum('token_scope', ['read', 'write'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('guest'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  displayName: varchar('display_name', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const specVersions = pgTable('spec_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id').references(() => services.id).notNull(),
  branch: varchar('branch', { length: 200 }).notNull(),
  commitSha: varchar('commit_sha', { length: 40 }),
  specContent: text('spec_content').notNull(),
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
}, (t) => ({
  serviceBranchIdx: index('idx_endpoint_service_branch').on(t.serviceName, t.branch),
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
