import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { hash } from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from './db/index.js'
import { users, teams, teamMembers } from './db/schema.js'

// Works in both dev (cwd = packages/api/) and Docker (cwd = /app)
const MIGRATIONS_FOLDER = 'src/db/migrations'

export async function runStartup() {
  console.log('Running database migrations...')
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  console.log('Migrations complete.')

  await bootstrapDefaultTeam()
  await bootstrapAdminUser()
}

async function bootstrapDefaultTeam() {
  const result = await db.insert(teams).values({
    name: 'default',
    displayName: 'Default Team',
    description: 'Default team for all services',
    isDefault: true,
    isDeletable: false,
  }).onConflictDoNothing().returning({ id: teams.id })
  if (result.length > 0) {
    console.log('[speculo] Default team created.')
  }
}

async function bootstrapAdminUser() {
  const [{ count }] = await db
    .select({ count: sql<string>`count(*)` })
    .from(users)

  if (Number(count) > 0) return

  const password = randomBytes(16).toString('base64url')
  const passwordHash = await hash(password, 10)

  const [admin] = await db.insert(users)
    .values({ email: 'admin@example.com', passwordHash, role: 'super_admin' })
    .returning({ id: users.id })

  // Assign admin as owner of the default team
  const defaultTeam = await db.query.teams.findFirst({ where: eq(teams.isDefault, true) })
  if (defaultTeam && admin) {
    await db.insert(teamMembers).values({
      teamId: defaultTeam.id,
      userId: admin.id,
      role: 'owner',
    })
  }

  console.log('========================================')
  console.log('Default admin account created:')
  console.log('  Email:    admin@example.com')
  console.log(`  Password: ${password}`)
  console.log('Change this password after first login.')
  console.log('========================================')
}
