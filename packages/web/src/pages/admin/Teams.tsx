import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    } catch (e: any) {
      setError(e.message)
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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.admin.teams.delete(deleteTarget.id)
      setTeams(t => t.filter(x => x.id !== deleteTarget.id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teams</h1>
        <form onSubmit={createTeam} className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="team-name"
            className="w-40"
          />
          <Button type="submit" disabled={creating}>+ Create</Button>
        </form>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Display Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map(t => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell className="text-muted-foreground">{t.displayName ?? '—'}</TableCell>
              <TableCell>
                {t.isDefault
                  ? <Badge variant="secondary">default</Badge>
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <div className="flex gap-3 text-xs">
                  <Link to={`/admin/teams/${t.id}/members`} className="text-violet-400 hover:text-violet-300">Members</Link>
                  <Link to={`/admin/teams/${t.id}/services`} className="text-violet-400 hover:text-violet-300">Services</Link>
                  <Link to={`/admin/teams/${t.id}/grants`} className="text-violet-400 hover:text-violet-300">Grants</Link>
                  {t.isDeletable && (
                    <button onClick={() => setDeleteTarget(t)} className="text-destructive hover:text-destructive/80">Delete</button>
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
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Delete team "{deleteTarget?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
