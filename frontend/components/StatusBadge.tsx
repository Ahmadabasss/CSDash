import clsx from 'clsx'

const CONFIG: Record<string, { label: string; classes: string }> = {
  new:        { label: 'New',         classes: 'bg-red-100 text-red-700 ring-red-200' },
  inprogress: { label: 'In Progress', classes: 'bg-blue-100 text-blue-700 ring-blue-200' },
  resolved:   { label: 'Resolved',    classes: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  dismissed:  { label: 'Dismissed',   classes: 'bg-[#f3f2f1] text-[#605e5c] ring-[#edebe9]' },
  healthy:    { label: 'Healthy',     classes: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  unhealthy:  { label: 'Unhealthy',   classes: 'bg-red-100 text-red-700 ring-red-200' },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status?.toLowerCase()] ?? { label: status, classes: 'bg-[#f3f2f1] text-[#605e5c] ring-[#edebe9]' }
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1', cfg.classes)}>
      {cfg.label}
    </span>
  )
}
