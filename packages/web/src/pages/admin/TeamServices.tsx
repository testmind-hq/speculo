import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Service } from '../../lib/api.js'

export default function TeamServices() {
  const { id } = useParams<{ id: string }>()
  const [teamServices, setTeamServices] = useState<Pick<Service, 'id' | 'name' | 'displayName'>[]>([])
  const [allServices, setAllServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isSuperAdmin = localStorage.getItem('speculo_role') === 'super_admin'

  async function load() {
    if (!id) return
    try {
      const [tsRes, allRes] = await Promise.all([
        api.admin.services.list(id),
        api.catalog(),
      ])
      setTeamServices(tsRes.services)
      setAllServices(allRes.services)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function assignService(serviceId: string) {
    if (!id) return
    try {
      await api.admin.services.assign(serviceId, id)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function removeService(serviceId: string) {
    if (!confirm('Remove service from this team?')) return
    try {
      await api.admin.services.assign(serviceId, null)
      setTeamServices(s => s.filter(x => x.id !== serviceId))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const teamServiceIds = new Set(teamServices.map(s => s.id))
  const unassigned = allServices.filter(s => !teamServiceIds.has(s.id))

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-gray-500 hover:text-white text-sm">← Teams</Link>
        <h1 className="text-2xl font-semibold">Team Services</h1>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isSuperAdmin && unassigned.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Assign a service to this team:</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(s => (
              <button
                key={s.id}
                onClick={() => assignService(s.id)}
                className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-purple-500 hover:text-purple-400"
              >
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {teamServices.map(s => (
              <tr key={s.id} className="bg-gray-900">
                <td className="px-4 py-3 text-white">{s.displayName ?? s.name}</td>
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    <button onClick={() => removeService(s.id)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                  </td>
                )}
              </tr>
            ))}
            {teamServices.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">No services in this team.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
