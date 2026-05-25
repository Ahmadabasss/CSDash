'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

function color(pct: number) {
  if (pct >= 70) return '#10b981' // emerald
  if (pct >= 40) return '#f59e0b' // amber
  return '#ef4444'                // red
}

interface Props {
  value: number
  previousValue?: number
}

export default function SecureScoreGauge({ value, previousValue }: Props) {
  const pct = Math.round(value)
  const fill = color(pct)
  const delta = previousValue != null ? value - previousValue : null

  const data = [{ value: pct, fill }]

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={14}
          >
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f3f2f1' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
          <span className="text-5xl font-bold tabular-nums" style={{ color: fill }}>
            {pct}
          </span>
          <span className="text-sm text-[#605e5c] -mt-1">/ 100</span>
        </div>
      </div>
      {delta != null && (
        <p className="mt-1 text-sm" style={{ color: delta >= 0 ? '#10b981' : '#ef4444' }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% from last week
        </p>
      )}
    </div>
  )
}
