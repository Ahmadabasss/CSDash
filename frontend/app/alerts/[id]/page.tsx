import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Clock, User, AlertTriangle } from 'lucide-react'
import { api } from '../../../lib/api'
import SeverityBadge from '../../../components/SeverityBadge'
import StatusBadge from '../../../components/StatusBadge'
import MitreTag from '../../../components/MitreTag'
import TriageSummary from '../../../components/TriageSummary'

export const dynamic = 'force-dynamic'

const MITRE_NAMES: Record<string, string> = {
  T1059: 'Command and Scripting Interpreter',
  'T1059.001': 'PowerShell',
  'T1059.003': 'Windows Command Shell',
  T1078: 'Valid Accounts',
  T1098: 'Account Manipulation',
  T1190: 'Exploit Public-Facing Application',
  T1486: 'Data Encrypted for Impact',
  T1489: 'Service Stop',
  T1566: 'Phishing',
  'T1566.001': 'Spearphishing Attachment',
  T1055: 'Process Injection',
  T1036: 'Masquerading',
  T1027: 'Obfuscated Files or Information',
  T1021: 'Remote Services',
  T1110: 'Brute Force',
  T1003: 'OS Credential Dumping',
  T1083: 'File and Directory Discovery',
  T1057: 'Process Discovery',
  T1082: 'System Information Discovery',
  T1071: 'Application Layer Protocol',
  T1041: 'Exfiltration Over C2 Channel',
  T1567: 'Exfiltration Over Web Service',
}

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let alert
  try {
    alert = await api.alert(decodeURIComponent(id))
  } catch {
    notFound()
  }

  const resources = alert.evidence.filter(e => e['@odata.type']?.includes('azure') || e.resourceId)
  const users = alert.evidence.filter(e => e.userAccount)

  return (
    <div className="px-6 py-6 max-w-5xl">
      <Link href="/alerts" className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Alerts
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="mt-1"><SeverityBadge severity={alert.severity} /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#323130] leading-snug">{alert.title}</h1>
          <p className="text-sm text-[#605e5c] mt-1 font-mono">{alert.id}</p>
        </div>
        <StatusBadge status={alert.status} />
      </div>

      {/* AI Triage */}
      <div className="mb-4">
        <TriageSummary type="alert" id={alert.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <Section title="Description">
            <p className="text-[#4b4b4b] text-sm leading-relaxed">{alert.description}</p>
          </Section>

          {/* Recommended Actions */}
          <Section title="Recommended Actions">
            <p className="text-[#4b4b4b] text-sm leading-relaxed">{alert.recommendedActions || 'No remediation steps provided.'}</p>
          </Section>

          {/* Evidence */}
          {(resources.length > 0 || users.length > 0) && (
            <Section title="Evidence">
              {resources.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[#797775] uppercase tracking-wider mb-2">Affected Resources</p>
                  <div className="space-y-1.5">
                    {resources.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/60 rounded px-3 py-2">
                        <Shield className="w-3.5 h-3.5 text-[#0078d4] shrink-0" />
                        <code className="text-[11px] text-[#4b4b4b] font-mono break-all">{e.resourceId}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {users.length > 0 && (
                <div>
                  <p className="text-xs text-[#797775] uppercase tracking-wider mb-2">Involved Accounts</p>
                  <div className="space-y-1.5">
                    {users.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/60 rounded px-3 py-2">
                        <User className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <div>
                          <p className="text-[12px] text-[#323130] font-medium">{e.userAccount?.userPrincipalName}</p>
                          <p className="text-[11px] text-[#797775]">{e.userAccount?.accountName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* MITRE Techniques */}
          {alert.mitreTechniques.length > 0 && (
            <Section title="MITRE ATT&CK Techniques">
              <div className="space-y-2">
                {alert.mitreTechniques.map(t => (
                  <div key={t} className="flex items-center gap-3">
                    <MitreTag technique={t} />
                    <span className="text-sm text-[#605e5c]">{MITRE_NAMES[t] ?? 'Technique'}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-4">
          <Section title="Details">
            <dl className="space-y-2.5">
              <MetaRow label="Category" value={alert.category} />
              <MetaRow label="Service Source" value={alert.serviceSource} />
              <MetaRow label="Detection Source" value={alert.detectionSource} />
              <MetaRow label="Classification" value={alert.classification} />
              <MetaRow label="Determination" value={alert.determination} />
              <MetaRow label="Assigned To" value={alert.assignedTo ?? 'Unassigned'} dim={!alert.assignedTo} />
            </dl>
          </Section>

          <Section title="Timeline">
            <dl className="space-y-2.5">
              <TimeRow label="Created" value={alert.createdDateTime} />
              <TimeRow label="First Activity" value={alert.firstActivityDateTime} />
              <TimeRow label="Last Activity" value={alert.lastActivityDateTime} />
              <TimeRow label="Last Updated" value={alert.lastUpdateDateTime} />
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
  const d = new Date(value)
  return (
    <div>
      <dt className="text-xs text-[#797775]">{label}</dt>
      <dd className="text-xs text-[#4b4b4b] mt-0.5">{d.toLocaleString()}</dd>
    </div>
  )
}
