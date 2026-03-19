import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

type Service = { id: string; name: string; displayName: string | null; teamId: string | null; teamName: string | null; branches: { branch: string; endpointCount: number; uploadedAt: string }[] }

export default function Catalog() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const isAdmin = localStorage.getItem('speculo_role') === 'super_admin'

  useEffect(() => {
    api.catalog()
      .then(data => setServices(data.services))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(svc: Service) {
    if (!confirm(`Delete service "${svc.displayName ?? svc.name}" and all its specs? This cannot be undone.`)) return
    setDeleting(svc.id)
    try {
      await api.deleteService(svc.id)
      setServices(prev => prev.filter(s => s.id !== svc.id))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (error) return <p className="text-red-400">{error}</p>
  if (!services.length) return (
    <div className="text-center py-16 text-gray-500">
      <p className="text-lg">No services yet.</p>
      <p className="text-sm mt-2">Import your first OpenAPI spec to get started.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Services</h1>
      {services.map(svc => (
        <div key={svc.id} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h2 className="font-medium text-white">{svc.displayName ?? svc.name}</h2>
                {svc.teamName && (
                  <span className="inline-flex items-center rounded-full bg-purple-900/40 border border-purple-700/50 px-2 py-0.5 text-xs text-purple-300">
                    {svc.teamName}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3">{svc.name}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleDelete(svc)}
                disabled={deleting === svc.id}
                className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-red-500 hover:text-red-400 disabled:opacity-50"
              >
                {deleting === svc.id ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {svc.branches.map(b => (
              <a
                key={b.branch}
                href={`/docs/${svc.name}/${b.branch}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs hover:border-purple-500 hover:text-purple-400"
              >
                <span className="text-gray-300">{b.branch}</span>
                <span className="text-gray-500">{b.endpointCount} endpoints</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
