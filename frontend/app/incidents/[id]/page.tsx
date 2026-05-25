import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Server, Globe, FileText, ChevronRight } from 'lucide-react'
import { api } from '../../../lib/api'
import type { Incident } from '../../../types/azure'
import SeverityBadge from '../../../components/SeverityBadge'
import TriageSummary from '../../../components/TriageSummary'

export const dynamic = 'force-dynamic'

const TACTIC_COLORS: Record<string, string> = {
  InitialAccess: 'bg-red-100 text-red-700',
  Execution: 'bg-orange-100 text-orange-700',
  Persistence: 'bg-amber-100 text-amber-700',
  PrivilegeEscalation: 'bg-yellow-100 text-yellow-300',
  DefenseEvasion: 'bg-lime-100 text-lime-300',
  CredentialAccess: 'bg-emerald-100 text-emerald-700',
  Discovery: 'bg-teal-100 text-teal-300',
  LateralMovement: 'bg-cyan-100 text-cyan-300',
  Collection: 'bg-blue-100 text-blue-700',
  CommandAndControl: 'bg-indigo-100 text-indigo-300',
  Exfiltration: 'bg-violet-100 text-violet-700',
  Impact: 'bg-purple-100 text-purple-700',
}

const ENTITY_ICON: Record<string, React.ElementType> = {
  host: Server,
  account: User,
  ip: Globe,
  file: FileText,
  url: Globe,
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let incident
  try {
    incident = await api.incident(id)
  } catch {
    notFound()
  }

  const statusColor: Record<string, string> = {
    Active: 'bg-red-100 text-red-700',
    New: 'bg-amber-100 text-amber-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Resolved: 'bg-emerald-100 text-emerald-700',
    Closed: 'bg-[#edebe9] text-[#605e5c]',
  }

  return (
    <div className="px-6 py-6 max-w-5xl">
      <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Incidents
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="mt-1"><SeverityBadge severity={incident.severity} /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#323130] leading-snug">{incident.displayName}</h1>
          <p className="text-sm text-[#797775] mt-1">Incident #{incident.incidentNumber}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded ${statusColor[incident.status] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
          {incident.status}
        </span>
      </div>

      {/* AI Triage */}
      <div className="mb-4">
        <TriageSummary type="incident" id={incident.id} />
      </div>

      {/* Attack Timeline */}
      <div className="mb-4">
        <Section title="Attack Timeline">
          <AttackTimeline incident={incident} tacticColors={TACTIC_COLORS} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* Entities */}
          {incident.entities.length > 0 && (
            <Section title={`Entities (${incident.entities.length})`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {incident.entities.map((e, i) => {
                  const Icon = ENTITY_ICON[e.type] ?? FileText
                  return (
                    <div key={i} className="flex items-center gap-2.5 bg-white/60 rounded px-3 py-2.5">
                      <Icon className="w-4 h-4 text-[#0078d4] shrink-0" />
                      <div>
                        <p className="text-[12px] text-[#323130] font-medium">{e.name}</p>
                        <p className="text-[11px] text-[#797775] capitalize">{e.type}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Tags */}
          {incident.tags.length > 0 && (
            <Section title="Tags">
              <div className="flex flex-wrap gap-2">
                {incident.tags.map(tag => (
                  <span key={tag} className="text-xs bg-[#edebe9] text-[#4b4b4b] px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <Section title="Details">
            <dl className="space-y-2.5">
              <MetaRow label="Classification" value={incident.classification} />
              <MetaRow label="Determination" value={incident.determination} />
              <MetaRow label="Assigned To" value={incident.assignedTo ?? 'Unassigned'} dim={!incident.assignedTo} />
              <MetaRow label="Alerts" value={String(incident.alertsCount)} />
              <MetaRow label="Bookmarks" value={String(incident.bookmarks)} />
              <MetaRow label="Comments" value={String(incident.comments)} />
            </dl>
          </Section>

          <Section title="Key Dates">
            <dl className="space-y-2.5">
              <TimeRow label="Created" value={incident.createdDateTime} />
              <TimeRow label="First Activity" value={incident.firstActivityDateTime} />
              <TimeRow label="Last Activity" value={incident.lastActivityDateTime} />
              <TimeRow label="Last Modified" value={incident.lastModifiedDateTime} />
            </dl>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#edebe9] rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#797775] mb-3">{title}</h2>
      {children}
    </div>
  )
}

function MetaRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xs text-[#797775] shrink-0">{label}</dt>
      <dd className={`text-xs text-right truncate ${dim ? 'text-[#a19f9d]' : 'text-[#4b4b4b]'}`}>{value}</dd>
    </div>
  )
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[#797775]">{label}</dt>
      <dd className="text-xs text-[#4b4b4b] mt-0.5">{new Date(value).toLocaleString()}</dd>
    </div>
  )
}

// MITRE ATT&CK kill-chain order for sorting tactics
const TACTIC_ORDER = [
  'Reconnaissance', 'ResourceDevelopment', 'InitialAccess', 'Execution',
  'Persistence', 'PrivilegeEscalation', 'DefenseEvasion', 'CredentialAccess',
  'Discovery', 'LateralMovement', 'Collection', 'CommandAndControl',
  'Exfiltration', 'Impact',
]

function AttackTimeline({ incident, tacticColors }: { incident: Incident; tacticColors: Record<string, string> }) {
  const first = new Date(incident.firstActivityDateTime)
  const last = new Date(incident.lastActivityDateTime)
  const durationMs = last.getTime() - first.getTime()
  const durationLabel = durationMs < 3_600_000
    ? `${Math.round(durationMs / 60_000)}m`
    : durationMs < 86_400_000
      ? `${Math.round(durationMs / 3_600_000)}h`
      : `${Math.round(durationMs / 86_400_000)}d`

  const sortedTactics = [...incident.tactics].sort(
    (a, b) => (TACTIC_ORDER.indexOf(a) ?? 99) - (TACTIC_ORDER.indexOf(b) ?? 99)
  )

  // Key events derived from incident data
  const events = [
    { time: incident.firstActivityDateTime, label: 'First Activity', color: 'bg-amber-500' },
    { time: incident.createdDateTime, label: 'Incident Created', color: 'bg-blue-500' },
    { time: incident.lastActivityDateTime, label: 'Last Activity', color: 'bg-red-500' },
    { time: incident.lastModifiedDateTime, label: 'Last Modified', color: 'bg-[#94a3b8]' },
  ]
    .filter((e, i, arr) => arr.findIndex(x => x.time === e.time) === i)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <div className="space-y-5">
      {/* Duration bar */}
      <div className="flex items-center gap-3 text-xs text-[#605e5c]">
        <span className="whitespace-nowrap">{new Date(first).toLocaleString()}</span>
        <div className="flex-1 h-1.5 rounded-full bg-[#edebe9] relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-amber-500/60 via-red-500/60 to-red-700/60 rounded-full" />
        </div>
        <span className="whitespace-nowrap">{new Date(last).toLocaleString()}</span>
        <span className="rounded bg-[#edebe9] px-2 py-0.5 font-mono text-[#4b4b4b] shrink-0">{durationLabel}</span>
      </div>

      {/* Event markers */}
      <div className="relative">
        <div className="absolute left-2 top-0 bottom-0 w-px bg-[#edebe9]" />
        <div className="space-y-3 pl-8">
          {events.map((e, i) => (
            <div key={i} className="relative flex items-start gap-3">
              <div className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${e.color}`} />
              <div>
                <p className="text-xs font-medium text-[#323130]">{e.label}</p>
                <p className="text-[11px] text-[#797775]">{new Date(e.time).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tactic chain */}
      {sortedTactics.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#797775] mb-2">ATT&CK Kill Chain</p>
          <div className="flex flex-wrap items-center gap-1">
            {sortedTactics.map((t, i) => (
              <span key={t} className="flex items-center gap-1">
                <span className={`text-xs font-medium px-2 py-1 rounded ${tacticColors[t] ?? 'bg-[#edebe9] text-[#4b4b4b]'}`}>
                  {t.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                {i < sortedTactics.length - 1 && <ChevronRight className="w-3 h-3 text-[#a19f9d] shrink-0" />}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
