'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ComplianceStandard } from '@/types/azure'

const COLORS = { passed: '#10b981', failed: '#ef4444', skipped: '#64748b' }

interface Props { standards: ComplianceStandard[] }

export default function ComplianceDonut({ standards }: Props) {
  const [selected, setSelected] = useState(0)
  const std = standards[selected]
  if (!std) return null

  const { passedControls, failedControls, skippedControls } = std.properties
  const data = [
    { name: 'Passed',  value: passedControls,  color: COLORS.passed  },
    { name: 'Failed',  value: failedControls,  color: COLORS.failed  },
    { name: 'Skipped', value: skippedControls, color: COLORS.skipped },
  ].filter(d => d.value > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {standards.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSelected(i)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              i === selected
                ? 'bg-[#0078d4] text-white'
                : 'bg-[#f3f2f1] text-[#605e5c] hover:text-[#323130]'
            }`}
          >
            {s.name.replace('Azure-', '').replace(/-\d.*/, '')}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-36 w-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #edebe9', borderRadius: 6, fontSize: 12 }}
                itemStyle={{ color: '#f1f5f9' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {data.map(d => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[#4b4b4b]">{d.name}</span>
              <span className="ml-auto tabular-nums font-medium text-[#323130]">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
