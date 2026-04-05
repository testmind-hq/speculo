import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, type User } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    try {
      const data = await api.admin.users.list()
      setUsers(data.users)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { api.me().then(me => setCurrentUserId(me.id)).catch(() => {}) }, [])

  async function updateRole(id: string, role: string) {
    try {
      await api.admin.users.update(id, { role })
      setUsers(us => us.map(u => u.id === id ? { ...u, role } : u))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await api.admin.users.update(id, { isActive: !current })
      setUsers(us => us.map(u => u.id === id ? { ...u, isActive: !current } : u))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await api.register(newEmail.trim(), newPassword)
      setNewEmail('')
      setNewPassword('')
      setShowCreate(false)
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
      await api.admin.users.delete(deleteTarget.id)
      setUsers(us => us.filter(u => u.id !== deleteTarget.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('admin.users.title')}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>{t('admin.users.createButton')}</Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin.users.emailHead')}</TableHead>
            <TableHead>{t('admin.users.roleHead')}</TableHead>
            <TableHead>{t('admin.users.teamsHead')}</TableHead>
            <TableHead>{t('admin.users.statusHead')}</TableHead>
            <TableHead>{t('admin.users.actionsHead')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={v => updateRole(u.id, v)}>
                  <SelectTrigger className="h-7 w-[130px] text-xs" disabled={u.id === currentUserId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {u.teams.length > 0
                  ? u.teams.map(tm => (
                    <Badge key={tm.id} variant="secondary" className="mr-1 text-xs">{tm.name} ({tm.role})</Badge>
                  ))
                  : <span className="text-muted-foreground">—</span>
                }
              </TableCell>
              <TableCell>
                {u.isActive
                  ? <Badge variant="secondary" className="text-green-400 border-green-800">{t('admin.users.active')}</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">{t('admin.users.inactive')}</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-3 text-xs">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(u.id, u.isActive)} className="h-auto p-0 text-xs text-amber-500 hover:text-amber-400 hover:bg-transparent">
                    {u.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">
                    {t('admin.users.deleteButton')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); setNewEmail(''); setNewPassword('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('admin.users.createEmailLabel')}</Label>
              <Input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('admin.users.createPasswordLabel')}</Label>
              <Input type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>{t('admin.users.cancel')}</Button>
              <Button type="submit" disabled={creating}>{creating ? t('admin.users.creating') : t('admin.users.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.deleteConfirm', { email: deleteTarget?.email ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('admin.users.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? t('admin.users.deleting') : t('admin.users.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
