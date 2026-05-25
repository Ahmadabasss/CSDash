'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SignIn } from '../../types/azure'
import RelativeTime from '../../components/RelativeTime'
import { LogIn } from 'lucide-react'

function RiskBadge({ level }: { level: string }) {
  const cls: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
    none: 'bg-[#edebe9] text-[#797775]',
    hidden: 'bg-[#edebe9] text-[#797775]',
  }
  return (
    <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded capitalize ${cls[level] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
      {level}
    </span>
  )
}

export default function SignInsClient({ signins }: { signins: SignIn[] }) {
  const router = useRouter()
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const risks = ['all', 'high', 'medium', 'low', 'none']
  const statuses = ['all', 'success', 'failure']

  const filtered = useMemo(() => {
    let list = signins
    if (riskFilter !== 'all') list = list.filter((s) => s.riskLevelAggregated.toLowerCase() === riskFilter)
    if (statusFilter === 'success') list = list.filter((s) => s.status.errorCode === 0)
    if (statusFilter === 'failure') list = list.filter((s) => s.status.errorCode !== 0)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) => s.userDisplayName.toLowerCase().includes(q) || s.ipAddress.includes(q) || s.appDisplayName.toLowerCase().includes(q)
      )
    }
    return list
  }, [signins, riskFilter, statusFilter, search])

  return (
    <div className="bg-white border border-[#edebe9] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[#edebe9] flex-wrap">
        <input
          type="text"
          placeholder="Search user, IP, app..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#edebe9] rounded px-3 py-1.5 text-sm text-[#323130] placeholder-[#797775] outline-none focus:border-[#0078d4] w-52"
        />
        <div className="flex gap-1.5 flex-wrap">
          {risks.map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                riskFilter === r ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {r === 'all' ? 'All Risk' : r}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#797775]">{filtered.length} sign-ins</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#edebe9] text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Risk</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">User</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">App</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">IP Address</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Location</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Client</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((s) => {
              const success = s.status.errorCode === 0
              return (
                <tr key={s.id} onClick={() => router.push(`/signins/${encodeURIComponent(s.id)}`)} className="group hover:bg-white/2 transition-colors cursor-pointer">
                  <td className="px-4 py-3"><RiskBadge level={s.riskLevelAggregated} /></td>
                  <td className="px-4 py-3">
                    <p className="text-[#323130] text-[12px] font-medium">{s.userDisplayName}</p>
                    <p className="text-[#797775] text-[11px] font-mono">{s.userPrincipalName}</p>
                  </td>
                  <td className="px-4 py-3 text-[#605e5c] text-[12px] max-w-35 truncate">{s.appDisplayName}</td>
                  <td className="px-4 py-3 text-[#605e5c] text-[12px] font-mono">{s.ipAddress}</td>
                  <td className="px-4 py-3 text-[#605e5c] text-[12px]">
                    {s.location.city ? `${s.location.city}, ` : ''}{s.location.countryOrRegion}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {success ? 'Success' : 'Failed'}
                    </span>
                    {!success && s.status.failureReason && (
                      <p className="text-[10px] text-[#a19f9d] mt-0.5 max-w-35 truncate">{s.status.failureReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#797775] text-[11px] max-w-30 truncate">{s.clientAppUsed}</td>
                  <td className="px-4 py-3 text-[#605e5c] text-[12px]">
                    <RelativeTime dateStr={s.createdDateTime} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#797775]">
            <LogIn className="w-8 h-8 mb-2 opacity-40" />
            <p>No sign-ins match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
