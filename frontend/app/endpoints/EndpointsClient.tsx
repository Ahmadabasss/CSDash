'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Endpoint } from '../../types/azure'
import RelativeTime from '../../components/RelativeTime'
import { Monitor } from 'lucide-react'

const RISK_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1, None: 0 }

function RiskBadge({ score }: { score: string }) {
  const cls: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700 ring-1 ring-red-700',
    High: 'bg-orange-100 text-orange-700 ring-1 ring-red-200',
    Medium: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    Low: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    None: 'bg-[#edebe9] text-[#605e5c]',
  }
  return (
    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded ${cls[score] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
      {score}
    </span>
  )
}

export default function EndpointsClient({ items }: { items: Endpoint[] }) {
  const router = useRouter()
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [healthFilter, setHealthFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const risks = ['all', ...Array.from(new Set(items.map((d) => d.riskScore))).sort((a, b) => RISK_ORDER[b] - RISK_ORDER[a])]
  const healths = ['all', ...Array.from(new Set(items.map((d) => d.healthStatus)))]

  const filtered = useMemo(() => {
    let list = items
    if (riskFilter !== 'all') list = list.filter((d) => d.riskScore === riskFilter)
    if (healthFilter !== 'all') list = list.filter((d) => d.healthStatus === healthFilter)
    if (search) list = list.filter((d) => d.computerDnsName.toLowerCase().includes(search.toLowerCase()))
    return list.sort((a, b) => RISK_ORDER[b.riskScore] - RISK_ORDER[a.riskScore])
  }, [items, riskFilter, healthFilter, search])

  return (
    <div className="bg-white border border-[#edebe9] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[#edebe9] flex-wrap">
        <input
          type="text"
          placeholder="Search devices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#edebe9] rounded px-3 py-1.5 text-sm text-[#323130] placeholder-[#797775] outline-none focus:border-[#0078d4] w-52"
        />
        <div className="flex gap-1.5 flex-wrap">
          {risks.map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                riskFilter === r ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {r === 'all' ? 'All Risk' : r}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {healths.map((h) => (
            <button
              key={h}
              onClick={() => setHealthFilter(h)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                healthFilter === h ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {h === 'all' ? 'All Health' : h}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#797775]">{filtered.length} devices</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#edebe9] text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Risk</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Device</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">OS</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Health</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Exposure</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Vulns</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Missing Patches</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">AV</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((d) => (
              <tr key={d.id} onClick={() => router.push(`/endpoints/${d.id}`)} className="hover:bg-white/2 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <RiskBadge score={d.riskScore} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-[#797775] shrink-0" />
                    <div>
                      <p className="text-[#323130] font-medium font-mono text-[12px]">{d.computerDnsName}</p>
                      <p className="text-[#797775] text-[11px]">{d.rbacGroupName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px]">
                  <p>{d.osPlatform}</p>
                  <p className="text-[#a19f9d] text-[11px]">{d.osVersion}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${d.healthStatus === 'Active' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {d.healthStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px]">{d.exposureLevel}</td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={d.vulnerabilitiesCount > 10 ? 'text-red-600 font-semibold' : 'text-[#605e5c]'}>
                    {d.vulnerabilitiesCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={d.missingCriticalPatches > 0 ? 'text-amber-600 font-semibold' : 'text-[#797775]'}>
                    {d.missingCriticalPatches}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={`${d.antivirusStatus === 'Updated' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {d.antivirusStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px]">
                  <RelativeTime dateStr={d.lastSeen} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#797775]">
            <Monitor className="w-8 h-8 mb-2 opacity-40" />
            <p>No devices match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
