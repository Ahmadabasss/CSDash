import { Server } from 'lucide-react'
import { api } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function ResourcesPage() {
  const resources = await api.resources()
  const byType: Record<string, number> = {}
  resources.forEach(r => { byType[r.type] = (byType[r.type] ?? 0) + 1 })
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <a href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Dashboard</a>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 text-sm font-medium flex items-center gap-1.5">
          <Server className="h-4 w-4 text-sky-400" /> Resources
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Resources', value: resources.length },
          { label: 'With Issues', value: resources.filter(r => r.issuesCount > 0).length, red: true },
          { label: 'Regions', value: new Set(resources.map(r => r.location)).size },
          { label: 'Resource Groups', value: new Set(resources.map(r => r.resourceGroup)).size },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-slate-800/50 p-4 ring-1 ring-slate-700/60 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.red ? 'text-red-400' : 'text-slate-100'}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Top Resource Types</h2>
          <div className="flex flex-col gap-3">
            {topTypes.map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-mono truncate max-w-[140px]">{type.split('/').pop()}</span>
                  <span className="text-slate-300 tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(count / resources.length) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">All Resources</h2>
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/40">
                  {['Name', 'Type', 'Location', 'Group', 'Score', 'Issues'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {resources.sort((a, b) => b.issuesCount - a.issuesCount).map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200 max-w-[160px] truncate">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-[140px] truncate">{r.type.split('/').pop()}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.location}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[120px]">{r.resourceGroup}</td>
                    <td className="px-4 py-3">
                      <span className={`tabular-nums font-semibold ${r.secureScore >= 70 ? 'text-emerald-400' : r.secureScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {r.secureScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`tabular-nums font-medium ${r.issuesCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {r.issuesCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
