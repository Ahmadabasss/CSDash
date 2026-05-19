import { api } from '@/lib/api'
import ResourcesClient from './ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function ResourcesPage() {
  const resources = await api.resources()
  const byType: Record<string, number> = {}
  resources.forEach(r => { byType[r.type] = (byType[r.type] ?? 0) + 1 })
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">All Resources</h1>
        <p className="text-sm text-slate-400 mt-0.5">Azure Resource Graph — subscription resource inventory</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Resources', value: resources.length },
          { label: 'With Issues', value: resources.filter(r => r.issuesCount > 0).length, color: 'text-red-400' },
          { label: 'Regions', value: new Set(resources.map(r => r.location)).size },
          { label: 'Resource Groups', value: new Set(resources.map(r => r.resourceGroup)).size },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-[#1e293b] border border-white/6 p-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.color ?? 'text-slate-100'}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-[#1e293b] border border-white/6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Top Resource Types</h2>
          <div className="flex flex-col gap-3">
            {topTypes.map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-mono truncate max-w-35">{type.split('/').pop()}</span>
                  <span className="text-slate-300 tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-[#0078d4]" style={{ width: `${(count / resources.length) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#1e293b] border border-white/6 p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">All Resources</h2>
          <div className="overflow-x-auto">
            <ResourcesClient resources={resources} />
          </div>
        </div>
      </div>
    </div>
  )
}
