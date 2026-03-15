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

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email: string, password: string) =>
    request<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  catalog: () =>
    request<{ services: Array<{ id: string; name: string; displayName: string | null; branches: Array<{ branch: string; endpointCount: number; uploadedAt: string }> }> }>('/api/catalog'),

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
}
