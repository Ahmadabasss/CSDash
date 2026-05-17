import clsx from 'clsx'

const CONFIG = {
  critical: { label: 'Critical', classes: 'bg-red-950 text-red-300 ring-red-900' },
  high:     { label: 'High',     classes: 'bg-red-900/40 text-red-400 ring-red-800' },
  medium:   { label: 'Medium',   classes: 'bg-amber-900/40 text-amber-400 ring-amber-800' },
  low:      { label: 'Low',      classes: 'bg-blue-900/40 text-blue-400 ring-blue-800' },
  informational: { label: 'Info', classes: 'bg-slate-800 text-slate-400 ring-slate-700' },
} as const

type SeverityKey = keyof typeof CONFIG

interface Props {
  severity: string
  className?: string
}

export default function SeverityBadge({ severity, className }: Props) {
  const key = severity?.toLowerCase() as SeverityKey
  const cfg = CONFIG[key] ?? CONFIG.informational
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ring-1 uppercase tracking-wide',
        cfg.classes,
        className
      )}
    >
      {cfg.label}
    </span>
  )
}
