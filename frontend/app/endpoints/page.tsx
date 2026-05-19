import { api } from '../../lib/api'
import EndpointsClient from './EndpointsClient'

export const dynamic = 'force-dynamic'

export default async function EndpointsPage() {
  let summary, data
  try {
    ;[summary, data] = await Promise.all([api.endpointSummary(), api.endpoints({ limit: 200 })])
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
        <h1 className="text-xl font-semibold text-white">Endpoints</h1>
        <p className="text-sm text-slate-400 mt-0.5">Microsoft Defender for Endpoint — device security posture</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={summary.total} />
        <StatCard label="Onboarded" value={summary.onboarded} sub={`${Math.round((summary.onboarded / summary.total) * 100)}%`} color="text-emerald-400" />
        <StatCard label="High / Critical Risk" value={summary.highRisk} color="text-red-400" />
        <StatCard label="Total Vulnerabilities" value={summary.totalVulnerabilities} color="text-amber-400" />
      </div>

      {/* Distribution row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DistCard title="Risk Score" data={summary.byRisk} colorMap={RISK_COLORS} />
        <DistCard title="Health Status" data={summary.byHealth} colorMap={HEALTH_COLORS} />
        <DistCard title="OS Platform" data={summary.byOs} colorMap={{}} />
      </div>

      <EndpointsClient items={data.items} />
    </div>
  )
}

const RISK_COLORS: Record<string, string> = {
  Critical: 'bg-red-900 text-red-300',
  High: 'bg-red-800/60 text-red-400',
  Medium: 'bg-amber-900/60 text-amber-300',
  Low: 'bg-blue-900/40 text-blue-300',
  None: 'bg-slate-700 text-slate-400',
}

const HEALTH_COLORS: Record<string, string> = {
  Active: 'bg-emerald-900/40 text-emerald-400',
  Inactive: 'bg-red-900/40 text-red-400',
  Misconfigured: 'bg-amber-900/40 text-amber-400',
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-white'}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
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
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium min-w-[90px] ${colorMap[key] ?? 'bg-slate-700 text-slate-300'}`}>
              {key}
            </span>
            <div className="flex-1 bg-slate-700/40 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-[#0078d4]"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
