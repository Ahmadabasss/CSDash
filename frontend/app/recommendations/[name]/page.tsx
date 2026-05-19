import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Tag, Zap, Users, Shield, ExternalLink, Clock } from 'lucide-react'
import { api } from '../../../lib/api'
import SeverityBadge from '../../../components/SeverityBadge'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  Unhealthy: 'bg-red-900/40 text-red-300 ring-1 ring-red-800',
  Healthy: 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-800',
  NotApplicable: 'bg-slate-700 text-slate-400',
  NotApplicableInformational: 'bg-slate-700 text-slate-400',
}

const EFFORT_COLOR: Record<string, string> = {
  Low: 'text-emerald-400',
  Moderate: 'text-amber-400',
  High: 'text-red-400',
}

const IMPACT_COLOR: Record<string, string> = {
  Low: 'text-blue-400',
  Moderate: 'text-amber-400',
  High: 'text-red-400',
}

export default async function RecommendationDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  let rec
  try {
    rec = await api.recommendation(decodedName)
  } catch {
    notFound()
  }

  const props = rec.properties
  const meta = props.metadata
  const resource = props.resourceDetails
  const status = props.status

  const statusKey = status.code
  const isHealthy = statusKey === 'Healthy'

  return (
    <div className="px-6 py-6 max-w-4xl">
      <Link href="/recommendations" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Recommendations
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="mt-1"><SeverityBadge severity={meta.severity.toLowerCase() as never} /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white leading-snug">{props.displayName}</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">{rec.name}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded shrink-0 ${STATUS_STYLE[statusKey] ?? 'bg-slate-700 text-slate-400'}`}>
          {isHealthy
            ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Healthy</span>
            : <span className="flex items-center gap-1"><XCircle className="w-3 h-3" />{statusKey}</span>
          }
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <Section title="Description">
            <p className="text-slate-300 text-sm leading-relaxed">{meta.description}</p>
          </Section>

          {/* Remediation */}
          <Section title="Remediation Steps">
            {/* Effort + impact summary */}
            <div className="flex gap-3 mb-4">
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-xs ring-1 ring-slate-700/40">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Effort:</span>
                <span className={`font-semibold ${EFFORT_COLOR[meta.implementationEffort] ?? 'text-slate-300'}`}>{meta.implementationEffort}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-xs ring-1 ring-slate-700/40">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">User impact:</span>
                <span className={`font-semibold ${IMPACT_COLOR[meta.userImpact] ?? 'text-slate-300'}`}>{meta.userImpact}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-xs ring-1 ring-slate-700/40">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Status:</span>
                <span className={`font-semibold ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>{statusKey}</span>
              </div>
            </div>

            {status.cause && (
              <div className="flex items-start gap-2 mb-4 bg-amber-900/20 border border-amber-800/40 rounded p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{status.cause}</p>
              </div>
            )}

            <RemediationSteps text={meta.remediationDescription} />

            <a
              href={`https://portal.azure.com/#blade/Microsoft_Azure_Security/RecommendationsBlade`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in Azure Portal
            </a>
          </Section>

          {/* Threats */}
          {meta.threats.length > 0 && (
            <Section title="Threat Coverage">
              <div className="flex flex-wrap gap-2">
                {meta.threats.map(threat => (
                  <span key={threat} className="flex items-center gap-1.5 text-xs bg-red-900/20 text-red-300 border border-red-800/40 px-2.5 py-1.5 rounded">
                    <Shield className="w-3 h-3" />{threat}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Affected resource */}
          <Section title="Affected Resource">
            <dl className="space-y-2.5">
              <MetaRow label="Resource Name" value={resource.ResourceName} mono />
              <MetaRow label="Resource Type" value={resource.ResourceType} />
              <MetaRow label="Source" value={resource.Source} />
            </dl>
          </Section>

          {/* Metadata */}
          <Section title="Metadata">
            <dl className="space-y-3">
              {/* Categories */}
              {meta.categories.length > 0 && (
                <div>
                  <dt className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
                    <Tag className="w-3 h-3" /> Categories
                  </dt>
                  <dd className="flex flex-wrap gap-1">
                    {meta.categories.map(cat => (
                      <span key={cat} className="text-xs bg-[#0078d4]/20 text-blue-300 px-2 py-0.5 rounded">{cat}</span>
                    ))}
                  </dd>
                </div>
              )}

            </dl>
          </Section>

          {/* Status detail */}
          {status.description && (
            <Section title="Status Detail">
              <p className="text-xs text-slate-400 leading-relaxed">{status.description}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1e293b] border border-white/6 rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-xs text-slate-300 mt-0.5 break-all ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function RemediationSteps({ text }: { text: string }) {
  // Split on numbered patterns like "1." "2." or sentence-ending periods before capital letters
  const steps = text
    .split(/(?:\r?\n)+|(?<=\.)\s+(?=[A-Z0-9])/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)

  if (steps.length <= 1) {
    return <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#0078d4]/20 text-[#60a5fa] text-xs font-bold flex items-center justify-center ring-1 ring-[#0078d4]/30 mt-0.5">
            {i + 1}
          </span>
          <p className="text-slate-300 text-sm leading-relaxed">{step}</p>
        </li>
      ))}
    </ol>
  )
}
