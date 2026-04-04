import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { crossTeamGrants, services, teamMembers } from '../db/schema.js'

/**
 * Returns the set of service IDs accessible to the user.
 * Returns null for super_admin (all services accessible).
 * Returns an empty Set if the user has no accessible services.
 */
export async function getAccessibleServiceIds(
  userId: string,
  userRole: string,
): Promise<Set<string> | null> {
  if (userRole === 'super_admin') return null

  const userTeamRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
  const userTeamIds = userTeamRows.map(r => r.teamId)

  const ownedServices = userTeamIds.length > 0
    ? await db
        .select({ id: services.id })
        .from(services)
        .where(inArray(services.teamId, userTeamIds))
    : []

  const grantedServices = await db
    .select({ serviceId: crossTeamGrants.serviceId })
    .from(crossTeamGrants)
    .where(and(
      or(
        userTeamIds.length > 0
          ? inArray(crossTeamGrants.granteeTeamId, userTeamIds)
          : sql`false`,
        eq(crossTeamGrants.granteeUserId, userId),
      ),
      or(isNull(crossTeamGrants.expiresAt), gt(crossTeamGrants.expiresAt, new Date())),
    ))

  return new Set([
    ...ownedServices.map(s => s.id),
    ...grantedServices.map(g => g.serviceId),
  ])
}

/**
 * Returns true if the user can access the named service.
 * If `branch` is provided, also checks branch-level grant restrictions.
 * super_admin always returns true without any DB queries.
 */
export async function canAccessService(
  userId: string,
  userRole: string,
  serviceName: string,
  branch?: string,
): Promise<boolean> {
  if (userRole === 'super_admin') return true

  const svc = await db.query.services.findFirst({
    where: eq(services.name, serviceName),
    columns: { id: true, teamId: true },
  })
  if (!svc) return false

  const userTeamRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
  const userTeamIds = userTeamRows.map(r => r.teamId)

  // Direct team membership — access all branches unconditionally
  if (svc.teamId && userTeamIds.includes(svc.teamId)) return true

  // Cross-team or personal grant (with optional expiry)
  const grants = await db.query.crossTeamGrants.findMany({
    where: and(
      eq(crossTeamGrants.serviceId, svc.id),
      or(
        userTeamIds.length > 0
          ? inArray(crossTeamGrants.granteeTeamId, userTeamIds)
          : sql`false`,
        eq(crossTeamGrants.granteeUserId, userId),
      ),
      or(isNull(crossTeamGrants.expiresAt), gt(crossTeamGrants.expiresAt, new Date())),
    ),
    columns: { branches: true },
  })

  if (grants.length === 0) return false
  // Return true if any grant covers the requested branch
  return grants.some(grant => {
    if (!branch || !grant.branches) return true  // grant covers all branches
    return grant.branches.includes(branch)
  })
}
