import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Service } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export default function TeamServices() {
  const { id } = useParams<{ id: string }>()
  const [teamServices, setTeamServices] = useState<Pick<Service, 'id' | 'name' | 'displayName'>[]>([])
  const [allServices, setAllServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Pick<Service, 'id' | 'name' | 'displayName'> | null>(null)
  const [removing, setRemoving] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    api.me().then(me => setIsSuperAdmin(me.role === 'super_admin')).catch(() => {})
  }, [])

  async function load() {
    if (!id) return
    try {
      const [tsRes, allRes] = await Promise.all([
        api.admin.services.list(id),
        api.catalog(),
      ])
      setTeamServices(tsRes.services)
      setAllServices(allRes.services)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function assignService(serviceId: string) {
    if (!id) return
    try {
      await api.admin.services.assign(serviceId, id)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await api.admin.services.assign(removeTarget.id, null)
      setTeamServices(s => s.filter(x => x.id !== removeTarget.id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }

  const teamServiceIds = new Set(teamServices.map(s => s.id))
  const unassigned = allServices.filter(s => !teamServiceIds.has(s.id))

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/teams" className="text-muted-foreground hover:text-foreground text-sm">← Teams</Link>
        <h1 className="text-2xl font-semibold">Team Services</h1>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {isSuperAdmin && unassigned.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Assign a service to this team:</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(s => (
              <Button key={s.id} variant="outline" size="sm" onClick={() => assignService(s.id)}>
                + {s.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            {isSuperAdmin && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamServices.map(s => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.displayName ?? s.name}</TableCell>
              {isSuperAdmin && (
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(s)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">Remove</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {teamServices.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">No services in this team.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!removeTarget} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Service</DialogTitle>
            <DialogDescription>
              Remove "{removeTarget?.displayName ?? removeTarget?.name}" from this team?
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
