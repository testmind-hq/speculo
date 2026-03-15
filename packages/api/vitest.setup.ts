// Set environment variables before any tests run
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(32)
