const base = ''

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('speculo_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

export type Service = {
  id: string
  name: string
  displayName: string | null
  teamId: string | null
  teamName: string | null
  branches: { branch: string; endpointCount: number; uploadedAt: string }[]
}

export type Team = {
  id: string
  name: string
  displayName: string | null
  description: string | null
  isDefault: boolean
  isDeletable: boolean
  createdAt: string
}

export type TeamMember = {
  id: string
  userId: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

export type Grant = {
  id: string
  ownerTeamId: string
  serviceId: string
  serviceName: string
  branches: string[] | null
  granteeTeamId: string | null
  granteeUserId: string | null
  grantedBy: string
  expiresAt: string | null
  createdAt: string
}

export type User = {
  id: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  teams: { id: string; name: string; role: string }[]
}

export type Me = {
  id: string
  email: string
  role: string
  teams: { id: string; name: string; displayName: string | null; role: string }[]
}

export interface AuditLog {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  targetId: string | null
  targetName: string | null
  meta: string | null
  createdAt: string
}

export interface WebhookConfig {
  id: string
  name: string
  teamId: string | null
  url: string
  providerType: string
  events: string[]
  isActive: boolean
  createdBy: string
  createdAt: string
}

export interface SpecVersion {
  id: string
  serviceId: string
  branch: string
  commitSha: string | null
  endpointCount: number
  isLatest: boolean
  uploadedAt: string
}

export interface EndpointSummary {
  method: string
  path: string
  operationId: string | null
  summary: string | null
}

export interface DiffResult {
  added: EndpointSummary[]
  removed: EndpointSummary[]
  modified: { before: EndpointSummary; after: EndpointSummary }[]
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; userId: string; role: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email: string, password: string) =>
    request<{ userId: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request<Me>('/api/me'),

  catalog: () => request<{ services: Service[] }>('/api/catalog'),

  deleteService: (id: string) =>
    request<{ ok: boolean }>(`/api/catalog/${id}`, { method: 'DELETE' }),

  upload: (formData: FormData) =>
    fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData })
      .then(r => r.json()),

  tokens: {
    list: () => request<{ tokens: Array<{ id: string; name: string; scope: string; prefix: string; lastUsedAt: string | null; createdAt: string }> }>('/api/tokens'),
    create: (name: string, scope: 'read' | 'write') =>
      request<{ id: string; name: string; scope: string; token: string }>('/api/tokens', { method: 'POST', body: JSON.stringify({ name, scope }) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/tokens/${id}`, { method: 'DELETE' }),
  },

  admin: {
    teams: {
      list: () => request<{ teams: Team[] }>('/api/admin/teams'),
      create: (data: { name: string; displayName?: string; description?: string }) =>
        request<Team>('/api/admin/teams', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: { displayName?: string; description?: string }) =>
        request<Team>(`/api/admin/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ ok: boolean }>(`/api/admin/teams/${id}`, { method: 'DELETE' }),
    },
    members: {
      list: (teamId: string) => request<{ members: TeamMember[] }>(`/api/admin/teams/${teamId}/members`),
      add: (teamId: string, userId: string, role: 'owner' | 'member') =>
        request<{ ok: boolean }>(`/api/admin/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
      updateRole: (teamId: string, userId: string, role: 'owner' | 'member') =>
        request<{ ok: boolean }>(`/api/admin/teams/${teamId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
      remove: (teamId: string, userId: string) =>
        request<{ ok: boolean }>(`/api/admin/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
    },
    services: {
      list: (teamId: string) => request<{ services: Pick<Service, 'id' | 'name' | 'displayName'>[] }>(`/api/admin/teams/${teamId}/services`),
      assign: (serviceId: string, teamId: string | null) =>
        request<{ ok: boolean }>(`/api/admin/services/${serviceId}/team`, { method: 'PUT', body: JSON.stringify({ teamId }) }),
    },
    grants: {
      list: (teamId: string) => request<{ outgoing: Grant[]; incoming: Grant[] }>(`/api/admin/teams/${teamId}/grants`),
      create: (teamId: string, data: { serviceId: string; branches?: string[]; granteeTeamId?: string; granteeUserId?: string; expiresAt?: string }) =>
        request<{ id: string }>(`/api/admin/teams/${teamId}/grants`, { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ ok: boolean }>(`/api/admin/grants/${id}`, { method: 'DELETE' }),
    },
    users: {
      list: () => request<{ users: User[] }>('/api/admin/users'),
      update: (id: string, data: { role?: string; isActive?: boolean }) =>
        request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
    },
  },

  audit: {
    list: (params?: { action?: string; userId?: string; from?: string; to?: string; page?: number; pageSize?: number }) => {
      const qs = new URLSearchParams()
      if (params?.action) qs.set('action', params.action)
      if (params?.userId) qs.set('userId', params.userId)
      if (params?.from) qs.set('from', params.from)
      if (params?.to) qs.set('to', params.to)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
      const q = qs.toString()
      return request<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>(`/api/admin/audit-logs${q ? `?${q}` : ''}`)
    },
  },

  webhooks: {
    list: () => request<{ webhooks: WebhookConfig[] }>('/api/admin/webhooks'),
    create: (body: { name: string; url: string; events: string[]; teamId?: string; providerType?: string; isActive?: boolean }) =>
      request<WebhookConfig>('/api/admin/webhooks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; url?: string; events?: string[]; isActive?: boolean }) =>
      request<WebhookConfig>(`/api/admin/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/admin/webhooks/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<{ ok: boolean }>(`/api/admin/webhooks/${id}/test`, { method: 'POST' }),
  },

  diff: {
    compare: (fromId: string, toId: string) => request<DiffResult>(`/api/diff?from=${fromId}&to=${toId}`),
    versions: (service: string, branch: string) =>
      request<{ versions: SpecVersion[] }>(`/api/specs/${encodeURIComponent(service)}/versions?branch=${encodeURIComponent(branch)}`),
  },
}
