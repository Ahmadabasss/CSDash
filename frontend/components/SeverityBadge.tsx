import clsx from 'clsx'

const CONFIG = {
  critical: { label: 'Critical', classes: 'bg-red-100 text-red-700 ring-red-200' },
  high:     { label: 'High',     classes: 'bg-orange-100 text-orange-700 ring-orange-200' },
  medium:   { label: 'Medium',   classes: 'bg-amber-100 text-amber-700 ring-amber-200' },
  low:      { label: 'Low',      classes: 'bg-blue-100 text-blue-700 ring-blue-200' },
  informational: { label: 'Info', classes: 'bg-slate-100 text-slate-600 ring-slate-200' },
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
