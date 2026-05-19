'use client'

import type { MitreSummaryRow } from '@/types/azure'

const TACTIC_MAP: Record<string, string> = {
  T1078: 'Initial Access',
  'T1078.001': 'Initial Access',
  'T1078.004': 'Initial Access',
  T1190: 'Initial Access',
  T1566: 'Initial Access',
  'T1566.001': 'Initial Access',
  T1059: 'Execution',
  'T1059.001': 'Execution',
  'T1059.003': 'Execution',
  T1610: 'Execution',
  T1055: 'Privilege Escalation',
  T1098: 'Persistence',
  T1036: 'Defense Evasion',
  T1027: 'Defense Evasion',
  T1003: 'Credential Access',
  T1110: 'Credential Access',
  T1083: 'Discovery',
  T1057: 'Discovery',
  T1082: 'Discovery',
  T1021: 'Lateral Movement',
  T1071: 'Command & Control',
  T1041: 'Exfiltration',
  T1567: 'Exfiltration',
  T1486: 'Impact',
  T1489: 'Impact',
}

const TACTIC_ORDER = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Command & Control',
  'Exfiltration',
  'Impact',
]

const SEV_COLOR = (severities: Record<string, number>, count: number) => {
  if (count === 0) return 'bg-slate-800/40 text-slate-700'
  const dominant = Object.entries(severities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'medium'
  if (dominant === 'critical' || dominant === 'high') return 'bg-red-900/70 text-red-200'
  if (dominant === 'medium') return 'bg-amber-900/60 text-amber-200'
  return 'bg-blue-900/50 text-blue-200'
}

const HEAT_INTENSITY = (count: number, max: number) => {
  if (count === 0) return 0
  return Math.ceil((count / max) * 4)
}

const INTENSITY_BG: Record<number, string> = {
  0: 'bg-slate-800/30',
  1: 'bg-red-950/60',
  2: 'bg-red-900/60',
  3: 'bg-red-800/70',
  4: 'bg-red-700/80',
}

interface Props { rows: MitreSummaryRow[] }

export default function MitreHeatmap({ rows }: Props) {
  if (!rows.length) return null

  const max = Math.max(...rows.map(r => r.count))

  // Group by tactic
  const byTactic: Record<string, MitreSummaryRow[]> = {}
  for (const row of rows) {
    const tactic = TACTIC_MAP[row.technique] ?? 'Other'
    if (!byTactic[tactic]) byTactic[tactic] = []
    byTactic[tactic].push(row)
  }

  const tactics = TACTIC_ORDER.filter(t => byTactic[t])

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span>Alert frequency:</span>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${INTENSITY_BG[i]}`} />
            <span>{i === 1 ? 'Low' : i === 2 ? 'Med' : i === 3 ? 'High' : 'Critical'}</span>
          </div>
        ))}
      </div>

      {/* Grid: one row per tactic */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px] space-y-1">
          {tactics.map(tactic => {
            const tacticRows = byTactic[tactic].sort((a, b) => b.count - a.count)
            return (
              <div key={tactic} className="flex items-start gap-2">
                <div className="w-32 shrink-0 text-[11px] text-slate-500 pt-1.5 text-right pr-2 truncate">
                  {tactic}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tacticRows.map(row => {
                    const intensity = HEAT_INTENSITY(row.count, max)
                    return (
                      <div
                        key={row.technique}
                        title={`${row.technique} — ${row.count} alerts`}
                        className={`flex flex-col items-center justify-center w-16 h-10 rounded text-[10px] font-mono font-semibold cursor-default transition-opacity hover:opacity-80 ${INTENSITY_BG[intensity]}`}
                      >
                        <span className="text-slate-300">{row.technique}</span>
                        <span className="text-slate-500 text-[9px]">{row.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top techniques bar chart */}
      <div className="mt-4 pt-4 border-t border-white/6">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Top Techniques by Alert Volume</p>
        <div className="space-y-2">
          {rows.slice().sort((a, b) => b.count - a.count).slice(0, 8).map(row => {
            const pct = Math.round((row.count / max) * 100)
            const color = SEV_COLOR(row.severities, row.count)
            return (
              <div key={row.technique} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[11px] font-mono text-slate-400">{row.technique}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-700/40">
                  <div className={`h-full rounded-full ${color.split(' ')[0]}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-[11px] text-slate-400 tabular-nums">{row.count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
