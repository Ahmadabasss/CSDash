import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, ExternalLink } from 'lucide-react'
import { api } from '../../../lib/api'
import type { ComplianceControl } from '../../../types/azure'

export const dynamic = 'force-dynamic'

const STATE_STYLE: Record<string, string> = {
  Passed: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  Failed: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  Skipped: 'bg-[#edebe9] text-[#605e5c]',
}

const STANDARD_LABELS: Record<string, { full: string; url: string }> = {
  'Azure-CIS-1.4.0': { full: 'CIS Microsoft Azure Foundations Benchmark v1.4.0', url: 'https://www.cisecurity.org/benchmark/azure' },
  'Azure-SOC-TSP': { full: 'SOC 2 Type II', url: 'https://www.aicpa.org/soc2' },
  'Azure-PCI-DSS-3.2.1': { full: 'PCI DSS v3.2.1', url: 'https://www.pcisecuritystandards.org' },
  'Azure-ISO-27001': { full: 'ISO/IEC 27001:2013', url: 'https://www.iso.org/isoiec-27001-information-security.html' },
  'NIST-SP-800-53': { full: 'NIST SP 800-53 Rev 5', url: 'https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final' },
}

export default async function ComplianceDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)

  const [standards, controls] = await Promise.all([
    api.compliance(),
    api.complianceControls(decodedName).catch(() => [] as ComplianceControl[]),
  ])
  const standard = standards.find(s => s.name === decodedName || s.id.endsWith(decodedName))
  if (!standard) notFound()

  const props = standard.properties
  const total = props.passedControls + props.failedControls + props.skippedControls
  const passRate = total > 0 ? Math.round((props.passedControls / total) * 100) : 0
  const meta = STANDARD_LABELS[standard.name] ?? { full: standard.name.replace('Azure-', ''), url: null }

  return (
    <div className="px-6 py-6 max-w-4xl">
      <Link href="/compliance" className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Compliance
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#323130]">{meta.full}</h1>
          <p className="text-sm text-[#797775] font-mono mt-0.5">{standard.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded ${STATE_STYLE[props.state] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
            {props.state}
          </span>
          {meta.url && (
            <a
              href={meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#60a5fa] hover:text-white transition-colors bg-white border border-[#edebe9] px-2.5 py-1 rounded"
            >
              Docs <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Pass rate hero */}
      <div className="bg-white border border-[#edebe9] rounded-lg p-5 mb-4">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className={`text-5xl font-bold tabular-nums ${passRate >= 70 ? 'text-emerald-600' : passRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
              {passRate}%
            </p>
            <p className="text-xs text-[#797775] mt-1">Pass Rate</p>
          </div>
          <div className="flex-1">
            <div className="h-3 rounded-full bg-[#edebe9] overflow-hidden">
              <div
                className={`h-full rounded-full ${passRate >= 70 ? 'bg-emerald-500' : passRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${passRate}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-3 mt-4">
              <ControlStat icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} label="Passed" value={props.passedControls} color="text-emerald-600" />
              <ControlStat icon={<XCircle className="w-4 h-4 text-red-600" />} label="Failed" value={props.failedControls} color="text-red-600" />
              <ControlStat icon={<MinusCircle className="w-4 h-4 text-[#797775]" />} label="Skipped" value={props.skippedControls} color="text-[#605e5c]" />
              <ControlStat icon={<MinusCircle className="w-4 h-4 text-[#a19f9d]" />} label="Unsupported" value={props.unsupportedControls} color="text-[#a19f9d]" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Individual controls */}
          {controls.length > 0 && (
            <Section title={`Controls (${controls.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#edebe9] text-left">
                      <th className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#797775] w-24">Control</th>
                      <th className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">Description</th>
                      <th className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#797775] w-24 text-right">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {controls.map(c => (
                      <tr key={c.id} className="group">
                        <td className="py-2.5 pr-4 font-mono text-xs text-[#605e5c] whitespace-nowrap">{c.id}</td>
                        <td className="py-2.5 pr-4 text-xs text-[#4b4b4b] leading-relaxed">{c.description}</td>
                        <td className="py-2.5 text-right">
                          {c.state === 'Passed' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle className="w-3.5 h-3.5" /> Passed
                            </span>
                          )}
                          {c.state === 'Failed' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                          {c.state === 'Skipped' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#605e5c]">
                              <MinusCircle className="w-3.5 h-3.5" /> Skipped
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Remediation CTA */}
          {props.failedControls > 0 && (
            <Section title="Remediation">
              <p className="text-sm text-[#4b4b4b] leading-relaxed mb-4">
                This standard has <span className="text-red-600 font-semibold">{props.failedControls} failing controls</span> that need attention.
                Review the open security recommendations below to improve your compliance posture.
              </p>
              <Link
                href="/recommendations"
                className="inline-flex items-center gap-2 text-sm bg-[#0078d4] hover:bg-[#0078d4]/80 text-white px-4 py-2 rounded transition-colors"
              >
                View Recommendations
              </Link>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Summary">
            <dl className="space-y-2.5">
              <MetaRow label="State" value={props.state} colored={props.state === 'Passed' ? 'emerald' : props.state === 'Failed' ? 'red' : 'slate'} />
              <MetaRow label="Total Controls" value={String(total)} />
              <MetaRow label="Pass Rate" value={`${passRate}%`} />
            </dl>
          </Section>

          <Section title="All Standards">
            <div className="space-y-1.5">
              {standards.map(s => {
                const sTotal = s.properties.passedControls + s.properties.failedControls
                const sRate = sTotal > 0 ? Math.round((s.properties.passedControls / sTotal) * 100) : 0
                const isCurrent = s.name === standard.name
                return (
                  <Link
                    key={s.name}
                    href={`/compliance/${encodeURIComponent(s.name)}`}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${isCurrent ? 'bg-[#0078d4]/20 text-[#60a5fa]' : 'text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#323130]'}`}
                  >
                    <span className="truncate">{s.name.replace('Azure-', '')}</span>
                    <span className={`tabular-nums font-medium ml-2 shrink-0 ${sRate >= 70 ? 'text-emerald-600' : sRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {sRate}%
                    </span>
                  </Link>
                )
              })}
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

function ControlStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-[#797775] mt-0.5">{label}</p>
    </div>
  )
}

function MetaRow({ label, value, colored }: { label: string; value: string; colored?: string }) {
  const colorClass = colored === 'emerald' ? 'text-emerald-600' : colored === 'red' ? 'text-red-600' : 'text-[#4b4b4b]'
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xs text-[#797775]">{label}</dt>
      <dd className={`text-xs font-medium ${colorClass}`}>{value}</dd>
    </div>
  )
}
