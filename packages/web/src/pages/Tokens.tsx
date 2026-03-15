import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

type Token = { id: string; name: string; scope: string; prefix: string; lastUsedAt: string | null; createdAt: string }

export default function Tokens() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'read' | 'write'>('read')
  const [newToken, setNewToken] = useState('')
  const [error, setError] = useState('')

  function load() {
    api.tokens.list().then(d => setTokens(d.tokens)).catch(e => setError(e.message))
  }

  useEffect(load, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    try {
      const t = await api.tokens.create(name, scope)
      setNewToken(t.token)
      setName('')
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function revoke(id: string) {
    await api.tokens.delete(id)
    load()
  }

  const mcpConfig = newToken ? JSON.stringify({
    mcpServers: {
      speculo: {
        url: `${window.location.origin}/mcp`,
        headers: { Authorization: `Bearer ${newToken}` }
      }
    }
  }, null, 2) : ''

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">MCP Tokens</h1>

      <form onSubmit={create} className="flex gap-3">
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Token name (e.g. Cursor)"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
        <select value={scope} onChange={e => setScope(e.target.value as 'read' | 'write')}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none">
          <option value="read">read</option>
          <option value="write">write</option>
        </select>
        <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">
          Create
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {newToken && (
        <div className="rounded-xl border border-yellow-800 bg-yellow-950 p-4">
          <p className="mb-2 text-sm font-medium text-yellow-400">Token created — copy it now, it won't be shown again</p>
          <code className="block break-all rounded bg-gray-900 p-2 text-xs text-green-400">{newToken}</code>
          {scope === 'read' && (
            <>
              <p className="mt-3 mb-1 text-xs text-gray-500">Claude Desktop / Cursor config:</p>
              <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-300">{mcpConfig}</pre>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {tokens.map(t => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <div>
              <span className="text-sm font-medium text-white">{t.name}</span>
              <span className="ml-2 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{t.scope}</span>
              <p className="text-xs text-gray-600 mt-0.5">{t.prefix}… · last used: {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'never'}</p>
            </div>
            <button onClick={() => revoke(t.id)} className="text-xs text-red-500 hover:text-red-400">Revoke</button>
          </div>
        ))}
        {!tokens.length && <p className="text-sm text-gray-600">No tokens yet.</p>}
      </div>
    </div>
  )
}
