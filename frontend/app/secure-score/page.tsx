import Link from 'next/link'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../../lib/api'
import SecureScoreGauge from '../../components/SecureScoreGauge'
import SecureScoreTrend from '../../components/SecureScoreTrend'

export const dynamic = 'force-dynamic'

export default async function SecureScorePage() {
  const data = await api.secureScore()
  const score = data.value[0]
  const pct = Math.round(score.properties.score.percentage * 100)
  const history = data.history
  const previousPct = history.length >= 2
    ? Math.round(history[history.length - 2].percentage * 100)
    : undefined
  const delta = previousPct != null ? pct - previousPct : null
  const controls = (data as { controlScores?: { controlName: string; current: number; max: number; weight: number }[] }).controlScores ?? []

  const maxPct = Math.round((score.properties.score.current / score.properties.score.max) * 100)

  return (
    <div className="px-6 py-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Secure Score</h1>
        <p className="text-sm text-slate-400 mt-0.5">Microsoft Defender for Cloud — overall security posture</p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gauge */}
        <div className="bg-[#1e293b] border border-white/6 rounded-lg p-6 flex flex-col items-center">
          <SecureScoreGauge value={pct} previousValue={previousPct} />
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Current Score</p>
            <p className="text-sm text-slate-300 mt-1">
              {score.properties.score.current.toFixed(1)} / {score.properties.score.max} points
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <StatCard
            label="Current Score"
            value={`${pct}%`}
            color={pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'}
          />
          <StatCard
            label="Week-over-Week"
            value={delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : '—'}
            color={delta == null ? 'text-slate-400' : delta >= 0 ? 'text-emerald-400' : 'text-red-400'}
            icon={delta != null ? (delta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />) : undefined}
          />
          <StatCard label="Max Achievable" value={`${maxPct}%`} />
          <StatCard
            label="Points Earned"
            value={`${score.properties.score.current.toFixed(1)} / ${score.properties.score.max}`}
          />
          <div className="col-span-2 bg-[#1e293b] border border-white/6 rounded-lg p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Score Tier</p>
            <div className="flex gap-3 text-xs">
              {[
                { label: '< 40%', desc: 'Poor', color: 'bg-red-500' },
                { label: '40–70%', desc: 'Moderate', color: 'bg-amber-500' },
                { label: '> 70%', desc: 'Good', color: 'bg-emerald-500' },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${t.color}`} />
                  <span className="text-slate-400">{t.label}</span>
                  <span className={`font-medium ${pct >= 70 && t.desc === 'Good' ? 'text-emerald-400' : pct >= 40 && t.desc === 'Moderate' ? 'text-amber-400' : pct < 40 && t.desc === 'Poor' ? 'text-red-400' : 'text-slate-600'}`}>
                    {t.desc}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow ring-2 ring-[#0a0f1e]"
                style={{ left: `calc(${Math.min(pct, 99)}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>0</span><span>40</span><span>70</span><span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* 12-week trend */}
      <div className="bg-[#1e293b] border border-white/6 rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">12-Week Trend</h2>
        <SecureScoreTrend history={history} />
        <div className="flex gap-4 mt-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-emerald-500/50" /> 70% good threshold</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-amber-500/50" /> 40% moderate threshold</span>
        </div>
      </div>

      {/* Control scores */}
      {controls.length > 0 && (
        <div className="bg-[#1e293b] border border-white/6 rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Score by Control</h2>
          <div className="space-y-3">
            {controls
              .sort((a, b) => (b.current / b.max) - (a.current / a.max))
              .map(c => {
                const controlPct = Math.round((c.current / c.max) * 100)
                const barColor = controlPct >= 70 ? 'bg-emerald-500' : controlPct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={c.controlName}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{c.controlName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 tabular-nums">{c.current} / {c.max} pts</span>
                        <span className={`font-semibold tabular-nums w-10 text-right ${controlPct >= 70 ? 'text-emerald-400' : controlPct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {controlPct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700/60">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${controlPct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="bg-[#0078d4]/10 border border-[#0078d4]/30 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Improve your score</p>
          <p className="text-xs text-slate-400 mt-0.5">Review open recommendations to earn more points</p>
        </div>
        <Link
          href="/recommendations"
          className="flex items-center gap-1.5 text-sm text-[#60a5fa] hover:text-white transition-colors font-medium"
        >
          View Recommendations <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-[#1e293b] border border-white/6 rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 flex items-center gap-2 ${color ?? 'text-white'}`}>
        {icon}{value}
      </p>
    </div>
  )
}
