import { useState } from 'react'
import { api, type SpecVersion, type DiffResult } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
    if (!service.trim()) { setError('Please enter a service name.'); return }
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
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => { setMode('branch'); resetResult() }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'branch'
              ? 'bg-violet-700 text-white'
              : 'bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          Compare branches
        </button>
        <button
          onClick={() => { setMode('history'); resetResult() }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'history'
              ? 'bg-violet-700 text-white'
              : 'bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          Version history
        </button>
      </div>

      {/* Inputs */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service name</Label>
              <Input
                value={service}
                onChange={e => { setService(e.target.value); resetResult() }}
                placeholder="e.g. user-service"
              />
            </div>

            {mode === 'branch' ? (
              <>
                <div className="space-y-1.5">
                  <Label>From branch</Label>
                  <Input
                    value={fromBranch}
                    onChange={e => { setFromBranch(e.target.value); resetResult() }}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>To branch</Label>
                  <Input
                    value={toBranch}
                    onChange={e => { setToBranch(e.target.value); resetResult() }}
                    placeholder="e.g. feature/my-feature"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <div className="flex gap-2">
                  <Input
                    value={toBranch}
                    onChange={e => { setToBranch(e.target.value); resetResult(); setVersions([]) }}
                    placeholder="e.g. main"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleLoadVersions}
                    disabled={versionsLoading}
                  >
                    {versionsLoading ? 'Loading…' : 'Load versions'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Version selectors (history mode) */}
          {mode === 'history' && versions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div className="space-y-1.5">
                <Label>From version</Label>
                <Select value={fromVersionId ?? ''} onValueChange={v => setFromVersionId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {new Date(v.uploadedAt).toLocaleString()} — {v.commitSha ?? 'no commit'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To version</Label>
                <Select value={toVersionId ?? ''} onValueChange={v => setToVersionId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {new Date(v.uploadedAt).toLocaleString()} — {v.commitSha ?? 'no commit'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {mode === 'history' && versions.length === 0 && toBranch.trim() && !versionsLoading && (
            <p className="text-sm text-muted-foreground">Enter a branch and click "Load versions" to select specific versions to compare.</p>
          )}

          <div className="pt-1">
            <Button onClick={handleCompare} disabled={loading}>
              {loading ? 'Comparing…' : 'Compare'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {hasNoDiff ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No differences found
              </CardContent>
            </Card>
          ) : (
            <>
              {result.added.length > 0 && (
                <Card className="border-green-800">
                  <CardContent className="pt-5">
                    <h2 className="text-sm font-semibold text-green-400 mb-3">Added ({result.added.length})</h2>
                    <ul className="space-y-1">
                      {result.added.map((ep, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="rounded px-1.5 py-0.5 bg-green-800/50 text-green-300 font-mono text-xs uppercase">{ep.method}</span>
                          <span className="text-green-200 font-mono">{ep.path}</span>
                          {ep.summary && <span className="text-green-600 truncate">{ep.summary}</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {result.removed.length > 0 && (
                <Card className="border-destructive/50">
                  <CardContent className="pt-5">
                    <h2 className="text-sm font-semibold text-destructive mb-3">Removed ({result.removed.length})</h2>
                    <ul className="space-y-1">
                      {result.removed.map((ep, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="rounded px-1.5 py-0.5 bg-red-800/50 text-red-300 font-mono text-xs uppercase">{ep.method}</span>
                          <span className="text-red-200 font-mono">{ep.path}</span>
                          {ep.summary && <span className="text-red-600 truncate">{ep.summary}</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {result.modified.length > 0 && (
                <Card className="border-amber-800/50">
                  <CardContent className="pt-5">
                    <h2 className="text-sm font-semibold text-amber-400 mb-3">Modified ({result.modified.length})</h2>
                    <ul className="space-y-1">
                      {result.modified.map(({ before, after }, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="rounded px-1.5 py-0.5 bg-yellow-800/50 text-yellow-300 font-mono text-xs uppercase">{after.method}</span>
                          <span className="text-yellow-200 font-mono">{after.path}</span>
                          {after.summary && <span className="text-yellow-600 truncate">{before.summary} → {after.summary}</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
