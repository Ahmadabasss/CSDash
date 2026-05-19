'use client'

import { useRouter } from 'next/navigation'
import type { AzureResource } from '@/types/azure'

interface Props { resources: AzureResource[] }

export default function ResourcesClient({ resources }: Props) {
  const router = useRouter()
  const sorted = [...resources].sort((a, b) => b.issuesCount - a.issuesCount)

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/6 text-left">
          {['Name', 'Type', 'Location', 'Group', 'Score', 'Issues'].map(h => (
            <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/4">
        {sorted.map(r => (
          <tr
            key={r.id}
            onClick={() => router.push(`/resources/${encodeURIComponent(r.name)}`)}
            className="group hover:bg-white/2 transition-colors cursor-pointer"
          >
            <td className="px-4 py-3 font-medium text-slate-200 max-w-40 truncate group-hover:text-sky-400 transition-colors">{r.name}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-35 truncate">{r.type.split('/').pop()}</td>
            <td className="px-4 py-3 text-slate-400 text-xs">{r.location}</td>
            <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-30">{r.resourceGroup}</td>
            <td className="px-4 py-3">
              <span className={`tabular-nums font-semibold ${r.secureScore >= 70 ? 'text-emerald-400' : r.secureScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {r.secureScore}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className={`tabular-nums font-medium ${r.issuesCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {r.issuesCount}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
