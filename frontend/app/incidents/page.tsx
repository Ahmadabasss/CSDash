import { api } from '../../lib/api'
import IncidentsClient from './IncidentsClient'

export const dynamic = 'force-dynamic'

export default async function IncidentsPage() {
  let data
  try {
    data = await api.incidents({ limit: 200 })
  } catch {
    return (
      <div className="p-8 text-slate-400">
        Backend offline — start the FastAPI server on port 8000.
      </div>
    )
  }

  // Compute summary from data
  const items = data.items
  const byStatus: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  const tactics = new Set<string>()
  for (const inc of items) {
    byStatus[inc.status] = (byStatus[inc.status] ?? 0) + 1
    bySeverity[inc.severity] = (bySeverity[inc.severity] ?? 0) + 1
    inc.tactics.forEach((t) => tactics.add(t))
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Incidents</h1>
        <p className="text-sm text-slate-400 mt-0.5">Microsoft Sentinel — security incident management</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={data.total} />
        <StatCard label="Active" value={(byStatus['Active'] ?? 0) + (byStatus['New'] ?? 0)} color="text-red-400" />
        <StatCard label="In Progress" value={byStatus['InProgress'] ?? 0} color="text-amber-400" />
        <StatCard label="Resolved" value={byStatus['Resolved'] ?? 0} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DistCard title="By Severity" data={bySeverity} colorMap={SEV_COLORS} />
        <DistCard title="By Status" data={byStatus} colorMap={STATUS_COLORS} />
      </div>

      <IncidentsClient items={items} />
    </div>
  )
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-900 text-red-300',
  high: 'bg-red-800/60 text-red-400',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-blue-900/40 text-blue-300',
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-red-900/40 text-red-400',
  New: 'bg-amber-900/40 text-amber-400',
  InProgress: 'bg-blue-900/40 text-blue-400',
  Resolved: 'bg-emerald-900/40 text-emerald-400',
  Closed: 'bg-slate-700 text-slate-400',
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function DistCard({ title, data, colorMap }: { title: string; data: Record<string, number>; colorMap: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium min-w-[100px] ${colorMap[key] ?? 'bg-slate-700 text-slate-300'}`}>
              {key}
            </span>
            <div className="flex-1 bg-slate-700/40 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[#0078d4]" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
