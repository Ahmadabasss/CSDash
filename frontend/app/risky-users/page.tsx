import { api } from '../../lib/api'
import RiskyUsersClient from './RiskyUsersClient'

export const dynamic = 'force-dynamic'

export default async function RiskyUsersPage() {
  let summary, users
  try {
    ;[summary, users] = await Promise.all([api.riskyUserSummary(), api.riskyUsers()])
  } catch {
    return (
      <div className="p-8 text-slate-400">
        Backend offline — start the FastAPI server on port 8000.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Risky Users</h1>
        <p className="text-sm text-slate-400 mt-0.5">Microsoft Entra ID — identity risk detections</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users Monitored" value={summary.total} />
        <StatCard label="At Risk" value={summary.atRisk} color="text-amber-400" />
        <StatCard label="Confirmed Compromised" value={summary.confirmedCompromised} color="text-red-400" />
        <StatCard label="High Risk" value={summary.byLevel['high'] ?? 0} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DistCard title="By Risk Level" data={summary.byLevel} colorMap={LEVEL_COLORS} />
        <DistCard title="By Risk State" data={summary.byState} colorMap={STATE_COLORS} />
      </div>

      <RiskyUsersClient users={users} />
    </div>
  )
}

const LEVEL_COLORS: Record<string, string> = {
  high: 'bg-red-900 text-red-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-blue-900/40 text-blue-300',
  none: 'bg-slate-700 text-slate-400',
}

const STATE_COLORS: Record<string, string> = {
  atRisk: 'bg-red-900/40 text-red-400',
  confirmedCompromised: 'bg-red-900 text-red-200',
  remediated: 'bg-emerald-900/40 text-emerald-400',
  dismissed: 'bg-slate-700 text-slate-400',
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
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium min-w-[120px] capitalize ${colorMap[key] ?? 'bg-slate-700 text-slate-300'}`}>
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
