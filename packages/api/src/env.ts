import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY_DAYS: z.coerce.number().default(7),
  PORT: z.coerce.number().default(3000),
})

export const env = envSchema.parse(process.env)
