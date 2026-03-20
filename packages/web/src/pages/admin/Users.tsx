import { useEffect, useState } from 'react'
import { api, type User } from '../../lib/api.js'

const ROLES = ['super_admin', 'team_owner', 'team_member', 'guest'] as const

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await api.admin.users.list()
      setUsers(data.users)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function updateRole(id: string, role: string) {
    try {
      await api.admin.users.update(id, { role })
      setUsers(us => us.map(u => u.id === id ? { ...u, role } : u))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await api.admin.users.update(id, { isActive: !current })
      setUsers(us => us.map(u => u.id === id ? { ...u, isActive: !current } : u))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Delete user ${email}?`)) return
    try {
      await api.admin.users.delete(id)
      setUsers(us => us.filter(u => u.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Teams</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.map(u => (
              <tr key={u.id} className="bg-gray-900">
                <td className="px-4 py-3 text-white">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => updateRole(u.id, e.target.value)}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {u.teams.length > 0
                    ? u.teams.map(t => (
                      <span key={t.id} className="mr-1 rounded-full bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs">
                        {t.name}
                      </span>
                    ))
                    : <span className="text-gray-600">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {u.isActive
                    ? <span className="text-green-400 text-xs">Active</span>
                    : <span className="text-gray-600 text-xs">Disabled</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleActive(u.id, u.isActive)}
                      className="text-yellow-500 hover:text-yellow-400 text-xs"
                    >
                      {u.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteUser(u.id, u.email)}
                      className="text-red-500 hover:text-red-400 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
