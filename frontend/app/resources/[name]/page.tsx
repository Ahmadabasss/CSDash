import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Box, MapPin, Tag, Bell, Shield } from 'lucide-react'
import { api } from '../../../lib/api'
import SeverityBadge from '../../../components/SeverityBadge'

export const dynamic = 'force-dynamic'

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function formatResourceType(type: string) {
  const parts = type.split('/')
  return parts[parts.length - 1]
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, s => s.toUpperCase())
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  let resource
  try {
    resource = await api.resource(decodedName)
  } catch {
    notFound()
  }

  const hasAlerts = resource.relatedAlerts && resource.relatedAlerts.length > 0
  const hasRecs = resource.relatedRecommendations && resource.relatedRecommendations.length > 0

  return (
    <div className="px-6 py-6 max-w-5xl">
      <Link href="/resources" className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Resources
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white border border-[#edebe9] flex items-center justify-center shrink-0">
          <Box className="w-5 h-5 text-[#0078d4]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-mono text-[#323130]">{resource.name}</h1>
          <p className="text-sm text-[#605e5c] mt-0.5">{formatResourceType(resource.type)}</p>
        </div>
        <div className={`text-center bg-white border border-[#edebe9] rounded-lg px-4 py-2`}>
          <p className={`text-2xl font-bold tabular-nums ${SCORE_COLOR(resource.secureScore)}`}>{resource.secureScore}</p>
          <p className="text-[10px] text-[#797775] mt-0.5">Secure Score</p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Secure Score"
          value={`${resource.secureScore}%`}
          color={SCORE_COLOR(resource.secureScore)}
        />
        <StatCard
          label="Issues"
          value={resource.issuesCount}
          color={resource.issuesCount > 5 ? 'text-red-600' : resource.issuesCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <StatCard label="Location" value={resource.location} />
        <StatCard label="Resource Group" value={resource.resourceGroup} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Related alerts */}
          {hasAlerts && (
            <Section title={`Related Alerts (${resource.relatedAlerts!.length})`}>
              <div className="space-y-2">
                {resource.relatedAlerts!.map(alert => (
                  <div key={alert.id} className="flex items-center gap-3 bg-white/60 rounded px-3 py-2.5">
                    <Bell className="w-4 h-4 text-[#797775] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#323130] font-medium truncate">{alert.title}</p>
                      <p className="text-[11px] text-[#797775]">{alert.category}</p>
                    </div>
                    <SeverityBadge severity={alert.severity} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Related recommendations */}
          {hasRecs && (
            <Section title={`Recommendations (${resource.relatedRecommendations!.length})`}>
              <div className="space-y-2">
                {resource.relatedRecommendations!.map(rec => (
                  <div key={rec.id} className="flex items-center gap-3 bg-white/60 rounded px-3 py-2.5">
                    <Shield className="w-4 h-4 text-[#797775] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#323130] font-medium truncate">{rec.properties.displayName}</p>
                      <p className="text-[11px] text-[#797775]">{rec.properties.status.code}</p>
                    </div>
                    <SeverityBadge severity={rec.properties.metadata.severity.toLowerCase() as never} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!hasAlerts && !hasRecs && (
            <div className="bg-white border border-[#edebe9] rounded-lg p-8 text-center">
              <Shield className="w-8 h-8 text-[#a19f9d] mx-auto mb-2" />
              <p className="text-[#797775] text-sm">No related alerts or recommendations</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Resource Details">
            <dl className="space-y-2.5">
              <MetaRow label="Name" value={resource.name} mono />
              <MetaRow icon={<MapPin className="w-3 h-3" />} label="Location" value={resource.location} />
              <MetaRow label="Resource Group" value={resource.resourceGroup} />
              <MetaRow label="Subscription" value={resource.subscriptionId} mono />
              <div>
                <dt className="text-xs text-[#797775]">Resource Type</dt>
                <dd className="text-xs text-[#4b4b4b] mt-0.5 break-all font-mono">{resource.type}</dd>
              </div>
            </dl>
          </Section>

          {/* Tags */}
          {resource.tags && Object.keys(resource.tags).length > 0 && (
            <Section title="Tags">
              <div className="space-y-1.5">
                {Object.entries(resource.tags).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-[#a19f9d] shrink-0" />
                    <span className="text-xs text-[#797775]">{k}:</span>
                    <span className="text-xs text-[#4b4b4b] truncate">{v}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Secure score bar */}
          <Section title="Security Posture">
            <div className="text-center py-1">
              <p className={`text-4xl font-bold tabular-nums ${SCORE_COLOR(resource.secureScore)}`}>
                {resource.secureScore}
              </p>
              <p className="text-[10px] text-[#797775] mt-0.5">/ 100</p>
              <div className="mt-3 h-2 rounded-full bg-[#edebe9] overflow-hidden">
                <div
                  className={`h-full rounded-full ${resource.secureScore >= 70 ? 'bg-emerald-500' : resource.secureScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${resource.secureScore}%` }}
                />
              </div>
              <p className="text-xs text-[#797775] mt-2">
                {resource.issuesCount} issue{resource.issuesCount !== 1 ? 's' : ''} detected
              </p>
            </div>
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

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-[#edebe9] rounded-lg p-4">
      <p className="text-xs text-[#605e5c] uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 truncate ${color ?? 'text-[#323130]'}`}>{value}</p>
    </div>
  )
}

function MetaRow({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[#797775] flex items-center gap-1">{icon}{label}</dt>
      <dd className={`text-xs text-[#4b4b4b] mt-0.5 break-all ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
