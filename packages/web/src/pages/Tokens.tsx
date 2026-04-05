import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Token = { id: string; name: string; scope: string; prefix: string; lastUsedAt: string | null; createdAt: string }

export default function Tokens() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'read' | 'write'>('read')
  const [newToken, setNewToken] = useState('')
  const [newTokenScope, setNewTokenScope] = useState('')
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
      setNewTokenScope(t.scope)
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
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Token name (e.g. Cursor)"
          className="flex-1"
        />
        <Select value={scope} onValueChange={v => setScope(v as 'read' | 'write')}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="read">read</SelectItem>
            <SelectItem value="write">write</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit">Create</Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {newToken && (
        <Alert className="border-amber-700 bg-amber-950/50">
          <AlertDescription className="space-y-3">
            <p className="font-medium text-amber-400">Token created — copy it now, it won't be shown again</p>
            <code className="block break-all rounded bg-background p-2 text-xs text-green-400">{newToken}</code>
            {newTokenScope === 'read' && (
              <>
                <p className="text-xs text-muted-foreground">Claude Desktop / Cursor config:</p>
                <pre className="overflow-x-auto rounded bg-background p-2 text-xs text-foreground">{mcpConfig}</pre>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map(t => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{t.scope}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs font-mono">{t.prefix}…</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'never'}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => revoke(t.id)}
                  className="text-destructive hover:text-destructive">
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!tokens.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">No tokens yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
