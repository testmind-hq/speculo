import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

type Service = { id: string; name: string; displayName: string | null; branches: { branch: string; endpointCount: number; uploadedAt: string }[] }

export default function Catalog() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.catalog()
      .then(data => setServices(data.services))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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
          <h2 className="font-medium text-white">{svc.displayName ?? svc.name}</h2>
          <p className="text-sm text-gray-500 mb-3">{svc.name}</p>
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
