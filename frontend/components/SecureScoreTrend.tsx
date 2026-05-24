'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ScoreHistory } from '@/types/azure'

interface Props { history: ScoreHistory[] }

export default function SecureScoreTrend({ history }: Props) {
  const data = history.slice(-12).map(h => ({
    date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: Math.round(h.percentage * 100),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#ffffff', border: '1px solid #edebe9', borderRadius: 6 }}
          labelStyle={{ color: '#94a3b8', fontSize: 12 }}
          itemStyle={{ color: '#38bdf8' }}
          formatter={(v) => [`${v}%`, 'Score']}
        />
        <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.4} />
        <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#38bdf8"
          strokeWidth={2}
          dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
