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
        <h1 className="text-xl font-semibold text-[#323130]">All Resources</h1>
        <p className="text-sm text-[#605e5c] mt-0.5">Azure Resource Graph — subscription resource inventory</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Resources', value: resources.length },
          { label: 'With Issues', value: resources.filter(r => r.issuesCount > 0).length, color: 'text-red-600' },
          { label: 'Regions', value: new Set(resources.map(r => r.location)).size },
          { label: 'Resource Groups', value: new Set(resources.map(r => r.resourceGroup)).size },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white border border-[#edebe9] p-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.color ?? 'text-[#323130]'}`}>{s.value}</p>
            <p className="text-xs text-[#797775] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-white border border-[#edebe9] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#797775]">Top Resource Types</h2>
          <div className="flex flex-col gap-3">
            {topTypes.map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#605e5c] font-mono truncate max-w-35">{type.split('/').pop()}</span>
                  <span className="text-[#4b4b4b] tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#edebe9]">
                  <div className="h-full rounded-full bg-[#0078d4]" style={{ width: `${(count / resources.length) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-[#edebe9] p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#797775]">All Resources</h2>
          <div className="overflow-x-auto">
            <ResourcesClient resources={resources} />
          </div>
        </div>
      </div>
    </div>
  )
}
