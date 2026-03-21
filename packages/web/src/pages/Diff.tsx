import { useState } from 'react'
import { api, type SpecVersion, type DiffResult } from '../lib/api.js'

type Mode = 'branch' | 'history'

export default function Diff() {
  const [mode, setMode] = useState<Mode>('branch')
  const [service, setService] = useState('')
  const [fromBranch, setFromBranch] = useState('main')
  const [toBranch, setToBranch] = useState('')
  const [fromVersionId, setFromVersionId] = useState<string | null>(null)
  const [toVersionId, setToVersionId] = useState<string | null>(null)
  const [versions, setVersions] = useState<SpecVersion[]>([])
  const [result, setResult] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetResult() {
    setResult(null)
    setError(null)
  }

  async function handleLoadVersions() {
    if (!service.trim() || !toBranch.trim()) {
      setError('Please enter both a service name and branch.')
      return
    }
    setVersionsLoading(true)
    setError(null)
    setVersions([])
    setFromVersionId(null)
    setToVersionId(null)
    setResult(null)
    try {
      const data = await api.diff.versions(service.trim(), toBranch.trim())
      setVersions(data.versions)
      if (data.versions.length >= 1) setToVersionId(data.versions[0].id)
      if (data.versions.length >= 2) setFromVersionId(data.versions[1].id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load versions.')
    } finally {
      setVersionsLoading(false)
    }
  }

  async function handleCompare() {
    if (!service.trim()) {
      setError('Please enter a service name.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      let from: string
      let to: string

      if (mode === 'branch') {
        if (!toBranch.trim()) {
          setError('Please enter the target branch to compare.')
          setLoading(false)
          return
        }
        // Load latest version ID for each branch
        const [fromData, toData] = await Promise.all([
          api.diff.versions(service.trim(), fromBranch.trim()),
          api.diff.versions(service.trim(), toBranch.trim()),
        ])
        if (!fromData.versions.length) {
          setError(`No versions found for service "${service}" on branch "${fromBranch}".`)
          setLoading(false)
          return
        }
        if (!toData.versions.length) {
          setError(`No versions found for service "${service}" on branch "${toBranch}".`)
          setLoading(false)
          return
        }
        from = fromData.versions[0].id
        to = toData.versions[0].id
      } else {
        // History mode
        if (!fromVersionId || !toVersionId) {
          setError('Please load versions and select both From and To versions.')
          setLoading(false)
          return
        }
        from = fromVersionId
        to = toVersionId
      }

      const diff = await api.diff.compare(from, to)
      setResult(diff)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Comparison failed.')
    } finally {
      setLoading(false)
    }
  }

  const hasNoDiff =
    result !== null &&
    result.added.length === 0 &&
    result.removed.length === 0 &&
    result.modified.length === 0

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Spec Diff</h1>

      {/* Mode tabs */}
      <div className="flex rounded-lg border border-gray-700 overflow-hidden w-fit">
        <button
          onClick={() => { setMode('branch'); resetResult() }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'branch'
              ? 'bg-purple-700 text-white'
              : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Compare branches
        </button>
        <button
          onClick={() => { setMode('history'); resetResult() }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'history'
              ? 'bg-purple-700 text-white'
              : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Version history
        </button>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Service name</label>
            <input
              type="text"
              value={service}
              onChange={e => { setService(e.target.value); resetResult() }}
              placeholder="e.g. user-service"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {mode === 'branch' ? (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">From branch</label>
                <input
                  type="text"
                  value={fromBranch}
                  onChange={e => { setFromBranch(e.target.value); resetResult() }}
                  placeholder="main"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">To branch</label>
                <input
                  type="text"
                  value={toBranch}
                  onChange={e => { setToBranch(e.target.value); resetResult() }}
                  placeholder="e.g. feature/my-feature"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Branch</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={toBranch}
                  onChange={e => { setToBranch(e.target.value); resetResult(); setVersions([]) }}
                  placeholder="e.g. main"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
                <button
                  onClick={handleLoadVersions}
                  disabled={versionsLoading}
                  className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-purple-500 hover:text-purple-400 disabled:opacity-50"
                >
                  {versionsLoading ? 'Loading…' : 'Load versions'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Version selectors (history mode) */}
        {mode === 'history' && versions.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="block text-sm text-gray-400 mb-1">From version</label>
              <select
                value={fromVersionId ?? ''}
                onChange={e => setFromVersionId(e.target.value || null)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Select…</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.uploadedAt).toLocaleString()} — {v.commitSha ?? 'no commit'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">To version</label>
              <select
                value={toVersionId ?? ''}
                onChange={e => setToVersionId(e.target.value || null)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Select…</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.uploadedAt).toLocaleString()} — {v.commitSha ?? 'no commit'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mode === 'history' && versions.length === 0 && toBranch.trim() && !versionsLoading && (
          <p className="text-sm text-gray-500">Enter a branch and click "Load versions" to select specific versions to compare.</p>
        )}

        <div className="pt-1">
          <button
            onClick={handleCompare}
            disabled={loading}
            className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {hasNoDiff ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-8 text-center text-gray-500">
              No differences found
            </div>
          ) : (
            <>
              {result.added.length > 0 && (
                <div className="rounded-xl border border-green-800 bg-green-900/20 p-5">
                  <h2 className="text-sm font-semibold text-green-400 mb-3">
                    Added ({result.added.length})
                  </h2>
                  <ul className="space-y-1">
                    {result.added.map((ep, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="rounded px-1.5 py-0.5 bg-green-800/50 text-green-300 font-mono text-xs uppercase">
                          {ep.method}
                        </span>
                        <span className="text-green-200 font-mono">{ep.path}</span>
                        {ep.summary && (
                          <span className="text-green-600 truncate">{ep.summary}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.removed.length > 0 && (
                <div className="rounded-xl border border-red-800 bg-red-900/20 p-5">
                  <h2 className="text-sm font-semibold text-red-400 mb-3">
                    Removed ({result.removed.length})
                  </h2>
                  <ul className="space-y-1">
                    {result.removed.map((ep, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="rounded px-1.5 py-0.5 bg-red-800/50 text-red-300 font-mono text-xs uppercase">
                          {ep.method}
                        </span>
                        <span className="text-red-200 font-mono">{ep.path}</span>
                        {ep.summary && (
                          <span className="text-red-600 truncate">{ep.summary}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.modified.length > 0 && (
                <div className="rounded-xl border border-yellow-800 bg-yellow-900/20 p-5">
                  <h2 className="text-sm font-semibold text-yellow-400 mb-3">
                    Modified ({result.modified.length})
                  </h2>
                  <ul className="space-y-1">
                    {result.modified.map((ep, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="rounded px-1.5 py-0.5 bg-yellow-800/50 text-yellow-300 font-mono text-xs uppercase">
                          {ep.method}
                        </span>
                        <span className="text-yellow-200 font-mono">{ep.path}</span>
                        {ep.summary && (
                          <span className="text-yellow-600 truncate">{ep.summary}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
