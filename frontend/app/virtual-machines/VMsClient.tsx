'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VirtualMachine } from '../../types/azure'
import RelativeTime from '../../components/RelativeTime'
import { Server, CheckCircle, XCircle } from 'lucide-react'

const PATCH_COLORS: Record<string, string> = {
  CriticalPatches: 'text-red-400',
  SecurityPatches: 'text-amber-400',
  UpToDate: 'text-emerald-400',
  Unknown: 'text-slate-500',
}

function BoolIcon({ value }: { value: boolean }) {
  return value
    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
    : <XCircle className="w-4 h-4 text-red-400" />
}

export default function VMsClient({ items }: { items: VirtualMachine[] }) {
  const router = useRouter()
  const [patchFilter, setPatchFilter] = useState<string>('all')
  const [osFilter, setOsFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const patchStates = ['all', ...Array.from(new Set(items.map((v) => v.securityProfile.patchStatus.state)))]
  const osTypes = ['all', ...Array.from(new Set(items.map((v) => v.properties.osType)))]

  const filtered = useMemo(() => {
    let list = items
    if (patchFilter !== 'all') list = list.filter((v) => v.securityProfile.patchStatus.state === patchFilter)
    if (osFilter !== 'all') list = list.filter((v) => v.properties.osType === osFilter)
    if (search) list = list.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
    return list.sort((a, b) => a.securityProfile.secureScore - b.securityProfile.secureScore)
  }, [items, patchFilter, osFilter, search])

  return (
    <div className="bg-[#1e293b] border border-white/6 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/6 flex-wrap">
        <input
          type="text"
          placeholder="Search VMs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#0d1117] border border-white/8 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-[#0078d4] w-48"
        />
        <div className="flex gap-1.5 flex-wrap">
          {patchStates.map((p) => (
            <button
              key={p}
              onClick={() => setPatchFilter(p)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                patchFilter === p ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {p === 'all' ? 'All Patches' : p}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {osTypes.map((o) => (
            <button
              key={o}
              onClick={() => setOsFilter(o)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                osFilter === o ? 'bg-[#0078d4] text-white' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {o === 'all' ? 'All OS' : o}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} VMs</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6 text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">OS</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">State</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Patch Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Missing</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">MDE</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Encrypted</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">JIT</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vulns</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Secure Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((v) => (
              <tr key={v.id} onClick={() => router.push(`/virtual-machines/${v.name}`)} className="hover:bg-white/2 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-slate-200 font-medium font-mono text-[12px]">{v.name}</p>
                      <p className="text-slate-500 text-[11px]">{v.resourceGroup} · {v.location}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-[12px]">
                  <p>{v.properties.osType}</p>
                  <p className="text-slate-600 text-[11px] truncate max-w-30">{v.properties.vmSize}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${v.properties.powerState === 'running' ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {v.properties.powerState}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={PATCH_COLORS[v.securityProfile.patchStatus.state] ?? 'text-slate-400'}>
                    {v.securityProfile.patchStatus.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={v.securityProfile.patchStatus.criticalAndSecurityPatchCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
                    {v.securityProfile.patchStatus.criticalAndSecurityPatchCount}
                  </span>
                </td>
                <td className="px-4 py-3"><BoolIcon value={v.securityProfile.mdeEnrolled} /></td>
                <td className="px-4 py-3"><BoolIcon value={v.securityProfile.diskEncrypted} /></td>
                <td className="px-4 py-3"><BoolIcon value={v.securityProfile.justInTimeAccess} /></td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={v.securityProfile.vulnerabilityCount > 5 ? 'text-amber-400' : 'text-slate-400'}>
                    {v.securityProfile.vulnerabilityCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-slate-700/40 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${v.securityProfile.secureScore >= 70 ? 'bg-emerald-500' : v.securityProfile.secureScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${v.securityProfile.secureScore}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-slate-400">{v.securityProfile.secureScore}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <Server className="w-8 h-8 mb-2 opacity-40" />
            <p>No VMs match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
