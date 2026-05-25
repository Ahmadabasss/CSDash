'use client'

import { useRouter } from 'next/navigation'
import type { Vulnerability } from '@/types/azure'
import SeverityBadge from '@/components/SeverityBadge'

interface Props { vulns: Vulnerability[] }

export default function VulnerabilitiesClient({ vulns }: Props) {
  const router = useRouter()
  const sorted = [...vulns].sort((a, b) => b.cvssV3 * Math.max(b.exposedMachines, 1) - a.cvssV3 * Math.max(a.exposedMachines, 1))

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#edebe9] text-left">
          {['Severity', 'CVE', 'Name', 'CVSS', 'Exposed Machines', 'Published', 'Tags'].map(h => (
            <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/4">
        {sorted.map(v => (
          <tr
            key={v.id}
            onClick={() => router.push(`/vulnerabilities/${encodeURIComponent(v.id)}`)}
            className="group hover:bg-white/2 transition-colors cursor-pointer"
          >
            <td className="px-4 py-3"><SeverityBadge severity={v.severity} /></td>
            <td className="px-4 py-3 font-mono text-xs text-[#60a5fa] group-hover:text-sky-300 transition-colors">{v.id}</td>
            <td className="px-4 py-3 text-[#4b4b4b] max-w-xs truncate">{v.name}</td>
            <td className="px-4 py-3 font-semibold tabular-nums text-[#323130]">{v.cvssV3.toFixed(1)}</td>
            <td className="px-4 py-3">
              <span className={`tabular-nums font-medium ${v.exposedMachines > 0 ? 'text-red-600' : 'text-[#797775]'}`}>
                {v.exposedMachines}
              </span>
            </td>
            <td className="px-4 py-3 text-[#605e5c] text-xs whitespace-nowrap">
              {new Date(v.publishedOn).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1">
                {v.tags.map(tag => (
                  <span key={tag} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    tag === 'EXPLOIT_AVAILABLE' ? 'bg-red-100 text-red-700' :
                    tag === 'RANSOMWARE_ASSOCIATED' ? 'bg-orange-100 text-orange-700' :
                    tag === 'ACTIVE_THREAT' ? 'bg-red-100 text-red-700' :
                    'bg-[#f3f2f1] text-[#605e5c]'
                  }`}>{tag.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
