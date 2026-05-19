import { api } from '../../lib/api'
import SignInsPanel from '../../components/SignInsPanel'

export const dynamic = 'force-dynamic'

export default async function SignInsPage() {
  let riskSummary, signins
  try {
    ;[riskSummary, signins] = await Promise.all([api.riskSummary(), api.signins()])
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
        <h1 className="text-xl font-semibold text-white">Sign-ins</h1>
        <p className="text-sm text-slate-400 mt-0.5">Microsoft Entra ID — authentication log and risk analysis</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Sign-ins" value={riskSummary.total} />
        <StatCard label="Risky Sign-ins" value={riskSummary.risky} color="text-amber-400" />
        <StatCard label="Failed Sign-ins" value={riskSummary.failed} color="text-red-400" />
        <StatCard label="Success Rate" value={`${Math.round(((riskSummary.total - riskSummary.failed) / riskSummary.total) * 100)}%`} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DistCard title="Risk by Level" data={riskSummary.riskByLevel} colorMap={RISK_COLORS} />
        <TopList title="Top Risky IPs" items={riskSummary.topRiskyIps.map((x) => ({ label: x.ip, count: x.count }))} mono />
        <TopList title="Top Countries" items={riskSummary.topCountries.map((x) => ({ label: x.country, count: x.count }))} />
      </div>

      <SignInsPanel signins={signins} riskSummary={riskSummary} />
    </div>
  )
}

const RISK_COLORS: Record<string, string> = {
  high: 'bg-red-900 text-red-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-blue-900/40 text-blue-300',
  none: 'bg-slate-700 text-slate-400',
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
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
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium min-w-[80px] capitalize ${colorMap[key] ?? 'bg-slate-700 text-slate-300'}`}>
              {key}
            </span>
            <div className="flex-1 bg-slate-700/40 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[#0078d4]" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopList({ title, items, mono }: { title: string; items: { label: string; count: number }[]; mono?: boolean }) {
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className={`text-[12px] text-slate-300 ${mono ? 'font-mono' : ''}`}>{item.label}</span>
            <span className="text-xs text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
