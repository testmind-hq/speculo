import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setError(t('diff.errorServiceAndBranch'))
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
      setError(err instanceof Error ? err.message : t('diff.errorLoadFailed'))
    } finally {
      setVersionsLoading(false)
    }
  }

  async function handleCompare() {
    if (!service.trim()) { setError(t('diff.errorServiceName')); return }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      let from: string
      let to: string

      if (mode === 'branch') {
        if (!toBranch.trim()) {
          setError(t('diff.errorTargetBranch'))
          setLoading(false)
          return
        }
        const [fromData, toData] = await Promise.all([
          api.diff.versions(service.trim(), fromBranch.trim()),
          api.diff.versions(service.trim(), toBranch.trim()),
        ])
        if (!fromData.versions.length) {
          setError(t('diff.errorNoVersions', { service, branch: fromBranch }))
          setLoading(false)
          return
        }
        if (!toData.versions.length) {
          setError(t('diff.errorNoVersions', { service, branch: toBranch }))
          setLoading(false)
          return
        }
        from = fromData.versions[0].id
        to = toData.versions[0].id
      } else {
        if (!fromVersionId || !toVersionId) {
          setError(t('diff.errorSelectVersions'))
          setLoading(false)
          return
        }
        from = fromVersionId
        to = toVersionId
      }

      const diff = await api.diff.compare(from, to)
      setResult(diff)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('diff.errorCompareFailed'))
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
      <h1 className="text-2xl font-semibold">{t('diff.title')}</h1>

      {/* Mode tabs */}
      <div className="flex gap-1">
        <Button
          variant={mode === 'branch' ? 'secondary' : 'ghost'}
          onClick={() => { setMode('branch'); resetResult() }}
        >
          {t('diff.compareBranches')}
        </Button>
        <Button
          variant={mode === 'history' ? 'secondary' : 'ghost'}
          onClick={() => { setMode('history'); resetResult() }}
        >
          {t('diff.versionHistory')}
        </Button>
      </div>

      {/* Inputs */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="diff-service">{t('diff.serviceNameLabel')}</Label>
              <Input
                id="diff-service"
                value={service}
                onChange={e => { setService(e.target.value); resetResult() }}
                placeholder="e.g. user-service"
              />
            </div>

            {mode === 'branch' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="diff-from">{t('diff.fromBranchLabel')}</Label>
                  <Input
                    id="diff-from"
                    value={fromBranch}
                    onChange={e => { setFromBranch(e.target.value); resetResult() }}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="diff-to">{t('diff.toBranchLabel')}</Label>
                  <Input
                    id="diff-to"
                    value={toBranch}
                    onChange={e => { setToBranch(e.target.value); resetResult() }}
                    placeholder="e.g. feature/my-feature"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="diff-branch">{t('diff.branchLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="diff-branch"
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
                    {versionsLoading ? t('diff.loadingVersions') : t('diff.loadVersions')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Version selectors (history mode) */}
          {mode === 'history' && versions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div className="space-y-1.5">
                <Label>{t('diff.fromVersionLabel')}</Label>
                <Select value={fromVersionId ?? ''} onValueChange={v => setFromVersionId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('diff.selectPlaceholder')} />
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
                <Label>{t('diff.toVersionLabel')}</Label>
                <Select value={toVersionId ?? ''} onValueChange={v => setToVersionId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('diff.selectPlaceholder')} />
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
            <p className="text-sm text-muted-foreground">{t('diff.loadVersionsHint')}</p>
          )}

          <div className="pt-1">
            <Button onClick={handleCompare} disabled={loading}>
              {loading ? t('diff.comparing') : t('diff.compare')}
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
                {t('diff.noDiff')}
              </CardContent>
            </Card>
          ) : (
            <>
              {result.added.length > 0 && (
                <Card className="border-green-800">
                  <CardContent className="pt-5">
                    <h2 className="text-sm font-semibold text-green-400 mb-3">{t('diff.added', { count: result.added.length })}</h2>
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
                    <h2 className="text-sm font-semibold text-destructive mb-3">{t('diff.removed', { count: result.removed.length })}</h2>
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
                    <h2 className="text-sm font-semibold text-amber-400 mb-3">{t('diff.modified', { count: result.modified.length })}</h2>
                    <ul className="space-y-1">
                      {result.modified.map(({ before, after }, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="rounded px-1.5 py-0.5 bg-yellow-800/50 text-yellow-300 font-mono text-xs uppercase">{after.method}</span>
                          <span className="text-yellow-200 font-mono">{after.path}</span>
                          {(before.summary || after.summary) && (
                            <span className="text-yellow-600 truncate">{before.summary ?? '(none)'} → {after.summary ?? '(none)'}</span>
                          )}
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
