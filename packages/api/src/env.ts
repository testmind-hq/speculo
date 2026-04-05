import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY_DAYS: z.coerce.number().default(7),
  PORT: z.coerce.number().default(3000),
  // Set to "true" only when serving over HTTPS (e.g. behind an nginx TLS terminator)
  SECURE_COOKIES: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  // Optional: set a fixed admin password for testing/CI. If unset, a random password is generated on first run.
  // Not recommended for production — use a strong random password there.
  // Empty string is treated as unset (safe for docker-compose passthrough of unset host vars).
  ADMIN_PASSWORD: z.preprocess(v => (v === '' ? undefined : v), z.string().min(8).optional()),
})

export const env = envSchema.parse(process.env)
