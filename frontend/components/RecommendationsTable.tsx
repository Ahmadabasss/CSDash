'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { exportCsv } from '@/lib/exportCsv'
import type { CategoryCount, PaginatedRecommendations, Recommendation } from '@/types/azure'
import SeverityBadge from './SeverityBadge'
import StatusBadge from './StatusBadge'

interface Props { limit?: number; showPagination?: boolean }

export default function RecommendationsTable({ limit = 50, showPagination = true }: Props) {
  const router = useRouter()
  const [data, setData] = useState<PaginatedRecommendations | null>(null)
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [page, setPage] = useState(1)
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.recommendationCategories().then(setCategories).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit, sort: 'severity', order: 'desc' }
    if (severity) params.severity = severity
    if (category) params.category = category
    if (status) params.status = status
    const result = await api.recommendations(params)
    setData(result)
    setLoading(false)
  }, [page, limit, severity, category, status])

  useEffect(() => { load() }, [load])

  async function handleExport() {
    const all = await api.recommendations({ page: 1, limit: 500, sort: 'severity', order: 'desc', ...(severity && { severity }), ...(category && { category }), ...(status && { status }) })
    exportCsv('recommendations.csv', all.items.map(r => ({
      name: r.name,
      displayName: r.properties.displayName,
      severity: r.properties.metadata.severity,
      status: r.properties.status.code,
      category: r.properties.metadata.categories.join('; '),
      implementationEffort: r.properties.metadata.implementationEffort,
      resourceName: r.properties.resourceDetails.ResourceName,
      resourceType: r.properties.resourceDetails.ResourceType,
    })))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['', 'high', 'medium', 'low'] as const).map(s => (
          <button key={s || 'all'} onClick={() => { setSeverity(s); setPage(1) }}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${severity === s ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            {s || 'All severities'}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {(['', 'Unhealthy', 'Healthy'] as const).map(s => (
            <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1) }}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${status === s ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              {s || 'All statuses'}
            </button>
          ))}
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Export to CSV">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => { setCategory(''); setPage(1) }}
            className={`rounded-full px-3 py-0.5 text-xs transition-colors ${category === '' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            All
          </button>
          {categories.slice(0, 6).map(c => (
            <button key={c.category} onClick={() => { setCategory(c.category); setPage(1) }}
              className={`rounded-full px-3 py-0.5 text-xs transition-colors ${category === c.category ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              {c.category} <span className="opacity-60">({c.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/40">
              {['Severity', 'Recommendation', 'Resource', 'Category', 'Effort', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
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
              : data?.items.map((rec: Recommendation) => (
                  <tr
                    key={rec.id}
                    onClick={() => router.push(`/recommendations/${rec.name}`)}
                    className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3"><SeverityBadge severity={rec.properties.metadata.severity} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-200 group-hover:text-sky-400 line-clamp-2 transition-colors">
                        {rec.properties.displayName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs max-w-[160px] truncate">
                      {rec.properties.resourceDetails.ResourceName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                        {rec.properties.metadata.categories[0] ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{rec.properties.metadata.implementationEffort}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.properties.status.code} /></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {showPagination && data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{data.total.toLocaleString()} recommendations</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded p-1.5 hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3">Page {page} of {data.pages}</span>
            <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
              className="rounded p-1.5 hover:bg-slate-800 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
