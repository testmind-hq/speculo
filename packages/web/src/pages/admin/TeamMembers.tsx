import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, type TeamMember } from '@/lib/api'
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

export default function TeamMembers() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member'>('member')
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState(false)

  async function load() {
    if (!id) return
    try {
      const mRes = await api.admin.members.list(id)
      setMembers(mRes.members)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !userId.trim()) return
    setAdding(true)
    try {
      await api.admin.members.add(id, userId.trim(), selectedRole)
      setUserId('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  async function updateRole(memberId: string, role: 'owner' | 'member') {
    if (!id) return
    try {
      await api.admin.members.updateRole(id, memberId, role)
      setMembers(ms => ms.map(m => m.userId === memberId ? { ...m, role } : m))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirmRemove() {
    if (!id || !removeTarget) return
    setRemoving(true)
    try {
      await api.admin.members.remove(id, removeTarget.userId)
      setMembers(ms => ms.filter(m => m.userId !== removeTarget.userId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-muted-foreground hover:text-foreground text-sm">{t('admin.teamMembers.backToTeams')}</Link>
        <h1 className="text-2xl font-semibold">{t('admin.teamMembers.title')}</h1>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <form onSubmit={addMember} className="flex gap-2 items-center">
        <Input
          type="text"
          placeholder={t('admin.teamMembers.userIdPlaceholder')}
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="w-72"
        />
        <Select value={selectedRole} onValueChange={v => setSelectedRole(v as 'owner' | 'member')}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{t('admin.teamMembers.roleMember')}</SelectItem>
            <SelectItem value="owner">{t('admin.teamMembers.roleOwner')}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={adding || !userId.trim()}>
          {adding ? t('admin.teamMembers.adding') : t('admin.teamMembers.addButton')}
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin.teamMembers.emailHead')}</TableHead>
            <TableHead>{t('admin.teamMembers.roleHead')}</TableHead>
            <TableHead>{t('admin.teamMembers.joinedHead')}</TableHead>
            <TableHead>{t('admin.teamMembers.actionsHead')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map(m => (
            <TableRow key={m.id}>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Select value={m.role} onValueChange={v => updateRole(m.userId, v as 'owner' | 'member')}>
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">{t('admin.teamMembers.roleOwner')}</SelectItem>
                    <SelectItem value="member">{t('admin.teamMembers.roleMember')}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(m.joinedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(m)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">{t('admin.teamMembers.removeButton')}</Button>
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">{t('admin.teamMembers.noMembers')}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!removeTarget} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.teamMembers.removeTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.teamMembers.removeConfirm', { email: removeTarget?.email ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>{t('admin.teamMembers.cancel')}</Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? t('admin.teamMembers.removing') : t('admin.teamMembers.remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
