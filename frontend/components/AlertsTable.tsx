'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { exportCsv } from '@/lib/exportCsv'
import type { Alert, PaginatedAlerts } from '@/types/azure'
import SeverityBadge from './SeverityBadge'
import StatusBadge from './StatusBadge'
import MitreTag from './MitreTag'
import RelativeTime from './RelativeTime'
import AgeBadge from './AgeBadge'

type SortField = 'createdDateTime' | 'severity' | 'status' | 'title' | 'category'

interface Props {
  limit?: number
  showPagination?: boolean
  defaultSort?: SortField
}

export default function AlertsTable({ limit = 50, showPagination = true, defaultSort = 'createdDateTime' }: Props) {
  const router = useRouter()
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

  async function handleExport() {
    const all = await api.alerts({ page: 1, limit: 500, sort, order, ...(severity && { severity }), ...(status && { status }) })
    exportCsv('alerts.csv', all.items.map(a => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      status: a.status,
      category: a.category,
      serviceSource: a.serviceSource,
      mitreTechniques: a.mitreTechniques.join('; '),
      createdDateTime: a.createdDateTime,
    })))
  }

  function toggleSort(field: SortField) {
    if (sort === field) setOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSort(field); setOrder('desc') }
    setPage(1)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return order === 'asc'
      ? <ChevronUp className="h-3 w-3 text-[#0078d4]" />
      : <ChevronDown className="h-3 w-3 text-[#0078d4]" />
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
              severity === s ? 'bg-[#0078d4] text-white' : 'bg-[#f3f2f1] text-[#605e5c] hover:text-[#323130]'
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
                status === s ? 'bg-[#0078d4] text-white' : 'bg-[#f3f2f1] text-[#605e5c] hover:text-[#323130]'
              }`}
            >
              {s || 'All statuses'}
            </button>
          ))}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium bg-[#f3f2f1] text-[#605e5c] hover:text-[#323130] transition-colors"
            title="Export to CSV"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl ring-1 ring-[#edebe9]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#edebe9] bg-white">
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
                  className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#605e5c] hover:text-[#323130] select-none"
                >
                  <span className="flex items-center gap-1">{label}<SortIcon field={field} /></span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Age</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#605e5c]">MITRE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-[#f3f2f1]" /></td>
                    ))}
                  </tr>
                ))
              : data?.items.map((alert: Alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => router.push(`/alerts/${encodeURIComponent(alert.id)}`)}
                    className="group hover:bg-white transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3"><SeverityBadge severity={alert.severity} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-[#323130] group-hover:text-[#0078d4] line-clamp-1 transition-colors">{alert.title}</p>
                      <p className="text-xs text-[#797775] mt-0.5 line-clamp-1">{alert.description}</p>
                    </td>
                    <td className="px-4 py-3 text-[#605e5c]">{alert.category}</td>
                    <td className="px-4 py-3"><StatusBadge status={alert.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><RelativeTime dateStr={alert.createdDateTime} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><AgeBadge createdAt={alert.createdDateTime} severity={alert.severity} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {alert.mitreTechniques.slice(0, 2).map(t => <MitreTag key={t} technique={t} />)}
                        {alert.mitreTechniques.length > 2 && (
                          <span className="text-xs text-[#797775]">+{alert.mitreTechniques.length - 2}</span>
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
        <div className="flex items-center justify-between text-sm text-[#605e5c]">
          <span>{data.total.toLocaleString()} alerts</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1.5 hover:bg-[#f3f2f1] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3">Page {page} of {data.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="rounded p-1.5 hover:bg-[#f3f2f1] disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
