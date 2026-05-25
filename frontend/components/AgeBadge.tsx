'use client'

import { useEffect, useState } from 'react'

function ageHours(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3_600_000
}

function tier(hours: number, severity: string): { label: string; cls: string } {
  const isHigh = severity === 'high' || severity === 'critical'
  if (isHigh && hours > 24) return { label: `${Math.floor(hours)}h`, cls: 'bg-red-600/20 text-red-600 ring-red-600/40' }
  if (isHigh && hours > 4)  return { label: `${Math.floor(hours)}h`, cls: 'bg-amber-600/20 text-amber-600 ring-amber-600/40' }
  if (!isHigh && hours > 72) return { label: `${Math.floor(hours / 24)}d`, cls: 'bg-amber-600/20 text-amber-600 ring-amber-600/40' }
  return { label: hours < 1 ? '<1h' : `${Math.floor(hours)}h`, cls: 'bg-[#edebe9] text-[#605e5c] ring-[#edebe9]' }
}

interface Props {
  createdAt: string
  severity: string
}

export default function AgeBadge({ createdAt, severity }: Props) {
  const [hours, setHours] = useState(() => ageHours(createdAt))

  useEffect(() => {
    const id = setInterval(() => setHours(ageHours(createdAt)), 60_000)
    return () => clearInterval(id)
  }, [createdAt])

  const { label, cls } = tier(hours, severity)
  return (
    <span
      title={`Open for ~${Math.floor(hours)}h`}
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 tabular-nums ${cls}`}
    >
      {label}
    </span>
  )
}
