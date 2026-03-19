import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ── Mutable auth state (set per test to simulate different roles) ──────────────
const authState = { userId: 'user-1', userRole: 'super_admin' }

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', authState.userId)
    c.set('userRole', authState.userRole)
    await next()
  }),
}))

// ── Shared test fixtures ───────────────────────────────────────────────────────
const mockTeam = {
  id: 'team-1', name: 'alpha', displayName: 'Alpha', description: null,
  isDefault: false, isDeletable: true, createdBy: 'user-1', createdAt: new Date(),
}
const mockUser = {
  id: 'user-1', email: 'admin@example.com', role: 'super_admin',
  isActive: true, createdAt: new Date(),
}
const mockMember = {
  id: 'mem-1', userId: 'user-2', email: 'b@b.com', role: 'member', joinedAt: new Date(),
}
const mockGrant = { id: 'grant-1', ownerTeamId: 'team-1' }

// ── Flexible DB mock chain ─────────────────────────────────────────────────────
// Creates a thenable that is also chainable with .where/.innerJoin/.orderBy/.limit
function chain(val: any[] = []) {
  const p: any = Promise.resolve(val)
  p.from      = vi.fn(() => chain(val))
  p.where     = vi.fn(() => chain(val))
  p.innerJoin = vi.fn(() => chain(val))
  p.orderBy   = vi.fn(() => Promise.resolve(val))
  p.limit     = vi.fn(() => Promise.resolve(val))
  return p
}

function insertChain(returning: any[] = [mockTeam]) {
  const p: any = Promise.resolve(undefined)
  p.returning          = vi.fn().mockResolvedValue(returning)
  p.onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
  return p
}

function updateEnd(returning: any[] = [{ id: 'u-id' }]) {
  const p: any = Promise.resolve(returning)
  p.returning = vi.fn().mockResolvedValue(returning)
  return p
}

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => chain([])) })),
    insert: vi.fn(() => ({ values: vi.fn(() => insertChain()) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => updateEnd()) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    query: {
      teams:           { findFirst: vi.fn() },
      teamMembers:     { findFirst: vi.fn() },
      crossTeamGrants: { findFirst: vi.fn() },
      users:           { findFirst: vi.fn() },
      services:        { findFirst: vi.fn() },
    },
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET   = 'a'.repeat(32)

const { adminRouter } = await import('./admin.js')
const { db }          = await import('../db/index.js')
const app = new Hono().route('/', adminRouter)

beforeEach(() => {
  authState.userId   = 'user-1'
  authState.userRole = 'super_admin'
  vi.mocked(db.query.teams.findFirst).mockResolvedValue(mockTeam as any)
  vi.mocked(db.query.teamMembers.findFirst).mockResolvedValue(undefined)
  vi.mocked(db.query.crossTeamGrants.findFirst).mockResolvedValue(mockGrant as any)
  vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any)
  vi.mocked(db.query.services.findFirst).mockResolvedValue({ teamId: 'team-1' } as any)
  vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => chain([])) } as any)
})

// ── Teams ──────────────────────────────────────────────────────────────────────

describe('GET /api/admin/teams', () => {
  it('returns 403 for team_owner', async () => {
    authState.userRole = 'team_owner'
    const res = await app.request('/api/admin/teams')
    expect(res.status).toBe(403)
  })

  it('returns team list for super_admin', async () => {
    vi.mocked(db.select).mockReturnValueOnce({ from: vi.fn(() => chain([mockTeam])) } as any)
    const res = await app.request('/api/admin/teams')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body.teams)).toBe(true)
  })
})

describe('POST /api/admin/teams', () => {
  it('returns 403 for non-super_admin', async () => {
    authState.userRole = 'guest'
    const res = await app.request('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-team' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 409 when name is taken', async () => {
    // findFirst returns existing team → conflict
    const res = await app.request('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'alpha' }),
    })
    expect(res.status).toBe(409)
  })

  it('creates team for super_admin', async () => {
    vi.mocked(db.query.teams.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-team' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBeTruthy()
  })
})

describe('DELETE /api/admin/teams/:id', () => {
  it('returns 403 for non-super_admin', async () => {
    authState.userRole = 'team_owner'
    const res = await app.request('/api/admin/teams/team-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('returns 404 when team not found', async () => {
    vi.mocked(db.query.teams.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/teams/no-such', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('returns 403 when team is not deletable (default team)', async () => {
    vi.mocked(db.query.teams.findFirst).mockResolvedValueOnce({ ...mockTeam, isDeletable: false } as any)
    const res = await app.request('/api/admin/teams/team-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('deletes a deletable team', async () => {
    const res = await app.request('/api/admin/teams/team-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })
})

// ── Team Members ──────────────────────────────────────────────────────────────

describe('GET /api/admin/teams/:id/members', () => {
  it('returns 403 for guest', async () => {
    authState.userRole = 'guest'
    const res = await app.request('/api/admin/teams/team-1/members')
    expect(res.status).toBe(403)
  })

  it('allows team_owner to list members of their own team', async () => {
    authState.userRole = 'team_owner'
    // callerOwnsTeam check: user is owner of team-1
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce({ role: 'owner' } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => chain([mockMember])),
    } as any)
    const res = await app.request('/api/admin/teams/team-1/members')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body.members)).toBe(true)
  })

  it('returns 403 when team_owner tries to access another team', async () => {
    authState.userRole = 'team_owner'
    // callerOwnsTeam check: user is NOT owner of team-other
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/teams/team-other/members')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/teams/:id/members', () => {
  it('returns 403 for guest', async () => {
    authState.userRole = 'guest'
    const res = await app.request('/api/admin/teams/team-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when userId does not exist', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/teams/team-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'no-such-user' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 when already a member', async () => {
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce({ id: 'mem-1' } as any)
    const res = await app.request('/api/admin/teams/team-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2' }),
    })
    expect(res.status).toBe(409)
  })

  it('adds new member', async () => {
    const res = await app.request('/api/admin/teams/team-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-new' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })
})

describe('PUT /api/admin/teams/:id/members/:userId', () => {
  it('returns 404 when member not found', async () => {
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn(() => ({ where: vi.fn(() => updateEnd([])) })),
    } as any)
    const res = await app.request('/api/admin/teams/team-1/members/no-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'owner' }),
    })
    expect(res.status).toBe(404)
  })

  it('updates member role', async () => {
    const res = await app.request('/api/admin/teams/team-1/members/user-2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'owner' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/teams/:id/members/:userId', () => {
  it('returns 403 for guest', async () => {
    authState.userRole = 'guest'
    const res = await app.request('/api/admin/teams/team-1/members/user-2', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('removes member', async () => {
    const res = await app.request('/api/admin/teams/team-1/members/user-2', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })
})

// ── Cross-team Grants ─────────────────────────────────────────────────────────

describe('GET /api/admin/teams/:id/grants', () => {
  it('returns 403 for guest', async () => {
    authState.userRole = 'guest'
    const res = await app.request('/api/admin/teams/team-1/grants')
    expect(res.status).toBe(403)
  })

  it('returns 403 when team_owner is not owner of the target team', async () => {
    authState.userRole = 'team_owner'
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/teams/team-other/grants')
    expect(res.status).toBe(403)
  })

  it('allows team_owner who owns the team to list grants', async () => {
    authState.userRole = 'team_owner'
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce({ role: 'owner' } as any)
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn(() => chain([])) } as any) // outgoing
      .mockReturnValueOnce({ from: vi.fn(() => chain([])) } as any) // incoming
    const res = await app.request('/api/admin/teams/team-1/grants')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body.outgoing)).toBe(true)
    expect(Array.isArray(body.incoming)).toBe(true)
  })
})

describe('POST /api/admin/teams/:id/grants', () => {
  it('returns 400 without a grantee', async () => {
    const res = await app.request('/api/admin/teams/team-1/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 with both grantee types', async () => {
    const res = await app.request('/api/admin/teams/team-1/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1', granteeTeamId: 'team-2', granteeUserId: 'user-2' }),
    })
    expect(res.status).toBe(400)
  })

  it('creates a team-level grant', async () => {
    // service ownership check: service belongs to team-1
    vi.mocked(db.query.services.findFirst).mockResolvedValueOnce({ teamId: 'team-1' } as any)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn(() => insertChain([{ id: 'grant-new' }])),
    } as any)
    const res = await app.request('/api/admin/teams/team-1/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1', granteeTeamId: 'team-2' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBeTruthy()
  })

  it('returns 403 when team_owner tries to grant a service from another team', async () => {
    authState.userRole = 'team_owner'
    // callerOwnsTeam: user owns team-1
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce({ role: 'owner' } as any)
    // service belongs to team-2, not team-1
    vi.mocked(db.query.services.findFirst).mockResolvedValueOnce({ teamId: 'team-2' } as any)
    const res = await app.request('/api/admin/teams/team-1/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-other', granteeTeamId: 'team-3' }),
    })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/grants/:id', () => {
  it('returns 404 when grant not found', async () => {
    vi.mocked(db.query.crossTeamGrants.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/grants/no-grant', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('returns 403 when team_owner is not in the owner team', async () => {
    authState.userRole = 'team_owner'
    vi.mocked(db.query.crossTeamGrants.findFirst).mockResolvedValueOnce({
      id: 'grant-1', ownerTeamId: 'team-other',
    } as any)
    // User is NOT a member of team-other
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/grants/grant-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('returns 403 when user is a team_member (non-owner) in the owning team', async () => {
    authState.userRole = 'team_owner'
    vi.mocked(db.query.crossTeamGrants.findFirst).mockResolvedValueOnce({ id: 'grant-1', ownerTeamId: 'team-1' } as any)
    // User is a member but NOT an owner of team-1
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/admin/grants/grant-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('allows team owner (role=owner) to delete their grant', async () => {
    authState.userRole = 'team_owner'
    // Grant owned by team-1
    vi.mocked(db.query.crossTeamGrants.findFirst).mockResolvedValueOnce({ id: 'grant-1', ownerTeamId: 'team-1' } as any)
    // User IS an owner of team-1
    vi.mocked(db.query.teamMembers.findFirst).mockResolvedValueOnce({ id: 'mem-1', role: 'owner' } as any)
    const res = await app.request('/api/admin/grants/grant-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })

  it('allows super_admin to delete any grant', async () => {
    const res = await app.request('/api/admin/grants/grant-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })
})

// ── Users ─────────────────────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns 403 for team_owner', async () => {
    authState.userRole = 'team_owner'
    const res = await app.request('/api/admin/users')
    expect(res.status).toBe(403)
  })

  it('returns user list for super_admin', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn(() => chain([mockUser])) } as any) // allUsers
      .mockReturnValueOnce({ from: vi.fn(() => chain([])) } as any)         // allMembers
    const res = await app.request('/api/admin/users')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body.users)).toBe(true)
  })
})

describe('PUT /api/admin/users/:id', () => {
  it('returns 403 for team_member', async () => {
    authState.userRole = 'team_member'
    const res = await app.request('/api/admin/users/user-2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'guest' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn(() => ({ where: vi.fn(() => updateEnd([])) })),
    } as any)
    const res = await app.request('/api/admin/users/no-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(res.status).toBe(404)
  })

  it('updates user role', async () => {
    const res = await app.request('/api/admin/users/user-2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'team_owner' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/users/:id', () => {
  it('returns 403 for non-super_admin', async () => {
    authState.userRole = 'team_member'
    const res = await app.request('/api/admin/users/user-2', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('returns 403 when trying to delete self', async () => {
    authState.userId = 'user-1'
    const res = await app.request('/api/admin/users/user-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  it('deletes another user', async () => {
    const res = await app.request('/api/admin/users/user-2', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })
})

// ── Current user ──────────────────────────────────────────────────────────────

describe('GET /api/me', () => {
  it('returns current user info with teams', async () => {
    const res = await app.request('/api/me')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.email).toBe('admin@example.com')
    expect(Array.isArray(body.teams)).toBe(true)
  })

  it('returns 401 when user not found in DB', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/api/me')
    expect(res.status).toBe(401)
  })
})
