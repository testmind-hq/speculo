import { useEffect, useState } from 'react'
import { api, type User } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const ROLES = ['super_admin', 'team_owner', 'team_member', 'guest'] as const

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const data = await api.admin.users.list()
      setUsers(data.users)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function updateRole(id: string, role: string) {
    try {
      await api.admin.users.update(id, { role })
      setUsers(us => us.map(u => u.id === id ? { ...u, role } : u))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await api.admin.users.update(id, { isActive: !current })
      setUsers(us => us.map(u => u.id === id ? { ...u, isActive: !current } : u))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.admin.users.delete(deleteTarget.id)
      setUsers(us => us.filter(u => u.id !== deleteTarget.id))
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
      <h1 className="text-2xl font-semibold">Users</h1>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Teams</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={v => updateRole(u.id, v)}>
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {u.teams.length > 0
                  ? u.teams.map(t => (
                    <Badge key={t.id} variant="secondary" className="mr-1 text-xs">{t.name}</Badge>
                  ))
                  : <span className="text-muted-foreground">—</span>
                }
              </TableCell>
              <TableCell>
                {u.isActive
                  ? <Badge variant="secondary" className="text-green-400 border-green-800">Active</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-3 text-xs">
                  <button
                    onClick={() => toggleActive(u.id, u.isActive)}
                    className="text-amber-500 hover:text-amber-400"
                  >
                    {u.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(u)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    Delete
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Delete user "{deleteTarget?.email}"? This cannot be undone.
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
