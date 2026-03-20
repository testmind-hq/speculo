import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Team } from '../../lib/api.js'

export default function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    try {
      const data = await api.admin.teams.list()
      setTeams(data.teams)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.admin.teams.create({ name: newName.trim() })
      setNewName('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team?')) return
    try {
      await api.admin.teams.delete(id)
      setTeams(t => t.filter(x => x.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teams</h1>
        <form onSubmit={createTeam} className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="team-name"
            className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-purple-600 px-3 py-1.5 text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            + Create
          </button>
        </form>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Display Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {teams.map(t => (
              <tr key={t.id} className="bg-gray-900 hover:bg-gray-800">
                <td className="px-4 py-3 text-white font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-400">{t.displayName ?? '—'}</td>
                <td className="px-4 py-3">
                  {t.isDefault
                    ? <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs text-blue-300">default</span>
                    : <span className="text-gray-500">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link to={`/admin/teams/${t.id}/members`} className="text-purple-400 hover:text-purple-300 text-xs">Members</Link>
                    <Link to={`/admin/teams/${t.id}/services`} className="text-purple-400 hover:text-purple-300 text-xs">Services</Link>
                    <Link to={`/admin/teams/${t.id}/grants`} className="text-purple-400 hover:text-purple-300 text-xs">Grants</Link>
                    {t.isDeletable && (
                      <button onClick={() => deleteTeam(t.id)} className="text-red-500 hover:text-red-400 text-xs">Delete</button>
                    )}
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
