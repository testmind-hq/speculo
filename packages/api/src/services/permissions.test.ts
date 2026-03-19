import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock ────────────────────────────────────────────────────────────────────
vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users:           { findFirst: vi.fn() },
      services:        { findFirst: vi.fn() },
      teamMembers:     { findFirst: vi.fn() },
      crossTeamGrants: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET   = 'a'.repeat(32)

const { canAccessBranch } = await import('./permissions.js')
const { db } = await import('../db/index.js')

const mockService = { id: 'svc-1', teamId: 'team-a' }

beforeEach(() => {
  vi.mocked(db.query.users.findFirst).mockResolvedValue({ role: 'team_member', isActive: true } as any)
  vi.mocked(db.query.services.findFirst).mockResolvedValue(mockService as any)
  vi.mocked(db.query.teamMembers.findFirst).mockResolvedValue(undefined)
  vi.mocked(db.query.crossTeamGrants.findFirst).mockResolvedValue(undefined)
  vi.mocked(db.query.crossTeamGrants.findMany).mockResolvedValue([])
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  } as any)
})

describe('canAccessBranch', () => {
  it('returns true for super_admin regardless of team', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ role: 'super_admin', isActive: true } as any)
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(true)
  })

  it('returns false when user is not found or inactive', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const result = await canAccessBranch('ghost', 'my-service', 'main')
    expect(result).toBe(false)
  })

  it('returns false when service does not exist', async () => {
    vi.mocked(db.query.services.findFirst).mockResolvedValueOnce(undefined)
    const result = await canAccessBranch('user-1', 'no-such-service', 'main')
    expect(result).toBe(false)
  })

  it('returns true when user is a member of the service owning team', async () => {
    // User IS a member of team-a (the service's team)
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce({ id: 'mem-1' } as any)
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(true)
  })

  it('returns false when user has no membership and no grants', async () => {
    // No team membership, no user teams → no team grants, no user grant
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(false)
  })

  it('returns true via a team-level grant covering all branches', async () => {
    // User belongs to team-b
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ teamId: 'team-b' }]) })),
    } as any)
    // Team-b has a grant with branches: null (= all branches)
    vi.mocked(db.query.crossTeamGrants.findMany).mockResolvedValueOnce([{ branches: null }] as any)
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(true)
  })

  it('returns true via a user-level grant when no team grants exist', async () => {
    // No team memberships
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    } as any)
    // User-level grant covering all branches
    vi.mocked(db.query.crossTeamGrants.findMany).mockResolvedValueOnce([{ branches: null }] as any)
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(true)
  })

  it('returns false when user grant restricts branches and branch does not match', async () => {
    // No team memberships
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    } as any)
    // User-level grant only allows 'dev' branch
    vi.mocked(db.query.crossTeamGrants.findMany).mockResolvedValueOnce([{ branches: ['dev'] }] as any)
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(false)
  })

  it('returns true when team grant covers specific branch', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ teamId: 'team-b' }]) })),
    } as any)
    vi.mocked(db.query.crossTeamGrants.findMany).mockResolvedValueOnce([{ branches: ['main', 'staging'] }] as any)
    const result = await canAccessBranch('user-1', 'my-service', 'main')
    expect(result).toBe(true)
  })
})
