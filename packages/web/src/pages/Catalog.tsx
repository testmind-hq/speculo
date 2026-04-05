import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SERVICE_PALETTE_HEX, serviceColorIndex } from '@/lib/serviceColors'

type Branch = { branch: string; endpointCount: number; uploadedAt: string }
type Service = {
  id: string
  name: string
  displayName: string | null
  teamId: string | null
  teamName: string | null
  branches: Branch[]
}
type MyTeam = { id: string; name: string; displayName: string | null; role: string }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return i18n.t('catalog.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return i18n.t('catalog.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return i18n.t('catalog.daysAgo', { count: days })
  return i18n.t('catalog.weeksAgo', { count: Math.floor(days / 7) })
}

function sortBranches(branches: Branch[]): { branch: Branch; isDefault: boolean }[] {
  const mainIdx = branches.findIndex(b => b.branch === 'main')
  let defaultBranch: Branch
  let rest: Branch[]

  if (mainIdx !== -1) {
    defaultBranch = branches[mainIdx]
    rest = branches.filter((_, i) => i !== mainIdx)
  } else {
    const sorted = [...branches].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    defaultBranch = sorted[0]
    rest = sorted.slice(1)
  }

  const restSorted = rest.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  if (!defaultBranch) return []
  return [
    { branch: defaultBranch, isDefault: true },
    ...restSorted.map(b => ({ branch: b, isDefault: false })),
  ]
}

export default function Catalog() {
  const { t } = useTranslation()
  const [services, setServices] = useState<Service[]>([])
  const [myTeamIds, setMyTeamIds] = useState<Set<string> | null>(null)
  const [role, setRole] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = role === 'super_admin'

  useEffect(() => {
    Promise.all([
      api.catalog(),
      api.me().catch(() => ({ id: '', email: '', role: '', teams: null as MyTeam[] | null })),
    ]).then(([catalog, me]) => {
      setServices(catalog.services)
      setRole(me.role ?? '')
      setMyTeamIds(me.teams ? new Set(me.teams.map((m: MyTeam) => m.id)) : null)
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteService(deleteTarget.id)
      setServices(prev => prev.filter(s => s.id !== deleteTarget.id))
      toast.success(t('catalog.deletedSuccess', { name: deleteTarget.displayName ?? deleteTarget.name }))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('catalog.deleteFailed'))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">{t('common.loading')}</p>
  if (error) return <p className="text-destructive">{error}</p>

  const totalBranches = services.reduce((s, svc) => s + svc.branches.length, 0)
  const totalEndpoints = services.reduce((s, svc) => s + svc.branches.reduce((b, br) => b + br.endpointCount, 0), 0)

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {t('catalog.services', { count: services.length })}
        </div>
        <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {t('catalog.branches', { count: totalBranches })}
        </div>
        <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {t('catalog.endpoints', { count: totalEndpoints })}
        </div>
      </div>

      {!services.length && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{t('catalog.noServices')}</p>
          <p className="text-sm mt-2">{t('catalog.noServicesHint')}</p>
        </div>
      )}

      {/* Service cards */}
      {services.map(svc => {
        const isOpen = expanded.has(svc.id)
        const color = SERVICE_PALETTE_HEX[serviceColorIndex(svc.name)]
        const sorted = sortBranches(svc.branches)
        const isCrossTeam = myTeamIds !== null && !!svc.teamId && !myTeamIds.has(svc.teamId)

        return (
          <div key={svc.id} className="rounded-xl border border-border bg-card">
            {/* Header row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleExpanded(svc.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(svc.id) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-xl"
            >
              <span className="text-muted-foreground text-xs">{isOpen ? '▼' : '▶'}</span>
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-sm text-foreground flex-1 min-w-0 truncate">
                {svc.displayName ?? svc.name}
              </span>
              {svc.teamName && (
                <span className="text-xs text-muted-foreground shrink-0">{svc.teamName}</span>
              )}
              {isCrossTeam && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 text-violet-400 border-violet-800 shrink-0">
                  {t('catalog.authorizedAccess')}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {t('catalog.branchCount', { count: svc.branches.length })}
              </span>
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); setDeleteTarget(svc) }}
                  className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  aria-label={t('catalog.deleteServiceLabel')}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Branch rows */}
            {isOpen && (
              <div className="border-t border-border px-4 pb-2 pt-1">
                {sorted.map(({ branch: b, isDefault }) => (
                  <div
                    key={b.branch}
                    className="group flex items-center gap-2 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground text-xs font-mono shrink-0">└──</span>
                    <span className="text-foreground font-mono text-xs">{b.branch}</span>
                    {isDefault && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{t('catalog.defaultBadge')}</Badge>
                    )}
                    <span className="flex-1" />
                    <span className="text-xs text-muted-foreground">{t('catalog.endpointCount', { count: b.endpointCount })}</span>
                    <span className="text-xs text-muted-foreground">{relativeTime(b.uploadedAt)}</span>
                    <a
                      href={`/docs/${svc.name}/${b.branch}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-violet-300 shrink-0"
                    >
                      {t('catalog.view')}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('catalog.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('catalog.deleteConfirm', { name: deleteTarget?.displayName ?? deleteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? t('catalog.deleting') : t('catalog.deleteAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
