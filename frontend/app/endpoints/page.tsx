import { api } from '../../lib/api'
import EndpointsClient from './EndpointsClient'

export const dynamic = 'force-dynamic'

export default async function EndpointsPage() {
  let summary, data
  try {
    ;[summary, data] = await Promise.all([api.endpointSummary(), api.endpoints({ limit: 200 })])
  } catch {
    return (
      <div className="p-8 text-[#605e5c]">
        Backend offline — start the FastAPI server on port 8000.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#323130]">Endpoints</h1>
        <p className="text-sm text-[#605e5c] mt-0.5">Vigil — device security posture</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={summary.total} />
        <StatCard label="Onboarded" value={summary.onboarded} sub={`${Math.round((summary.onboarded / summary.total) * 100)}%`} color="text-emerald-600" />
        <StatCard label="High / Critical Risk" value={summary.highRisk} color="text-red-600" />
        <StatCard label="Total Vulnerabilities" value={summary.totalVulnerabilities} color="text-amber-600" />
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
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-blue-100 text-blue-700',
  None: 'bg-[#edebe9] text-[#605e5c]',
}

const HEALTH_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-red-100 text-red-700',
  Misconfigured: 'bg-amber-100 text-amber-700',
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-[#edebe9] rounded-lg p-4">
      <p className="text-xs text-[#605e5c] uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-[#323130]'}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-[#797775] mt-0.5">{sub}</p>}
    </div>
  )
}

function DistCard({ title, data, colorMap }: { title: string; data: Record<string, number>; colorMap: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  return (
    <div className="bg-white border border-[#edebe9] rounded-lg p-4">
      <p className="text-xs text-[#605e5c] uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium min-w-[90px] ${colorMap[key] ?? 'bg-[#edebe9] text-[#4b4b4b]'}`}>
              {key}
            </span>
            <div className="flex-1 bg-[#edebe9] rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-[#0078d4]"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[#605e5c] w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
