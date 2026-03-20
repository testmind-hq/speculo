import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type TeamMember } from '../../lib/api.js'

export default function TeamMembers() {
  const { id } = useParams<{ id: string }>()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member'>('member')
  const [adding, setAdding] = useState(false)

  async function load() {
    if (!id) return
    try {
      const mRes = await api.admin.members.list(id)
      setMembers(mRes.members)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !userId.trim()) return
    setAdding(true)
    try {
      await api.admin.members.add(id, userId.trim(), selectedRole)
      setUserId('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function updateRole(memberId: string, role: 'owner' | 'member') {
    if (!id) return
    try {
      await api.admin.members.updateRole(id, memberId, role)
      setMembers(ms => ms.map(m => m.userId === memberId ? { ...m, role } : m))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function removeMember(memberId: string) {
    if (!id || !confirm('Remove this member?')) return
    try {
      await api.admin.members.remove(id, memberId)
      setMembers(ms => ms.filter(m => m.userId !== memberId))
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-gray-500 hover:text-white text-sm">← Teams</Link>
        <h1 className="text-2xl font-semibold">Team Members</h1>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <form onSubmit={addMember} className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 w-72"
        />
        <select
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value as 'owner' | 'member')}
          className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white"
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        <button
          type="submit"
          disabled={adding || !userId.trim()}
          className="rounded bg-purple-600 px-3 py-1.5 text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          + Add
        </button>
      </form>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {members.map(m => (
              <tr key={m.id} className="bg-gray-900">
                <td className="px-4 py-3 text-white">{m.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={m.role}
                    onChange={e => updateRole(m.userId, e.target.value as 'owner' | 'member')}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
                  >
                    <option value="owner">Owner</option>
                    <option value="member">Member</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => removeMember(m.userId)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
