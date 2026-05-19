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
    Active: 'bg-red-900/50 text-red-300',
    New: 'bg-amber-900/50 text-amber-300',
    InProgress: 'bg-blue-900/50 text-blue-300',
    Resolved: 'bg-emerald-900/50 text-emerald-400',
    Closed: 'bg-slate-700 text-slate-400',
  }
  return (
    <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded ${cls[status] ?? 'bg-slate-700 text-slate-400'}`}>
      {status}
    </span>
  )
}

function TacticTag({ tactic }: { tactic: string }) {
  return (
    <span className="inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-300 ring-1 ring-violet-800/50">
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
    <div className="bg-[#1e293b] border border-white/6 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/6 flex-wrap">
        <input
          type="text"
          placeholder="Search incidents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#0d1117] border border-white/8 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-[#0078d4] w-52"
        />
        <div className="flex gap-1.5 flex-wrap">
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                sevFilter === s ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
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
                statusFilter === s ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} incidents</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6 text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Severity</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Title</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tactics</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Alerts</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((inc) => (
              <tr key={inc.id} onClick={() => router.push(`/incidents/${inc.id}`)} className="hover:bg-white/2 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <SeverityBadge severity={inc.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'informational'} />
                </td>
                <td className="px-4 py-3 max-w-70">
                  <p className="text-slate-200 text-[12px] font-medium leading-snug">{inc.displayName}</p>
                  <p className="text-slate-500 text-[11px]">#{inc.incidentNumber}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {inc.tactics.slice(0, 2).map((t) => <TacticTag key={t} tactic={t} />)}
                    {inc.tactics.length > 2 && (
                      <span className="text-[10px] text-slate-500">+{inc.tactics.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-[12px]">{inc.alertsCount}</td>
                <td className="px-4 py-3 text-slate-400 text-[12px] truncate max-w-35">
                  {inc.assignedTo ?? <span className="text-slate-600">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-[12px]">
                  <RelativeTime dateStr={inc.createdDateTime} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <Siren className="w-8 h-8 mb-2 opacity-40" />
            <p>No incidents match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
