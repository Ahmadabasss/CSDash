import type { Vulnerability } from '@/types/azure'
import SeverityBadge from './SeverityBadge'

function riskScore(v: Vulnerability) {
  return v.cvssV3 * Math.max(v.exposedMachines, 1)
}

interface Props { vulnerabilities: Vulnerability[] }

export default function VulnerabilitiesTable({ vulnerabilities }: Props) {
  const sorted = [...vulnerabilities]
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, 5)

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 bg-slate-800/40">
            {['Severity', 'CVE', 'CVSS', 'Exposed', 'Tags'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {sorted.map(v => (
            <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3"><SeverityBadge severity={v.severity} /></td>
              <td className="px-4 py-3">
                <p className="font-mono text-xs text-sky-400">{v.id}</p>
                <p className="text-slate-300 text-xs mt-0.5 line-clamp-1">{v.name}</p>
              </td>
              <td className="px-4 py-3">
                <span className="tabular-nums font-semibold text-slate-200">{v.cvssV3.toFixed(1)}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`tabular-nums font-medium ${v.exposedMachines > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {v.exposedMachines}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {v.tags.map(tag => (
                    <span
                      key={tag}
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        tag === 'EXPLOIT_AVAILABLE' ? 'bg-red-950 text-red-300' :
                        tag === 'RANSOMWARE_ASSOCIATED' ? 'bg-orange-950 text-orange-300' :
                        tag === 'ACTIVE_THREAT' ? 'bg-red-900 text-red-200' :
                        'bg-slate-800 text-slate-400'
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
  )
}
