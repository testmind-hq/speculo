import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, type Team } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export default function AdminTeams() {
  const { t: tr } = useTranslation()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const data = await api.admin.teams.list()
      setTeams(data.teams)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.admin.teams.create({ name: newName.trim() })
      setNewName('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.admin.teams.delete(deleteTarget.id)
      setTeams(ts => ts.filter(x => x.id !== deleteTarget.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">{tr('common.loading')}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{tr('admin.teams.title')}</h1>
        <form onSubmit={createTeam} className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="team-name"
            className="w-40"
          />
          <Button type="submit" disabled={creating}>{tr('admin.teams.createButton')}</Button>
        </form>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tr('admin.teams.nameHead')}</TableHead>
            <TableHead>{tr('admin.teams.displayNameHead')}</TableHead>
            <TableHead>{tr('admin.teams.typeHead')}</TableHead>
            <TableHead>{tr('admin.teams.actionsHead')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map(team => (
            <TableRow key={team.id}>
              <TableCell className="font-medium">{team.name}</TableCell>
              <TableCell className="text-muted-foreground">{team.displayName ?? '—'}</TableCell>
              <TableCell>
                {team.isDefault
                  ? <Badge variant="secondary">{tr('admin.teams.defaultBadge')}</Badge>
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <div className="flex gap-3 text-xs">
                  <Link to={`/admin/teams/${team.id}/members`} className="text-violet-400 hover:text-violet-300">{tr('admin.teams.membersLink')}</Link>
                  <Link to={`/admin/teams/${team.id}/services`} className="text-violet-400 hover:text-violet-300">{tr('admin.teams.servicesLink')}</Link>
                  <Link to={`/admin/teams/${team.id}/grants`} className="text-violet-400 hover:text-violet-300">{tr('admin.teams.grantsLink')}</Link>
                  {team.isDeletable && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(team)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">{tr('admin.teams.deleteButton')}</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('admin.teams.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {tr('admin.teams.deleteConfirm', { name: deleteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{tr('admin.teams.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? tr('admin.teams.deleting') : tr('admin.teams.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
