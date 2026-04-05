import { useEffect, useState } from 'react'
import { api, WebhookConfig } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const ALL_EVENTS = [
  'spec_uploaded', 'spec_updated', 'service_deleted',
  'grant_created', 'grant_revoked', 'token_created', 'token_revoked',
  'team_created', 'user_disabled',
]

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [deleteTarget, setDeleteTarget] = useState<WebhookConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formEvents, setFormEvents] = useState<string[]>([])
  const [formProvider, setFormProvider] = useState('feishu')
  const [formActive, setFormActive] = useState(true)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  function load() {
    setLoading(true)
    setError('')
    api.webhooks
      .list()
      .then(d => setWebhooks(d.webhooks))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load webhooks'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function setMsg(id: string, ok: boolean, msg: string) {
    setRowMsg(prev => ({ ...prev, [id]: { ok, msg } }))
    setTimeout(() => setRowMsg(prev => { const n = { ...prev }; delete n[id]; return n }), 4000)
  }

  async function handleTest(id: string) {
    try {
      await api.webhooks.test(id)
      setMsg(id, true, 'Test delivery sent')
    } catch (e: unknown) {
      setMsg(id, false, e instanceof Error ? e.message : 'Test failed')
    }
  }

  async function handleToggle(wh: WebhookConfig) {
    try {
      await api.webhooks.update(wh.id, { isActive: !wh.isActive })
      load()
    } catch (e: unknown) {
      setMsg(wh.id, false, e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.webhooks.delete(deleteTarget.id)
      load()
    } catch (e: unknown) {
      setMsg(deleteTarget.id, false, e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  function toggleEvent(event: string) {
    setFormEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (formEvents.length === 0) { setFormError('Select at least one event.'); return }
    setFormError('')
    setFormLoading(true)
    try {
      await api.webhooks.create({
        name: formName,
        url: formUrl,
        events: formEvents,
        providerType: formProvider,
        isActive: formActive,
      })
      setFormName('')
      setFormUrl('')
      setFormEvents([])
      setFormProvider('feishu')
      setFormActive(true)
      load()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Webhooks</h1>

      {/* Create form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-medium">New Webhook</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} required placeholder="e.g. Feishu Alerts" />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input type="url" value={formUrl} onChange={e => setFormUrl(e.target.value)} required placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={formProvider} onValueChange={setFormProvider}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feishu">feishu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="accent-violet-500"
                  />
                  <span className="text-xs text-muted-foreground">{ev}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="formActive"
              checked={formActive}
              onChange={e => setFormActive(e.target.checked)}
              className="accent-violet-500"
            />
            <Label htmlFor="formActive" className="cursor-pointer">Active</Label>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button type="submit" disabled={formLoading}>
            {formLoading ? 'Creating...' : 'Create Webhook'}
          </Button>
        </form>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map(wh => (
              <TableRow key={wh.id}>
                <TableCell className="font-medium">{wh.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs" title={wh.url}>
                  {wh.url.length > 48 ? wh.url.slice(0, 48) + '…' : wh.url}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{wh.providerType}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                  {wh.events.join(', ')}
                </TableCell>
                <TableCell>
                  {wh.isActive
                    ? <Badge variant="secondary" className="text-green-400 border-green-800">Active</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Button variant="ghost" size="sm" onClick={() => handleTest(wh.id)} className="h-auto p-0 text-xs text-blue-400 hover:text-blue-300 hover:bg-transparent">Test</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(wh)} className="h-auto p-0 text-xs text-amber-500 hover:text-amber-400 hover:bg-transparent">
                        {wh.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(wh)} className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 hover:bg-transparent">Delete</Button>
                    </div>
                    {rowMsg[wh.id] && (
                      <span className={`text-xs ${rowMsg[wh.id].ok ? 'text-green-400' : 'text-destructive'}`}>
                        {rowMsg[wh.id].msg}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!webhooks.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No webhooks configured yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Delete webhook "{deleteTarget?.name}"? This cannot be undone.
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
