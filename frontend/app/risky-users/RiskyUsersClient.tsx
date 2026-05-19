'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RiskyUser } from '../../types/azure'
import RelativeTime from '../../components/RelativeTime'
import { UserX } from 'lucide-react'

const LEVEL_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }

function RiskLevelBadge({ level }: { level: string }) {
  const cls: Record<string, string> = {
    high: 'bg-red-900/60 text-red-300 ring-1 ring-red-800',
    medium: 'bg-amber-900/50 text-amber-300 ring-1 ring-amber-800',
    low: 'bg-blue-900/40 text-blue-300 ring-1 ring-blue-800',
    none: 'bg-slate-700 text-slate-400',
  }
  return (
    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${cls[level] ?? 'bg-slate-700 text-slate-400'}`}>
      {level}
    </span>
  )
}

function RiskStateBadge({ state }: { state: string }) {
  const cls: Record<string, string> = {
    atRisk: 'bg-red-900/40 text-red-400',
    confirmedCompromised: 'bg-red-900 text-red-200 font-semibold',
    remediated: 'bg-emerald-900/40 text-emerald-400',
    dismissed: 'bg-slate-700 text-slate-500',
  }
  return (
    <span className={`inline-flex text-[11px] px-2 py-0.5 rounded ${cls[state] ?? 'bg-slate-700 text-slate-400'}`}>
      {state}
    </span>
  )
}

export default function RiskyUsersClient({ users }: { users: RiskyUser[] }) {
  const router = useRouter()
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const levels = ['all', 'high', 'medium', 'low', 'none']
  const states = ['all', ...Array.from(new Set(users.map((u) => u.riskState)))]

  const filtered = useMemo(() => {
    let list = users
    if (levelFilter !== 'all') list = list.filter((u) => u.riskLevel === levelFilter)
    if (stateFilter !== 'all') list = list.filter((u) => u.riskState === stateFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((u) => u.userDisplayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q))
    }
    return list.sort((a, b) => LEVEL_ORDER[b.riskLevel] - LEVEL_ORDER[a.riskLevel])
  }, [users, levelFilter, stateFilter, search])

  return (
    <div className="bg-[#1e293b] border border-white/6 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/6 flex-wrap">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#0d1117] border border-white/8 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-[#0078d4] w-52"
        />
        <div className="flex gap-1.5 flex-wrap">
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                levelFilter === l ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {l === 'all' ? 'All Levels' : l}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {states.map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                stateFilter === s ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s === 'all' ? 'All States' : s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} users</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6 text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Level</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">User</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Department</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk State</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Detail</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sign-ins</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risky Sign-ins</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((u) => (
              <tr key={u.id} onClick={() => router.push(`/risky-users/${u.id}`)} className="hover:bg-white/2 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <RiskLevelBadge level={u.riskLevel} />
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-200 text-[12px] font-medium">{u.userDisplayName}</p>
                  <p className="text-slate-500 text-[11px] font-mono">{u.userPrincipalName}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 text-[12px]">
                  <p>{u.department}</p>
                  <p className="text-slate-600 text-[11px]">{u.jobTitle}</p>
                </td>
                <td className="px-4 py-3"><RiskStateBadge state={u.riskState} /></td>
                <td className="px-4 py-3 text-slate-400 text-[12px] max-w-45 truncate">{u.riskDetail}</td>
                <td className="px-4 py-3 text-slate-400 text-[12px]">{u.signInCount}</td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={u.riskySignInCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
                    {u.riskySignInCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-[12px]">
                  <RelativeTime dateStr={u.riskLastUpdatedDateTime} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <UserX className="w-8 h-8 mb-2 opacity-40" />
            <p>No risky users match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
