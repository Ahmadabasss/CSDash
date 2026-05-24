import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, AlertTriangle, Shield, Calendar, RefreshCw } from 'lucide-react'
import { api } from '../../../lib/api'
import SeverityBadge from '../../../components/SeverityBadge'

export const dynamic = 'force-dynamic'

const CVSS_COLOR = (score: number) => {
  if (score >= 9.0) return 'text-red-600'
  if (score >= 7.0) return 'text-red-600'
  if (score >= 4.0) return 'text-amber-600'
  return 'text-blue-600'
}

const TAG_STYLE: Record<string, string> = {
  EXPLOIT_AVAILABLE: 'bg-red-100 text-red-700 ring-1 ring-red-700',
  RANSOMWARE_ASSOCIATED: 'bg-orange-100 text-orange-700 ring-1 ring-orange-700',
  ACTIVE_THREAT: 'bg-red-100 text-red-700 ring-1 ring-red-600',
  WORM: 'bg-amber-100 text-amber-700 ring-1 ring-amber-700',
}

export default async function CVEDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cveId = decodeURIComponent(id)
  let cve
  try {
    const all = await api.vulnerabilities()
    cve = all.find(v => v.id === cveId)
    if (!cve) notFound()
  } catch {
    notFound()
  }

  const cvssLabel = cve.cvssV3 >= 9.0 ? 'Critical' : cve.cvssV3 >= 7.0 ? 'High' : cve.cvssV3 >= 4.0 ? 'Medium' : 'Low'

  return (
    <div className="px-6 py-6 max-w-4xl">
      <Link href="/vulnerabilities" className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to CVEs
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="mt-1"><SeverityBadge severity={cve.severity} /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-mono text-white">{cve.id}</h1>
          <p className="text-[#4b4b4b] mt-1 leading-snug">{cve.name}</p>
        </div>
        <a
          href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#60a5fa] hover:text-white transition-colors bg-white border border-[#edebe9] px-3 py-1.5 rounded shrink-0"
        >
          NVD <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* CVSS score hero */}
      <div className="bg-white border border-[#edebe9] rounded-lg p-5 mb-4">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className={`text-5xl font-bold tabular-nums ${CVSS_COLOR(cve.cvssV3)}`}>{cve.cvssV3.toFixed(1)}</p>
            <p className="text-xs text-[#797775] mt-1">CVSS v3 Base Score</p>
            <p className={`text-sm font-semibold mt-1 ${CVSS_COLOR(cve.cvssV3)}`}>{cvssLabel}</p>
          </div>
          <div className="flex-1">
            {/* CVSS score bar */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-gradient-to-r from-blue-600 via-amber-500 to-red-600">
                <div className="h-full flex items-center justify-end pr-1" style={{ width: `${(cve.cvssV3 / 10) * 100}%` }}>
                  <div className="w-2 h-2 rounded-full bg-white shadow" />
                </div>
              </div>
              <span className="text-xs text-[#605e5c] w-12">/ 10.0</span>
            </div>
            <div className="flex justify-between text-[10px] text-[#797775]">
              <span>0 — None</span><span>0.1–3.9 Low</span><span>4.0–6.9 Med</span><span>7.0–8.9 High</span><span>9.0–10.0 Crit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <Section title="Description">
            <p className="text-[#4b4b4b] text-sm leading-relaxed">{cve.description}</p>
          </Section>

          {/* Exploit info */}
          <Section title="Exploit Information">
            <div className="grid grid-cols-2 gap-3">
              <ExploitCard
                label="Public Exploit"
                active={cve.publicExploit}
                activeText="Available"
                inactiveText="Not Known"
                danger
              />
              <ExploitCard
                label="Exploit Kit"
                active={cve.exploitInKit}
                activeText="Included in Kit"
                inactiveText="Not in Kit"
                danger
              />
            </div>
            {cve.exploitTypes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[#797775] uppercase tracking-wider mb-2">Exploit Types</p>
                <div className="flex flex-wrap gap-2">
                  {cve.exploitTypes.map(t => (
                    <span key={t} className="text-xs bg-[#edebe9] text-[#4b4b4b] px-2.5 py-1 rounded font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Threat tags */}
          {cve.tags.length > 0 && (
            <Section title="Threat Intelligence Tags">
              <div className="flex flex-wrap gap-2">
                {cve.tags.map(tag => (
                  <span key={tag} className={`text-xs font-semibold px-2.5 py-1.5 rounded ${TAG_STYLE[tag] ?? 'bg-[#edebe9] text-[#4b4b4b]'}`}>
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Remediation guidance */}
          <Section title="Remediation Guidance">
            <p className="text-[#4b4b4b] text-sm leading-relaxed">
              Apply the latest security patches from the vendor for the affected software. Check the NVD entry for CVE-specific
              patch links. Verify the patch is applied on all {cve.exposedMachines} exposed machine{cve.exposedMachines !== 1 ? 's' : ''} in your environment.
              After patching, rescan affected hosts to confirm remediation.
            </p>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Impact">
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-[#797775]">Exposed Machines</dt>
                <dd className={`text-2xl font-bold mt-0.5 ${cve.exposedMachines > 0 ? 'text-red-600' : 'text-[#605e5c]'}`}>
                  {cve.exposedMachines}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#797775]">CVE Severity</dt>
                <dd className="mt-1"><SeverityBadge severity={cve.severity} /></dd>
              </div>
            </dl>
          </Section>

          <Section title="Dates">
            <dl className="space-y-2.5">
              <div>
                <dt className="text-xs text-[#797775] flex items-center gap-1"><Calendar className="w-3 h-3" /> Published</dt>
                <dd className="text-xs text-[#4b4b4b] mt-0.5">{new Date(cve.publishedOn).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#797775] flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Last Updated</dt>
                <dd className="text-xs text-[#4b4b4b] mt-0.5">{new Date(cve.updatedOn).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
              </div>
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

function ExploitCard({ label, active, activeText, inactiveText, danger }: {
  label: string; active: boolean; activeText: string; inactiveText: string; danger?: boolean
}) {
  return (
    <div className={`rounded p-3 border ${active && danger ? 'bg-red-100 border-red-800/40' : 'bg-white/60 border-white/4'}`}>
      <p className="text-xs text-[#797775]">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${active && danger ? 'text-red-600' : 'text-[#605e5c]'}`}>
        {active ? activeText : inactiveText}
      </p>
    </div>
  )
}
