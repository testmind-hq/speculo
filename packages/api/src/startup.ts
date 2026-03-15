import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './db/index.js'
import { users } from './db/schema.js'

// Works in both dev (cwd = packages/api/) and Docker (cwd = /app)
const MIGRATIONS_FOLDER = 'src/db/migrations'

export async function runStartup() {
  console.log('Running database migrations...')
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  console.log('Migrations complete.')

  const existing = await db.query.users.findFirst({ where: eq(users.email, 'admin@example.com') })
  if (!existing) {
    const passwordHash = await hash('admin', 10)
    await db.insert(users).values({ email: 'admin@example.com', passwordHash, role: 'super_admin' })
    console.log('Default admin user created: admin@example.com / admin')
  }
}
