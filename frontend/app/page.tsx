import { ShieldCheck, Bell, ListChecks, Bug, Crosshair, LogIn, Ghost, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { Summary, SecureScore, ComplianceStandard, Vulnerability, MitreSummaryRow, RiskSummary, OrphanReport } from '@/types/azure'
import SecureScoreGauge from '@/components/SecureScoreGauge'
import SecureScoreTrend from '@/components/SecureScoreTrend'
import ComplianceDonut from '@/components/ComplianceDonut'
import AlertsTable from '@/components/AlertsTable'
import RecommendationsTable from '@/components/RecommendationsTable'
import VulnerabilitiesTable from '@/components/VulnerabilitiesTable'
import MitreHeatmap from '@/components/MitreHeatmap'

export const dynamic = 'force-dynamic'

async function getData() {
  const [summary, scoreData, compliance, vulns, mitre, riskSummary, orphans] = await Promise.all([
    api.summary(),
    api.secureScore(),
    api.compliance(),
    api.vulnerabilities(),
    api.mitreSummary(),
    api.riskSummary(),
    api.orphans().catch(() => null),
  ])
  return { summary, scoreData, compliance, vulns, mitre, riskSummary, orphans }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  href: string
  accent: string
}) {
  return (
    <a
      href={href}
      className="group flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-[#edebe9] hover:ring-[#0078d4]/50 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#797775]">{label}</span>
        <span className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-4xl font-bold tabular-nums text-[#323130]">{value}</p>
      {sub && <p className="text-sm text-[#605e5c]">{sub}</p>}
    </a>
  )
}

export default async function DashboardPage() {
  let summary: Summary, scoreData: SecureScore, compliance: ComplianceStandard[], vulns: Vulnerability[], mitre: MitreSummaryRow[], riskSummary: RiskSummary, orphans: OrphanReport | null
  try {
    const d = await getData()
    summary = d.summary
    scoreData = d.scoreData
    compliance = d.compliance
    vulns = d.vulns
    mitre = d.mitre
    riskSummary = d.riskSummary
    orphans = d.orphans
  } catch {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="rounded-2xl bg-red-100 p-8 text-center ring-1 ring-red-200">
          <p className="text-lg font-semibold text-red-600">Backend offline</p>
          <p className="mt-1 text-sm text-[#605e5c]">Start the FastAPI server on port 8000 and refresh.</p>
          <code className="mt-3 block rounded bg-white px-4 py-2 text-sm text-[#4b4b4b]">
            uvicorn app.main:app --reload --port 8000
          </code>
        </div>
      </div>
    )
  }

  const scoreObj = scoreData.value[0]
  const scorePct = Math.round(scoreObj.properties.score.percentage * 100)
  const history = scoreData.history
  const prevScore = history.length >= 2
    ? Math.round(history[history.length - 2].percentage * 100)
    : undefined

  return (
    <div className="px-6 py-6 max-w-350 mx-auto w-full">
      {/* Summary cards */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={ShieldCheck}
          label="Secure Score"
          value={`${summary.secureScorePct}%`}
          sub={`${scoreObj.properties.score.current.toFixed(1)} / ${scoreObj.properties.score.max} pts`}
          href="/"
          accent="bg-[#eff6ff] text-[#0078d4]"
        />
        <SummaryCard
          icon={Bell}
          label="Open Alerts"
          value={summary.openAlerts.total.toLocaleString()}
          sub={`${summary.openAlerts.high} high · ${summary.openAlerts.medium} medium`}
          href="/alerts"
          accent="bg-red-100 text-red-700"
        />
        <SummaryCard
          icon={ListChecks}
          label="Unhealthy Recs"
          value={summary.unhealthyRecommendations.total.toLocaleString()}
          sub={`${summary.unhealthyRecommendations.high} high severity`}
          href="/recommendations"
          accent="bg-amber-100 text-amber-700"
        />
        <SummaryCard
          icon={Bug}
          label="Exploitable CVEs"
          value={summary.exploitableCves}
          sub={`${summary.totalResources} total resources`}
          href="/vulnerabilities"
          accent="bg-orange-100 text-orange-700"
        />
      </section>

      {/* Ghost Resources callout */}
      {orphans && orphans.total > 0 && (
        <a href="/orphans" className="group block mb-6">
          <div className="flex items-center gap-4 bg-white border border-[#edebe9] hover:border-slate-600/60 rounded-lg px-4 py-3.5 transition-colors">
            <Ghost className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-[#323130] font-medium">
                {orphans.total} ghost resources detected
              </span>
              <span className="ml-2 text-xs text-[#797775]">
                deallocated VMs, orphaned IPs, stale NSGs
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs font-semibold">
              {orphans.critical > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">{orphans.critical} critical</span>}
              {orphans.high     > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{orphans.high} high</span>}
              <ChevronRight className="w-3.5 h-3.5 text-[#a19f9d] group-hover:text-[#605e5c] transition-colors" />
            </div>
          </div>
        </a>
      )}

      {/* Charts row */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#edebe9] lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#797775]">Secure Score</h2>
          <div className="flex flex-col items-center gap-4">
            <SecureScoreGauge value={scorePct} previousValue={prevScore} />
            <div className="w-full">
              <p className="mb-2 text-xs text-[#797775] uppercase tracking-wide">12-week trend</p>
              <SecureScoreTrend history={history} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#edebe9] lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#797775]">Compliance Posture</h2>
          <ComplianceDonut standards={compliance} />
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#edebe9] pt-4">
            {[
              { label: 'Failing Controls', value: summary.complianceFailingControls, color: 'text-red-600' },
              { label: 'Standards', value: compliance.length, color: 'text-[#4b4b4b]' },
              { label: 'Resources', value: summary.totalResources, color: 'text-[#4b4b4b]' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-xs text-[#797775] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alerts table */}
      <section className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-[#edebe9]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#797775]">Recent Alerts</h2>
          <a href="/alerts" className="flex items-center gap-1 text-xs text-[#0078d4] hover:text-sky-300 transition-colors">
            View all <Bell className="h-3 w-3" />
          </a>
        </div>
        <AlertsTable limit={10} showPagination={false} defaultSort="createdDateTime" />
      </section>

      {/* MITRE ATT&CK Heatmap */}
      <section className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-[#edebe9]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#797775]">MITRE ATT&CK Coverage</h2>
          <a href="/alerts" className="flex items-center gap-1 text-xs text-[#0078d4] hover:text-sky-300 transition-colors">
            View alerts <Crosshair className="h-3 w-3" />
          </a>
        </div>
        <MitreHeatmap rows={mitre} />
      </section>

      {/* Sign-in Risk panel */}
      <section className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-[#edebe9]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#797775]">Identity Risk — Sign-ins</h2>
          <a href="/signins" className="flex items-center gap-1 text-xs text-[#0078d4] hover:text-sky-300 transition-colors">
            View all <LogIn className="h-3 w-3" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-5">
          {[
            { label: 'Total Sign-ins', value: riskSummary.total, color: 'text-[#323130]' },
            { label: 'Risky', value: riskSummary.risky, color: 'text-red-600' },
            { label: 'Failed', value: riskSummary.failed, color: 'text-amber-600' },
            { label: 'High Risk', value: riskSummary.riskByLevel['high'] ?? 0, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white p-3 text-center ring-1 ring-[#edebe9]">
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#797775] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#797775] mb-2">Top Risky IPs</p>
            <div className="space-y-1.5">
              {riskSummary.topRiskyIps.slice(0, 5).map(({ ip, count }) => (
                <div key={ip} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-[#4b4b4b] text-xs">{ip}</span>
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#797775] mb-2">Sign-ins by Country</p>
            <div className="space-y-1.5">
              {riskSummary.topCountries.slice(0, 5).map(({ country, count }) => {
                const max = riskSummary.topCountries[0].count
                return (
                  <div key={country} className="flex items-center gap-2 text-sm">
                    <span className="w-8 text-xs font-semibold text-[#605e5c]">{country}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#edebe9]">
                      <div className="h-full rounded-full bg-[#0078d4]" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-[#605e5c] tabular-nums w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Recommendations + Vulnerabilities row */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#edebe9] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#797775]">Top Recommendations</h2>
            <a href="/recommendations" className="flex items-center gap-1 text-xs text-[#0078d4] hover:text-sky-300 transition-colors">
              View all <ListChecks className="h-3 w-3" />
            </a>
          </div>
          <RecommendationsTable limit={8} showPagination={false} />
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#edebe9]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#797775]">Top CVEs by Risk</h2>
            <a href="/vulnerabilities" className="flex items-center gap-1 text-xs text-[#0078d4] hover:text-sky-300 transition-colors">
              View all <Bug className="h-3 w-3" />
            </a>
          </div>
          <VulnerabilitiesTable vulnerabilities={vulns} />
        </div>
      </section>
    </div>
  )
}
