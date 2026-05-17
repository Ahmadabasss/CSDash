import { ShieldCheck, Bell, ListChecks, Bug, Server } from 'lucide-react'
import { api } from '@/lib/api'
import type { Summary, SecureScore, ComplianceStandard, Vulnerability } from '@/types/azure'
import SecureScoreGauge from '@/components/SecureScoreGauge'
import SecureScoreTrend from '@/components/SecureScoreTrend'
import ComplianceDonut from '@/components/ComplianceDonut'
import AlertsTable from '@/components/AlertsTable'
import RecommendationsTable from '@/components/RecommendationsTable'
import VulnerabilitiesTable from '@/components/VulnerabilitiesTable'
import ScenarioSwitcher from '@/components/ScenarioSwitcher'

export const dynamic = 'force-dynamic'

async function getData() {
  const [summary, scoreData, compliance, vulns] = await Promise.all([
    api.summary(),
    api.secureScore(),
    api.compliance(),
    api.vulnerabilities(),
  ])
  return { summary, scoreData, compliance, vulns }
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
      className="group flex flex-col gap-3 rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60 hover:ring-sky-700/60 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-4xl font-bold tabular-nums text-slate-100">{value}</p>
      {sub && <p className="text-sm text-slate-400">{sub}</p>}
    </a>
  )
}

export default async function DashboardPage() {
  let summary: Summary, scoreData: SecureScore, compliance: ComplianceStandard[], vulns: Vulnerability[]
  try {
    const d = await getData()
    summary = d.summary
    scoreData = d.scoreData
    compliance = d.compliance
    vulns = d.vulns
  } catch {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl bg-red-950/40 p-8 text-center ring-1 ring-red-900/60">
          <p className="text-lg font-semibold text-red-400">Backend offline</p>
          <p className="mt-1 text-sm text-slate-400">Start the FastAPI server on port 8000 and refresh.</p>
          <code className="mt-3 block rounded bg-slate-900 px-4 py-2 text-sm text-slate-300">
            uvicorn app.main:app --reload --port 8000
          </code>
        </div>
      </main>
    )
  }

  const scoreObj = scoreData.value[0]
  const scorePct = Math.round(scoreObj.properties.score.percentage * 100)
  const history = scoreData.history
  const prevScore = history.length >= 2
    ? Math.round(history[history.length - 2].percentage * 100)
    : undefined

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-sky-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Security Posture Dashboard</h1>
            <p className="text-sm text-slate-400">Microsoft Defender for Cloud · Graph Security · Azure Resource Graph</p>
          </div>
        </div>
        <ScenarioSwitcher />
      </header>

      {/* Nav */}
      <nav className="mb-8 flex gap-1 rounded-xl bg-slate-800/40 p-1 ring-1 ring-slate-700/60 w-fit">
        {[
          ['Overview', '/'],
          ['Alerts', '/alerts'],
          ['Recommendations', '/recommendations'],
          ['Vulnerabilities', '/vulnerabilities'],
          ['Resources', '/resources'],
          ['Compliance', '/compliance'],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors first:bg-slate-700 first:text-slate-100"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Summary cards */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={ShieldCheck}
          label="Secure Score"
          value={`${summary.secureScorePct}%`}
          sub={`${scoreObj.properties.score.current.toFixed(1)} / ${scoreObj.properties.score.max} pts`}
          href="/"
          accent="bg-sky-900/40 text-sky-400"
        />
        <SummaryCard
          icon={Bell}
          label="Open Alerts"
          value={summary.openAlerts.total.toLocaleString()}
          sub={`${summary.openAlerts.high} high · ${summary.openAlerts.medium} medium`}
          href="/alerts"
          accent="bg-red-900/40 text-red-400"
        />
        <SummaryCard
          icon={ListChecks}
          label="Unhealthy Recs"
          value={summary.unhealthyRecommendations.total.toLocaleString()}
          sub={`${summary.unhealthyRecommendations.high} high severity`}
          href="/recommendations"
          accent="bg-amber-900/40 text-amber-400"
        />
        <SummaryCard
          icon={Bug}
          label="Exploitable CVEs"
          value={summary.exploitableCves}
          sub={`${summary.totalResources} total resources`}
          href="/vulnerabilities"
          accent="bg-orange-900/40 text-orange-400"
        />
      </section>

      {/* Charts row */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Secure Score</h2>
          <div className="flex flex-col items-center gap-4">
            <SecureScoreGauge value={scorePct} previousValue={prevScore} />
            <div className="w-full">
              <p className="mb-2 text-xs text-slate-500 uppercase tracking-wide">12-week trend</p>
              <SecureScoreTrend history={history} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Compliance Posture</h2>
          <ComplianceDonut standards={compliance} />
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-700/60 pt-4">
            {[
              { label: 'Failing Controls', value: summary.complianceFailingControls, color: 'text-red-400' },
              { label: 'Standards', value: compliance.length, color: 'text-slate-300' },
              { label: 'Resources', value: summary.totalResources, color: 'text-slate-300' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alerts table */}
      <section className="mb-6 rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Recent Alerts</h2>
          <a href="/alerts" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
            View all <Bell className="h-3 w-3" />
          </a>
        </div>
        <AlertsTable limit={10} showPagination={false} defaultSort="createdDateTime" />
      </section>

      {/* Recommendations + Vulnerabilities row */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Top Recommendations</h2>
            <a href="/recommendations" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
              View all <ListChecks className="h-3 w-3" />
            </a>
          </div>
          <RecommendationsTable limit={8} showPagination={false} />
        </div>

        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Top CVEs by Risk</h2>
            <a href="/vulnerabilities" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
              View all <Bug className="h-3 w-3" />
            </a>
          </div>
          <VulnerabilitiesTable vulnerabilities={vulns} />
        </div>
      </section>
    </main>
  )
}
