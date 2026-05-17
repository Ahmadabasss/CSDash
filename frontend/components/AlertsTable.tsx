'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import type { Alert, PaginatedAlerts } from '@/types/azure'
import SeverityBadge from './SeverityBadge'
import StatusBadge from './StatusBadge'
import MitreTag from './MitreTag'
import RelativeTime from './RelativeTime'

type SortField = 'createdDateTime' | 'severity' | 'status' | 'title' | 'category'

interface Props {
  limit?: number
  showPagination?: boolean
  defaultSort?: SortField
}

export default function AlertsTable({ limit = 50, showPagination = true, defaultSort = 'createdDateTime' }: Props) {
  const [data, setData] = useState<PaginatedAlerts | null>(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortField>(defaultSort)
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit, sort, order }
    if (severity) params.severity = severity
    if (status) params.status = status
    const result = await api.alerts(params)
    setData(result)
    setLoading(false)
  }, [page, limit, sort, order, severity, status])

  useEffect(() => { load() }, [load])

  function toggleSort(field: SortField) {
    if (sort === field) setOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSort(field); setOrder('desc') }
    setPage(1)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return order === 'asc'
      ? <ChevronUp className="h-3 w-3 text-sky-400" />
      : <ChevronDown className="h-3 w-3 text-sky-400" />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['', 'high', 'medium', 'low'] as const).map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setSeverity(s); setPage(1) }}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              severity === s ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s || 'All severities'}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {(['', 'new', 'inProgress', 'resolved'] as const).map(s => (
            <button
              key={s || 'all'}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                status === s ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s || 'All statuses'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/40">
              {([
                ['severity', 'Severity'],
                ['title', 'Title'],
                ['category', 'Category'],
                ['status', 'Status'],
                ['createdDateTime', 'Created'],
              ] as [SortField, string][]).map(([field, label]) => (
                <th
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200 select-none"
                >
                  <span className="flex items-center gap-1">{label}<SortIcon field={field} /></span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">MITRE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-slate-800" /></td>
                    ))}
                  </tr>
                ))
              : data?.items.map((alert: Alert) => (
                  <tr
                    key={alert.id}
                    className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3"><SeverityBadge severity={alert.severity} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      <Link href={`/alerts/${encodeURIComponent(alert.id)}`} className="text-slate-200 hover:text-sky-400 line-clamp-1 transition-colors">
                        {alert.title}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alert.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{alert.category}</td>
                    <td className="px-4 py-3"><StatusBadge status={alert.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><RelativeTime dateStr={alert.createdDateTime} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {alert.mitreTechniques.slice(0, 2).map(t => <MitreTag key={t} technique={t} />)}
                        {alert.mitreTechniques.length > 2 && (
                          <span className="text-xs text-slate-500">+{alert.mitreTechniques.length - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{data.total.toLocaleString()} alerts</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1.5 hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3">Page {page} of {data.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="rounded p-1.5 hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
