import { Bug } from 'lucide-react'
import { api } from '@/lib/api'
import VulnerabilitiesTable from '@/components/VulnerabilitiesTable'
import SeverityBadge from '@/components/SeverityBadge'

export const dynamic = 'force-dynamic'

export default async function VulnerabilitiesPage() {
  const vulns = await api.vulnerabilities()
  const exploitable = vulns.filter(v => v.publicExploit && v.exposedMachines > 0)

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <a href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Dashboard</a>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 text-sm font-medium flex items-center gap-1.5">
          <Bug className="h-4 w-4 text-orange-400" /> Vulnerabilities
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4">
        {[
          { label: 'Total CVEs', value: vulns.length },
          { label: 'Exploitable', value: exploitable.length, red: true },
          { label: 'With Exploit Kit', value: vulns.filter(v => v.exploitInKit).length, red: true },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-slate-800/50 p-4 ring-1 ring-slate-700/60 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.red ? 'text-red-400' : 'text-slate-100'}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60">
        <h1 className="mb-6 text-lg font-semibold text-slate-100">All CVEs — ranked by risk score</h1>
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-800/40">
                {['Severity', 'CVE', 'Name', 'CVSS', 'Exposed', 'Published', 'Tags'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {vulns.sort((a, b) => b.cvssV3 * Math.max(b.exposedMachines, 1) - a.cvssV3 * Math.max(a.exposedMachines, 1)).map(v => (
                <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3"><SeverityBadge severity={v.severity} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-sky-400">{v.id}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-xs line-clamp-1">{v.name}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-200">{v.cvssV3.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <span className={`tabular-nums font-medium ${v.exposedMachines > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {v.exposedMachines}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(v.publishedOn).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {v.tags.map(tag => (
                        <span key={tag} className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          tag === 'EXPLOIT_AVAILABLE' ? 'bg-red-950 text-red-300' :
                          tag === 'RANSOMWARE_ASSOCIATED' ? 'bg-orange-950 text-orange-300' :
                          tag === 'ACTIVE_THREAT' ? 'bg-red-900 text-red-200' :
                          'bg-slate-800 text-slate-400'
                        }`}>{tag.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
