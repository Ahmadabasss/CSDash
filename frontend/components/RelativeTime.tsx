'use client'

import { useEffect, useState } from 'react'

function format(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function RelativeTime({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr)
  const [rel, setRel] = useState(format(date))

  useEffect(() => {
    const id = setInterval(() => setRel(format(date)), 60_000)
    return () => clearInterval(id)
  })

  return (
    <time dateTime={dateStr} title={date.toLocaleString()} className="text-slate-400 text-sm">
      {rel}
    </time>
  )
}
