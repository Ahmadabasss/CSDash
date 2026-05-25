'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VirtualMachine } from '../../types/azure'
import RelativeTime from '../../components/RelativeTime'
import { Server, CheckCircle, XCircle } from 'lucide-react'

const PATCH_COLORS: Record<string, string> = {
  CriticalPatches: 'text-red-600',
  SecurityPatches: 'text-amber-600',
  UpToDate: 'text-emerald-600',
  Unknown: 'text-[#797775]',
}

function BoolIcon({ value }: { value: boolean }) {
  return value
    ? <CheckCircle className="w-4 h-4 text-emerald-600" />
    : <XCircle className="w-4 h-4 text-red-600" />
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
    <div className="bg-white border border-[#edebe9] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[#edebe9] flex-wrap">
        <input
          type="text"
          placeholder="Search VMs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#edebe9] rounded px-3 py-1.5 text-sm text-[#323130] placeholder-[#797775] outline-none focus:border-[#0078d4] w-48"
        />
        <div className="flex gap-1.5 flex-wrap">
          {patchStates.map((p) => (
            <button
              key={p}
              onClick={() => setPatchFilter(p)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                patchFilter === p ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
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
                osFilter === o ? 'bg-[#0078d4] text-white' : 'bg-[#edebe9] text-[#605e5c] hover:bg-[#eaecee]'
              }`}
            >
              {o === 'all' ? 'All OS' : o}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#797775]">{filtered.length} VMs</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#edebe9] text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Name</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">OS</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">State</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Patch Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Missing</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">MDE</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Encrypted</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">JIT</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Vulns</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Secure Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map((v) => (
              <tr key={v.id} onClick={() => router.push(`/virtual-machines/${v.name}`)} className="hover:bg-white/2 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-[#797775] shrink-0" />
                    <div>
                      <p className="text-[#323130] font-medium font-mono text-[12px]">{v.name}</p>
                      <p className="text-[#797775] text-[11px]">{v.resourceGroup} · {v.location}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#605e5c] text-[12px]">
                  <p>{v.properties.osType}</p>
                  <p className="text-[#a19f9d] text-[11px] truncate max-w-30">{v.properties.vmSize}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${v.properties.powerState === 'running' ? 'text-emerald-600' : 'text-[#797775]'}`}>
                    {v.properties.powerState}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={PATCH_COLORS[v.securityProfile.patchStatus.state] ?? 'text-[#605e5c]'}>
                    {v.securityProfile.patchStatus.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={v.securityProfile.patchStatus.criticalAndSecurityPatchCount > 0 ? 'text-red-600 font-semibold' : 'text-[#797775]'}>
                    {v.securityProfile.patchStatus.criticalAndSecurityPatchCount}
                  </span>
                </td>
                <td className="px-4 py-3"><BoolIcon value={v.securityProfile.mdeEnrolled} /></td>
                <td className="px-4 py-3"><BoolIcon value={v.securityProfile.diskEncrypted} /></td>
                <td className="px-4 py-3"><BoolIcon value={v.securityProfile.justInTimeAccess} /></td>
                <td className="px-4 py-3 text-[12px]">
                  <span className={v.securityProfile.vulnerabilityCount > 5 ? 'text-amber-600' : 'text-[#605e5c]'}>
                    {v.securityProfile.vulnerabilityCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-[#edebe9] rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${v.securityProfile.secureScore >= 70 ? 'bg-emerald-500' : v.securityProfile.secureScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${v.securityProfile.secureScore}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-[#605e5c]">{v.securityProfile.secureScore}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-[#797775]">
            <Server className="w-8 h-8 mb-2 opacity-40" />
            <p>No VMs match the current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
