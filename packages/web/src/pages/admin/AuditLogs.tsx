import { useEffect, useState } from 'react'
import { api, AuditLog } from '../../lib/api.js'

const ACTION_TYPES = [
  'login',
  'spec_uploaded',
  'spec_updated',
  'service_deleted',
  'grant_created',
  'grant_revoked',
  'token_created',
  'token_revoked',
  'user_created',
  'user_disabled',
  'team_created',
]

const PAGE_SIZE = 50

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filter state
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Applied filters (only updated on Apply click)
  const [appliedAction, setAppliedAction] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  function fetchLogs(currentPage: number, action: string, from: string, to: string) {
    setLoading(true)
    setError('')
    api.audit.list({
      page: currentPage,
      pageSize: PAGE_SIZE,
      ...(action ? { action } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    })
      .then(d => {
        setLogs(d.logs)
        setTotal(d.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load audit logs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLogs(page, appliedAction, appliedFrom, appliedTo)
  }, [page, appliedAction, appliedFrom, appliedTo])

  function handleApply() {
    setPage(1)
    setAppliedAction(actionFilter)
    setAppliedFrom(fromDate)
    setAppliedTo(toDate)
  }

  function handlePrev() {
    if (page > 1) setPage(p => p - 1)
  }

  function handleNext() {
    if (page * PAGE_SIZE < total) setPage(p => p + 1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function formatMeta(meta: string | null): string {
    if (!meta) return '—'
    try {
      const parsed = JSON.parse(meta)
      const str = JSON.stringify(parsed)
      return str.length > 80 ? str.slice(0, 77) + '…' : str
    } catch {
      return meta.length > 80 ? meta.slice(0, 77) + '…' : meta
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Action</label>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
          >
            <option value="">All</option>
            {ACTION_TYPES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">To</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
          />
        </div>

        <button
          onClick={handleApply}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
        >
          Apply
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 bg-gray-950 hover:bg-gray-900">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {log.userEmail ?? <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {log.targetName ?? <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-xs truncate">
                      {formatMeta(log.meta)}
                    </td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600">
                      No audit log entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>
              {total === 0
                ? 'No results'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={page <= 1}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-2 py-1.5">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={handleNext}
                disabled={page * PAGE_SIZE >= total}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
