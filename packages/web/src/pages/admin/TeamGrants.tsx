import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Grant, type Team, type Service } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export default function TeamGrants() {
  const { id } = useParams<{ id: string }>()
  const [outgoing, setOutgoing] = useState<Grant[]>([])
  const [incoming, setIncoming] = useState<Grant[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'out' | 'in'>('out')
  const [revokeTarget, setRevokeTarget] = useState<Grant | null>(null)
  const [revoking, setRevoking] = useState(false)

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
      const [gRes, sRes] = await Promise.all([
        api.admin.grants.list(id),
        api.catalog(),
      ])
      setOutgoing(gRes.outgoing)
      setIncoming(gRes.incoming)
      setServices(sRes.services)
      try {
        const tRes = await api.admin.teams.list()
        setTeams(tRes.teams.filter(t => t.id !== id))
      } catch {
        // not super_admin — teams list unavailable
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await api.admin.grants.delete(revokeTarget.id)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRevoking(false)
      setRevokeTarget(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  const currentList = tab === 'out' ? outgoing : incoming

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-muted-foreground hover:text-foreground text-sm">← Teams</Link>
        <h1 className="text-2xl font-semibold">Cross-Team Grants</h1>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {tab === 'out' && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">New Grant</p>
          <form onSubmit={createGrant} className="flex flex-wrap gap-2">
            <Select value={newServiceId} onValueChange={setNewServiceId}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select service…" />
              </SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={granteeType} onValueChange={v => setGranteeType(v as 'team' | 'user')}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="user">User ID</SelectItem>
              </SelectContent>
            </Select>

            {granteeType === 'team' ? (
              <Select value={granteeTeamId} onValueChange={setGranteeTeamId}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select team…" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={granteeUserId}
                onChange={e => setGranteeUserId(e.target.value)}
                placeholder="user-id"
                className="w-36"
              />
            )}

            <Input
              value={branchInput}
              onChange={e => setBranchInput(e.target.value)}
              placeholder="branches (comma-sep)"
              className="w-48"
            />

            <Input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="w-40"
            />

            <Button type="submit" disabled={submitting || !newServiceId}>Grant</Button>
          </form>
        </div>
      )}

      <div className="flex gap-1">
        {(['out', 'in'] as const).map(t => (
          <Button
            key={t}
            variant={tab === t ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab(t)}
          >
            {t === 'out' ? `Outgoing (${outgoing.length})` : `Incoming (${incoming.length})`}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>{tab === 'out' ? 'Grantee' : 'Owner'}</TableHead>
            <TableHead>Branches</TableHead>
            <TableHead>Expires</TableHead>
            {tab === 'out' && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentList.map(g => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.serviceName}</TableCell>
              <TableCell className="text-muted-foreground">
                {tab === 'out'
                  ? (g.granteeTeamId
                    ? <span className="text-blue-400">Team: {teams.find(t => t.id === g.granteeTeamId)?.name ?? g.granteeTeamId}</span>
                    : <span className="text-green-400">User: {g.granteeUserId}</span>)
                  : g.ownerTeamId
                }
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {g.branches?.length ? g.branches.join(', ') : <span className="text-muted-foreground/50">all</span>}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : <span className="text-muted-foreground/50">never</span>}
              </TableCell>
              {tab === 'out' && (
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(g)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">Revoke</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {currentList.length === 0 && (
            <TableRow>
              <TableCell colSpan={tab === 'out' ? 5 : 4} className="text-center text-muted-foreground">No grants.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Grant</DialogTitle>
            <DialogDescription>
              Revoke access to "{revokeTarget?.serviceName}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRevoke} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
