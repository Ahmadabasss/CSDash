'use client'

import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import type { Vulnerability } from '@/types/azure'
import SeverityBadge from './SeverityBadge'
import { exportCsv } from '@/lib/exportCsv'

function riskScore(v: Vulnerability) {
  return v.cvssV3 * Math.max(v.exposedMachines, 1)
}

interface Props { vulnerabilities: Vulnerability[] }

export default function VulnerabilitiesTable({ vulnerabilities }: Props) {
  const router = useRouter()
  const sorted = [...vulnerabilities]
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, 5)

  function handleExport() {
    exportCsv('vulnerabilities.csv', sorted.map(v => ({
      id: v.id,
      name: v.name,
      severity: v.severity,
      cvssV3: v.cvssV3,
      exposedMachines: v.exposedMachines,
      publicExploit: v.publicExploit,
      tags: v.tags.join('; '),
      publishedOn: v.publishedOn,
    })))
  }

  return (
    <div className="flex flex-col gap-2">
    <div className="flex justify-end">
      <button onClick={handleExport} className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium bg-[#f3f2f1] text-[#605e5c] hover:text-[#323130] transition-colors" title="Export to CSV">
        <Download className="h-3.5 w-3.5" /> Export
      </button>
    </div>
    <div className="overflow-x-auto rounded-xl ring-1 ring-[#edebe9]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#edebe9] bg-white">
            {['Severity', 'CVE', 'CVSS', 'Exposed', 'Tags'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#605e5c]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {sorted.map(v => (
            <tr
              key={v.id}
              onClick={() => router.push(`/vulnerabilities/${encodeURIComponent(v.id)}`)}
              className="group hover:bg-white transition-colors cursor-pointer"
            >
              <td className="px-4 py-3"><SeverityBadge severity={v.severity} /></td>
              <td className="px-4 py-3">
                <p className="font-mono text-xs text-[#0078d4] group-hover:text-sky-300 transition-colors">{v.id}</p>
                <p className="text-[#4b4b4b] text-xs mt-0.5 line-clamp-1">{v.name}</p>
              </td>
              <td className="px-4 py-3">
                <span className="tabular-nums font-semibold text-[#323130]">{v.cvssV3.toFixed(1)}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`tabular-nums font-medium ${v.exposedMachines > 0 ? 'text-red-600' : 'text-[#797775]'}`}>
                  {v.exposedMachines}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {v.tags.map(tag => (
                    <span
                      key={tag}
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        tag === 'EXPLOIT_AVAILABLE' ? 'bg-red-100 text-red-700' :
                        tag === 'RANSOMWARE_ASSOCIATED' ? 'bg-orange-100 text-orange-700' :
                        tag === 'ACTIVE_THREAT' ? 'bg-red-100 text-red-700' :
                        'bg-[#f3f2f1] text-[#605e5c]'
                      }`}
                    >
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}
