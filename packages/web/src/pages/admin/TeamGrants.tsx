import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Grant, type Team, type Service } from '../../lib/api.js'

export default function TeamGrants() {
  const { id } = useParams<{ id: string }>()
  const [outgoing, setOutgoing] = useState<Grant[]>([])
  const [incoming, setIncoming] = useState<Grant[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'out' | 'in'>('out')

  // new grant form state
  const [newServiceId, setNewServiceId] = useState('')
  const [granteeType, setGranteeType] = useState<'team' | 'user'>('team')
  const [granteeTeamId, setGranteeTeamId] = useState('')
  const [granteeUserId, setGranteeUserId] = useState('')
  const [branchInput, setBranchInput] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!id) return
    try {
      const [gRes, tRes, sRes] = await Promise.all([
        api.admin.grants.list(id),
        api.admin.teams.list(),
        api.catalog(),
      ])
      setOutgoing(gRes.outgoing)
      setIncoming(gRes.incoming)
      setTeams(tRes.teams.filter(t => t.id !== id))
      setServices(sRes.services)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function createGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !newServiceId) return
    setSubmitting(true)
    try {
      const branches = branchInput.trim() ? branchInput.split(',').map(b => b.trim()).filter(Boolean) : undefined
      await api.admin.grants.create(id, {
        serviceId: newServiceId,
        branches,
        granteeTeamId: granteeType === 'team' && granteeTeamId ? granteeTeamId : undefined,
        granteeUserId: granteeType === 'user' && granteeUserId ? granteeUserId : undefined,
        expiresAt: expiresAt || undefined,
      })
      setNewServiceId('')
      setGranteeTeamId('')
      setGranteeUserId('')
      setBranchInput('')
      setExpiresAt('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function revokeGrant(grantId: string) {
    if (!confirm('Revoke this grant?')) return
    try {
      await api.admin.grants.delete(grantId)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  const currentList = tab === 'out' ? outgoing : incoming

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-gray-500 hover:text-white text-sm">← Teams</Link>
        <h1 className="text-2xl font-semibold">Cross-Team Grants</h1>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {tab === 'out' && (
        <form onSubmit={createGrant} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-300">New Grant</p>
          <div className="flex flex-wrap gap-2">
            <select value={newServiceId} onChange={e => setNewServiceId(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white">
              <option value="">Select service…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select value={granteeType} onChange={e => setGranteeType(e.target.value as 'team' | 'user')}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white">
              <option value="team">Team</option>
              <option value="user">User (email)</option>
            </select>

            {granteeType === 'team'
              ? (
                <select value={granteeTeamId} onChange={e => setGranteeTeamId(e.target.value)}
                  className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white">
                  <option value="">Select team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : (
                <input value={granteeUserId} onChange={e => setGranteeUserId(e.target.value)}
                  placeholder="user-id"
                  className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white" />
              )
            }

            <input value={branchInput} onChange={e => setBranchInput(e.target.value)}
              placeholder="branches (comma-sep, blank=all)"
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white w-48" />

            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white" />

            <button type="submit" disabled={submitting || !newServiceId}
              className="rounded bg-purple-600 px-3 py-1.5 text-sm hover:bg-purple-700 disabled:opacity-50">
              Grant
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-1">
        {(['out', 'in'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
            {t === 'out' ? `Outgoing (${outgoing.length})` : `Incoming (${incoming.length})`}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">{tab === 'out' ? 'Grantee' : 'Owner'}</th>
              <th className="px-4 py-3 text-left">Branches</th>
              <th className="px-4 py-3 text-left">Expires</th>
              {tab === 'out' && <th className="px-4 py-3 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {currentList.map(g => (
              <tr key={g.id} className="bg-gray-900">
                <td className="px-4 py-3 text-white">{g.serviceName}</td>
                <td className="px-4 py-3 text-gray-400">
                  {tab === 'out'
                    ? (g.granteeTeamId
                      ? <span className="text-blue-400">🏷 {teams.find(t => t.id === g.granteeTeamId)?.name ?? g.granteeTeamId}</span>
                      : <span className="text-green-400">👤 {g.granteeUserId}</span>)
                    : g.ownerTeamId
                  }
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {g.branches?.length ? g.branches.join(', ') : <span className="text-gray-600">all</span>}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : <span className="text-gray-600">never</span>}
                </td>
                {tab === 'out' && (
                  <td className="px-4 py-3">
                    <button onClick={() => revokeGrant(g.id)} className="text-red-500 hover:text-red-400 text-xs">Revoke</button>
                  </td>
                )}
              </tr>
            ))}
            {currentList.length === 0 && (
              <tr><td colSpan={tab === 'out' ? 5 : 4} className="px-4 py-8 text-center text-gray-500">No grants.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
