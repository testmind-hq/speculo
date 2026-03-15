import { eq, and, inArray, isNull, or, gt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, services, teamMembers, crossTeamGrants } from '../db/schema.js'

/** Returns true if userId can access the given service branch. */
export async function canAccessBranch(
  userId: string,
  serviceName: string,
  branch: string,
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.isActive, true)),
    columns: { role: true },
  })
  if (!user) return false

  // super_admin has full access
  if (user.role === 'super_admin') return true

  const service = await db.query.services.findFirst({
    where: eq(services.name, serviceName),
    columns: { id: true, teamId: true },
  })
  if (!service) return false

  // team_member / team_owner of the service's owning team have full access
  if (service.teamId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, service.teamId)),
    })
    if (membership) return true
  }

  // Cross-team grants: team-level
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
  const userTeamIds = userTeams.map(r => r.teamId)

  if (userTeamIds.length > 0) {
    const teamGrant = await db.query.crossTeamGrants.findFirst({
      where: and(
        eq(crossTeamGrants.serviceId, service.id),
        inArray(crossTeamGrants.granteeTeamId, userTeamIds),
        or(isNull(crossTeamGrants.expiresAt), gt(crossTeamGrants.expiresAt, new Date())),
      ),
    })
    if (teamGrant) return checkBranch(teamGrant.branches, branch)
  }

  // Cross-team grants: user-level
  const userGrant = await db.query.crossTeamGrants.findFirst({
    where: and(
      eq(crossTeamGrants.serviceId, service.id),
      eq(crossTeamGrants.granteeUserId, userId),
      or(isNull(crossTeamGrants.expiresAt), gt(crossTeamGrants.expiresAt, new Date())),
    ),
  })
  if (userGrant) return checkBranch(userGrant.branches, branch)

  return false
}

function checkBranch(allowed: string[] | null, branch: string): boolean {
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(branch)
}

/** Returns the default team id (the `is_default = true` team). */
export async function getDefaultTeamId(): Promise<string | null> {
  const { teams } = await import('../db/schema.js')
  const team = await db.query.teams.findFirst({
    where: eq(teams.isDefault, true),
    columns: { id: true },
  })
  return team?.id ?? null
}

/** Returns all team IDs the user belongs to. */
export async function getUserTeamIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
  return rows.map(r => r.teamId)
}
