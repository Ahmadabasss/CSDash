'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Incident } from '../../types/azure'
import SeverityBadge from '../../components/SeverityBadge'
import RelativeTime from '../../components/RelativeTime'
import { Siren } from 'lucide-react'

const SEV_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Active: 'bg-red-100 text-red-700',
    New: 'bg-amber-100 text-amber-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Resolved: 'bg-emerald-100 text-emerald-700',
    Closed: 'bg-[#edebe9] text-[#605e5c]',
  }
  return (
    <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded ${cls[status] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
      {status}
    </span>
  )
}

function TacticTag({ tactic }: { tactic: string }) {
  return (
    <span className="inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 ring-1 ring-violet-200">
      {tactic}
    </span>
  )
}

export default function IncidentsClient({ items }: { items: Incident[] }) {
  const router = useRouter()
  const [sevFilter, setSevFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const severities = ['all', 'critical', 'high', 'medium', 'low']
  const statuses = ['all', ...Array.from(new Set(items.map((i) => i.status)))]

  const filtered = useMemo(() => {
    let list = items
    if (sevFilter !== 'all') list = list.filter((i) => i.severity.toLowerCase() === sevFilter)
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter)
    if (search) list = list.filter((i) => i.displayName.toLowerCase().includes(search.toLowerCase()))
    return list.sort((a, b) => SEV_ORDER[b.severity.toLowerCase()] - SEV_ORDER[a.severity.toLowerCase()])
  }, [items, sevFilter, statusFilter, search])

  return (
    <div className="bg-white border border-[#edebe9] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[#edebe9] flex-wrap">
        <input
          type="text"
          placeholder="Search incidents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#edebe9] rounded px-3 py-1.5 text-sm text-[#323130] placeholder-[#797775] outline-none focus:border-[#0078d4] w-52"
        />
        <div className="flex gap-1.5 flex-wrap">
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                sevFilter === s ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {s === 'all' ? 'All Severity' : s}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === s ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#797775]">{filtered.length} incidents</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#edebe9] text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Severity</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Title</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Tactics</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Alerts</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Assigned To</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((inc) => (
              <tr key={inc.id} onClick={() => router.push(`/incidents/${inc.id}`)} className="hover:bg-white/2 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <SeverityBadge severity={inc.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'informational'} />
                </td>
                <td className="px-4 py-3 max-w-70">
                  <p className="text-[#323130] text-[12px] font-medium leading-snug">{inc.displayName}</p>
                  <p className="text-[#797775] text-[11px]">#{inc.incidentNumber}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {inc.tactics.slice(0, 2).map((t) => <TacticTag key={t} tactic={t} />)}
                    {inc.tactics.length > 2 && (
                      <span className="text-[10px] text-[#797775]">+{inc.tactics.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px]">{inc.alertsCount}</td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px] truncate max-w-35">
                  {inc.assignedTo ?? <span className="text-[#a19f9d]">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px]">
                  <RelativeTime dateStr={inc.createdDateTime} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#797775]">
            <Siren className="w-8 h-8 mb-2 opacity-40" />
            <p>No incidents match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
