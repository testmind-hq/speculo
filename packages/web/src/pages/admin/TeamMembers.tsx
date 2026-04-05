import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-muted-foreground hover:text-foreground text-sm">← Teams</Link>
        <h1 className="text-2xl font-semibold">Team Members</h1>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <form onSubmit={addMember} className="flex gap-2 items-center">
        <Input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="w-72"
        />
        <Select value={selectedRole} onValueChange={v => setSelectedRole(v as 'owner' | 'member')}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={adding || !userId.trim()}>+ Add</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
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
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(m.joinedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(m)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">Remove</Button>
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">No members yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!removeTarget} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove "{removeTarget?.email}" from this team?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
