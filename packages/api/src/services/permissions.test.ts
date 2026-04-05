import { describe, it, expect, vi, beforeEach } from 'vitest'

// All DB calls are mocked — no real DB needed
const mockSelect = vi.fn()
const mockFindFirstService = vi.fn()
const mockFindManyGrant = vi.fn()

vi.mock('../db/index.js', () => ({
  db: {
    select: mockSelect,
    query: {
      services: { findFirst: mockFindFirstService },
      crossTeamGrants: { findMany: mockFindManyGrant },
    },
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { getAccessibleServiceIds, canAccessService } = await import('./permissions.js')

// Helper: make db.select chain return a value
function makeSelectChain(rows: unknown[]) {
  const chain: any = { from: vi.fn(), where: vi.fn(), $dynamic: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockResolvedValue(rows)
  return chain
}

describe('getAccessibleServiceIds', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null for super_admin (all services)', async () => {
    const result = await getAccessibleServiceIds('user-1', 'super_admin')
    expect(result).toBeNull()
  })

  it('returns set with owned service IDs for team member', async () => {
    // First select: teamMembers → returns team-1
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    // Second select: owned services → returns svc-1
      .mockReturnValueOnce(makeSelectChain([{ id: 'svc-1' }]))
    // Third select: granted services → returns nothing
      .mockReturnValueOnce(makeSelectChain([]))

    const result = await getAccessibleServiceIds('user-1', 'guest')
    expect(result).toEqual(new Set(['svc-1']))
  })

  it('returns set with granted service IDs for guest', async () => {
    // First select: teamMembers → no teams
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
    // Second select: granted services → returns svc-2
      .mockReturnValueOnce(makeSelectChain([{ serviceId: 'svc-2' }]))

    const result = await getAccessibleServiceIds('user-1', 'guest')
    expect(result).toEqual(new Set(['svc-2']))
  })

  it('returns empty set when user has no teams and no grants', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))  // teamMembers
      .mockReturnValueOnce(makeSelectChain([]))  // grants

    const result = await getAccessibleServiceIds('user-1', 'guest')
    expect(result).toEqual(new Set())
  })
})

describe('canAccessService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns true for super_admin without any DB call', async () => {
    const result = await canAccessService('user-1', 'super_admin', 'user-service')
    expect(result).toBe(true)
    expect(mockFindFirstService).not.toHaveBeenCalled()
  })

  it('returns false for unknown service', async () => {
    mockFindFirstService.mockResolvedValue(undefined)
    const result = await canAccessService('user-1', 'guest', 'nonexistent')
    expect(result).toBe(false)
  })

  it('returns true when user is a member of the owning team', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-1' })
    // teamMembers select
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    const result = await canAccessService('user-1', 'guest', 'user-service')
    expect(result).toBe(true)
    expect(mockFindManyGrant).not.toHaveBeenCalled()
  })

  it('returns true when user has a cross-team grant for all branches', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-2' })
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    mockFindManyGrant.mockResolvedValue([{ branches: null }])  // null = all branches

    const result = await canAccessService('user-1', 'guest', 'user-service', 'main')
    expect(result).toBe(true)
  })

  it('returns true when grant covers the requested branch', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-2' })
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    mockFindManyGrant.mockResolvedValue([{ branches: ['main', 'staging'] }])

    const result = await canAccessService('user-1', 'guest', 'user-service', 'main')
    expect(result).toBe(true)
  })

  it('returns false when grant exists but does not cover the requested branch', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-2' })
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    mockFindManyGrant.mockResolvedValue([{ branches: ['staging'] }])

    const result = await canAccessService('user-1', 'guest', 'user-service', 'main')
    expect(result).toBe(false)
  })

  it('returns false when no grant exists and user is not a team member', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-2' })
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    mockFindManyGrant.mockResolvedValue([])

    const result = await canAccessService('user-1', 'guest', 'user-service')
    expect(result).toBe(false)
  })

  it('returns false when all grants are expired (findMany returns empty)', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-2' })
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    // expiry filter excluded the grant — findMany returns empty
    mockFindManyGrant.mockResolvedValue([])

    const result = await canAccessService('user-1', 'guest', 'user-service', 'main')
    expect(result).toBe(false)
  })

  it('returns true when first grant is restrictive but second grant covers all branches', async () => {
    mockFindFirstService.mockResolvedValue({ id: 'svc-1', teamId: 'team-2' })
    mockSelect.mockReturnValueOnce(makeSelectChain([{ teamId: 'team-1' }]))
    // First grant: restricts to staging only; second grant: covers all branches (null)
    mockFindManyGrant.mockResolvedValue([
      { branches: ['staging'] },
      { branches: null },
    ])

    const result = await canAccessService('user-1', 'guest', 'user-service', 'main')
    expect(result).toBe(true)
  })
})
