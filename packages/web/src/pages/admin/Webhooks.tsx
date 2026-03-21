import { useEffect, useState } from 'react'
import { api, WebhookConfig } from '../../lib/api.js'

const ALL_EVENTS = [
  'spec_uploaded',
  'spec_updated',
  'service_deleted',
  'grant_created',
  'grant_revoked',
  'token_created',
  'token_revoked',
  'team_created',
  'user_disabled',
]

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Per-row inline messages: { [id]: { ok: boolean; msg: string } }
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; msg: string }>>({})

  // Create form state
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

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this webhook? This cannot be undone.')) return
    try {
      await api.webhooks.delete(id)
      load()
    } catch (e: unknown) {
      setMsg(id, false, e instanceof Error ? e.message : 'Delete failed')
    }
  }

  function toggleEvent(event: string) {
    setFormEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (formEvents.length === 0) {
      setFormError('Select at least one event.')
      return
    }
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
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 text-base font-medium text-white">New Webhook</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Name</label>
            <input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
              placeholder="e.g. Feishu Alerts"
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">URL</label>
            <input
              type="url"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              required
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Provider</label>
            <select
              value={formProvider}
              onChange={e => setFormProvider(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            >
              <option value="feishu">feishu</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">Events</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-gray-300">{ev}</span>
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
              className="accent-purple-500"
            />
            <label htmlFor="formActive" className="text-sm text-gray-300 cursor-pointer">Active</label>
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={formLoading}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formLoading ? 'Creating...' : 'Create Webhook'}
          </button>
        </form>
      </div>

      {/* List */}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Events</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map(wh => (
                <tr key={wh.id} className="border-b border-gray-800 bg-gray-950 hover:bg-gray-900">
                  <td className="px-4 py-3 font-medium text-white">{wh.name}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-xs truncate" title={wh.url}>
                    {wh.url.length > 48 ? wh.url.slice(0, 48) + '…' : wh.url}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{wh.providerType}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs">
                    <span className="text-xs">{wh.events.join(', ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {wh.teamId ?? <span className="text-gray-600">Global</span>}
                  </td>
                  <td className="px-4 py-3">
                    {wh.isActive ? (
                      <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-400">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleTest(wh.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => handleToggle(wh)}
                          className="text-xs text-yellow-500 hover:text-yellow-400"
                        >
                          {wh.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(wh.id)}
                          className="text-xs text-red-500 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                      {rowMsg[wh.id] && (
                        <span className={`text-xs ${rowMsg[wh.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                          {rowMsg[wh.id].msg}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!webhooks.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-600">
                    No webhooks configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
