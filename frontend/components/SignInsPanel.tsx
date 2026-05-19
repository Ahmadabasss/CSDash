'use client'

import { useState, useMemo } from 'react'
import { LogIn, MapPin, X } from 'lucide-react'
import type { SignIn, RiskSummary } from '@/types/azure'
import SignInGeoMap from './SignInGeoMap'
import RelativeTime from './RelativeTime'

function RiskBadge({ level }: { level: string }) {
  const cls: Record<string, string> = {
    high:   'bg-red-900/60 text-red-300',
    medium: 'bg-amber-900/50 text-amber-300',
    low:    'bg-blue-900/40 text-blue-300',
    none:   'bg-slate-700 text-slate-500',
    hidden: 'bg-slate-700 text-slate-500',
  }
  return (
    <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded capitalize ${cls[level] ?? 'bg-slate-700 text-slate-400'}`}>
      {level}
    </span>
  )
}

interface Props {
  signins: SignIn[]
  riskSummary: RiskSummary
}

export default function SignInsPanel({ signins, riskSummary }: Props) {
  const [selected, setSelected] = useState<SignIn | null>(null)
  const [riskFilter, setRiskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = signins
    if (riskFilter !== 'all') list = list.filter(s => s.riskLevelAggregated.toLowerCase() === riskFilter)
    if (statusFilter === 'success') list = list.filter(s => s.status.errorCode === 0)
    if (statusFilter === 'failure') list = list.filter(s => s.status.errorCode !== 0)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.userDisplayName.toLowerCase().includes(q) ||
        s.ipAddress.includes(q) ||
        s.appDisplayName.toLowerCase().includes(q)
      )
    }
    return list
  }, [signins, riskFilter, statusFilter, search])

  const highlightedCountry = selected?.location.countryOrRegion ?? undefined

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      {/* Table — left, wider */}
      <div className="lg:col-span-3 bg-[#1e293b] border border-white/6 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-3 p-4 border-b border-white/6 flex-wrap">
          <input
            type="text"
            placeholder="Search user, IP, app..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#0d1117] border border-white/8 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-[#0078d4] w-48"
          />
          <div className="flex gap-1 flex-wrap">
            {['all', 'high', 'medium', 'low', 'none'].map(r => (
              <button key={r} onClick={() => setRiskFilter(r)}
                className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${riskFilter === r ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'}`}>
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['all', 'success', 'failure'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${statusFilter === s ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'}`}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-500">{filtered.length} sign-ins</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 text-left">
                {['Risk', 'User', 'IP', 'Location', 'Status', 'Time'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.map(s => {
                const isSelected = selected?.id === s.id
                const success = s.status.errorCode === 0
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(isSelected ? null : s)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-violet-900/20 ring-1 ring-inset ring-violet-700/40' : 'hover:bg-white/2'}`}
                  >
                    <td className="px-4 py-3"><RiskBadge level={s.riskLevelAggregated} /></td>
                    <td className="px-4 py-3">
                      <p className="text-slate-200 text-[12px] font-medium">{s.userDisplayName}</p>
                      <p className="text-slate-500 text-[11px] font-mono truncate max-w-36">{s.userPrincipalName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[12px] font-mono">{s.ipAddress}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-[12px] ${isSelected ? 'text-violet-300 font-medium' : 'text-slate-400'}`}>
                        {isSelected && <MapPin className="w-3 h-3" />}
                        {s.location.city ? `${s.location.city}, ` : ''}{s.location.countryOrRegion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${success ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                        {success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[12px]">
                      <RelativeTime dateStr={s.createdDateTime} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-12 text-slate-500">
              <LogIn className="w-8 h-8 mb-2 opacity-40" />
              <p>No sign-ins match the current filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Map — right, sticky */}
      <div className="lg:col-span-2 bg-[#1e293b] border border-white/6 rounded-xl p-4 lg:sticky lg:top-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sign-in Geography</h3>
          {selected && (
            <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <SignInGeoMap riskSummary={riskSummary} highlighted={highlightedCountry} />

        {/* Selected sign-in detail card */}
        {selected && (
          <div className="mt-4 rounded-lg bg-violet-950/40 p-3 ring-1 ring-violet-700/40 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{selected.userDisplayName}</p>
                <p className="text-[11px] text-slate-500 font-mono">{selected.userPrincipalName}</p>
              </div>
              <RiskBadge level={selected.riskLevelAggregated} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <Row label="IP" value={selected.ipAddress} mono />
              <Row label="App" value={selected.appDisplayName} />
              <Row label="Country" value={selected.location.countryOrRegion} />
              <Row label="City" value={selected.location.city || '—'} />
              <Row label="Status" value={selected.status.errorCode === 0 ? 'Success' : 'Failed'} />
              <Row label="Client" value={selected.clientAppUsed} />
            </div>
            {selected.status.failureReason && (
              <p className="text-[11px] text-red-400 border-t border-white/6 pt-2">{selected.status.failureReason}</p>
            )}
          </div>
        )}

        {!selected && (
          <p className="mt-3 text-center text-xs text-slate-600">Click a sign-in row to highlight on map</p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className={`text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
