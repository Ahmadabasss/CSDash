import clsx from 'clsx'

const CONFIG: Record<string, { label: string; classes: string }> = {
  new:        { label: 'New',         classes: 'bg-red-900/40 text-red-400 ring-red-800' },
  inprogress: { label: 'In Progress', classes: 'bg-blue-900/40 text-blue-400 ring-blue-800' },
  resolved:   { label: 'Resolved',    classes: 'bg-emerald-900/40 text-emerald-400 ring-emerald-800' },
  dismissed:  { label: 'Dismissed',   classes: 'bg-slate-800 text-slate-400 ring-slate-700' },
  healthy:    { label: 'Healthy',     classes: 'bg-emerald-900/40 text-emerald-400 ring-emerald-800' },
  unhealthy:  { label: 'Unhealthy',   classes: 'bg-red-900/40 text-red-400 ring-red-800' },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status?.toLowerCase()] ?? { label: status, classes: 'bg-slate-800 text-slate-400 ring-slate-700' }
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1', cfg.classes)}>
      {cfg.label}
    </span>
  )
}
