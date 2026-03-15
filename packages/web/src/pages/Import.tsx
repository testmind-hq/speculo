import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function Import() {
  const [service, setService] = useState('')
  const [branch, setBranch] = useState('main')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ endpointCount: number; wasConverted: boolean; warnings: string[] } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a file'); return }
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('service', service)
    formData.append('branch', branch)
    formData.append('file', file)

    try {
      const data = await api.upload(formData)
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Import API Spec</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">Service name</label>
          <input value={service} onChange={e => setService(e.target.value)} required
            placeholder="user-service"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Branch</label>
          <input value={branch} onChange={e => setBranch(e.target.value)} required
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
        </div>
        <div
          onDrop={onDrop} onDragOver={e => e.preventDefault()}
          onClick={() => fileInput.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-gray-700 p-10 text-center hover:border-purple-500"
        >
          <input ref={fileInput} type="file" accept=".yaml,.yml,.json" className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <p className="text-sm text-purple-400">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-500">Drop openapi.yaml / openapi.json here<br />or click to select</p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <div className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-400">
            ✓ Uploaded — {result.endpointCount} endpoints{result.wasConverted ? ' (converted from Swagger 2.0)' : ''}
            {result.warnings.length > 0 && <p className="mt-1 text-yellow-400">{result.warnings.join(', ')}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/')}
            className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-400 hover:text-white">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50">
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  )
}
