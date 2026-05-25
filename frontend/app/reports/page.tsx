import { Printer, ShieldCheck, Bell, ListChecks, Bug, Users, Monitor, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../../lib/api'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  let summary, scoreData, compliance, vulns, riskyUserSummary, endpointSummary
  try {
    ;[summary, scoreData, compliance, vulns, riskyUserSummary, endpointSummary] = await Promise.all([
      api.summary(),
      api.secureScore(),
      api.compliance(),
      api.vulnerabilities(),
      api.riskyUserSummary(),
      api.endpointSummary(),
    ])
  } catch {
    return (
      <div className="p-8 text-[#605e5c]">Backend offline — start the FastAPI server on port 8000.</div>
    )
  }

  const score = scoreData.value[0]
  const pct = Math.round(score.properties.score.percentage * 100)
  const history = scoreData.history
  const prevPct = history.length >= 2 ? Math.round(history[history.length - 2].percentage * 100) : null
  const delta = prevPct != null ? pct - prevPct : null

  const exploitableVulns = vulns.filter(v => v.exploitInKit || v.exploitTypes?.length)
  const criticalVulns = vulns.filter(v => v.cvssV3 >= 9.0)

  const overallPassPct = compliance.length > 0
    ? Math.round(
        compliance.reduce((sum, s) => {
          const p = s.properties
          const total = p.passedControls + p.failedControls + p.skippedControls
          return sum + (total > 0 ? p.passedControls / total : 0)
        }, 0) / compliance.length * 100
      )
    : 0

  const now = new Date()
  const generatedAt = now.toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-[#323130]">Executive Security Report</h1>
          <p className="text-sm text-[#605e5c] mt-0.5">Point-in-time summary · {generatedAt}</p>
        </div>
        <PrintButton />
      </div>

      {/* ── Print header — only visible on print ── */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-black">Azure Security Posture — Executive Report</h1>
        <p className="text-sm text-gray-500 mt-1">Generated {generatedAt}</p>
        <hr className="mt-4 border-gray-300" />
      </div>

      {/* ── Section 1: Secure Score ── */}
      <ReportSection title="Secure Score" icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}>
        <div className="grid grid-cols-3 gap-4">
          <BigStat
            label="Current Score"
            value={`${pct}%`}
            color={pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}
          />
          <BigStat
            label="Week-over-Week"
            value={delta != null ? `${delta >= 0 ? '+' : ''}${delta}%` : '—'}
            color={delta == null ? 'text-[#605e5c]' : delta >= 0 ? 'text-emerald-600' : 'text-red-600'}
            icon={delta != null ? (delta >= 0
              ? <TrendingUp className="w-4 h-4" />
              : <TrendingDown className="w-4 h-4" />) : undefined}
          />
          <BigStat
            label="Points Earned"
            value={`${score.properties.score.current.toFixed(0)} / ${score.properties.score.max}`}
          />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-[#797775] mb-1">
            <span>Score</span><span>{pct}%</span>
          </div>
          <div className="h-3 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 relative">
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow ring-2 ring-slate-900 print:ring-gray-400"
              style={{ left: `calc(${Math.min(pct, 99)}% - 7px)` }} />
          </div>
          <div className="flex justify-between text-[10px] text-[#797775] mt-1">
            <span>0% Poor</span><span>40% Moderate</span><span>70% Good</span><span>100%</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-[#4b4b4b] leading-relaxed">
          {pct >= 70
            ? `The tenant's security posture is in good standing at ${pct}%. Continue monitoring and addressing new recommendations as they arise.`
            : pct >= 40
            ? `The tenant's score of ${pct}% is in the moderate range. ${delta != null && delta < 0 ? 'It declined this week, indicating new unaddressed findings.' : 'Focus on high-impact recommendations to reach the 70% threshold.'}`
            : `The tenant's score of ${pct}% is below the acceptable threshold. Immediate action is required to address critical recommendations and improve posture.`}
        </p>
      </ReportSection>

      {/* ── Section 2: Alerts ── */}
      <ReportSection title="Active Alerts" icon={<Bell className="w-4 h-4 text-red-600" />}>
        <div className="grid grid-cols-3 gap-4">
          <BigStat label="Total Open" value={summary.openAlerts.total} color="text-red-600" />
          <BigStat label="High Severity" value={summary.openAlerts.high} color="text-red-600" />
          <BigStat label="Medium Severity" value={summary.openAlerts.medium} color="text-amber-600" />
        </div>
        <p className="mt-4 text-sm text-[#4b4b4b] leading-relaxed">
          {summary.openAlerts.total === 0
            ? 'No open alerts detected. Posture is clean.'
            : `There are ${summary.openAlerts.total} open security alerts. ${summary.openAlerts.high > 0 ? `${summary.openAlerts.high} high-severity alerts require immediate triage.` : 'Focus on high-severity items first.'}`}
        </p>
      </ReportSection>

      {/* ── Section 3: Recommendations ── */}
      <ReportSection title="Recommendations" icon={<ListChecks className="w-4 h-4 text-amber-600" />}>
        <div className="grid grid-cols-3 gap-4">
          <BigStat label="Unhealthy" value={summary.unhealthyRecommendations.total} color="text-amber-600" />
          <BigStat label="High Severity" value={summary.unhealthyRecommendations.high} color="text-red-600" />
          <BigStat label="Medium Severity" value={summary.unhealthyRecommendations.medium} color="text-amber-600" />
        </div>
        <p className="mt-4 text-sm text-[#4b4b4b] leading-relaxed">
          {summary.unhealthyRecommendations.total} recommendations remain open.
          {summary.unhealthyRecommendations.high > 0
            ? ` Prioritise the ${summary.unhealthyRecommendations.high} high-severity items as they have the largest impact on the Secure Score.`
            : ' No high-severity items — continue working through medium and low severity findings.'}
        </p>
      </ReportSection>

      {/* ── Section 4: Vulnerabilities ── */}
      <ReportSection title="Vulnerabilities" icon={<Bug className="w-4 h-4 text-orange-600" />}>
        <div className="grid grid-cols-3 gap-4">
          <BigStat label="Total CVEs" value={vulns.length} />
          <BigStat label="Exploitable" value={exploitableVulns.length} color={exploitableVulns.length > 0 ? 'text-red-600' : 'text-emerald-600'} />
          <BigStat label="Critical (CVSS ≥9)" value={criticalVulns.length} color={criticalVulns.length > 0 ? 'text-red-600' : 'text-emerald-600'} />
        </div>
        {exploitableVulns.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#797775] mb-2">Top Exploitable CVEs</p>
            {exploitableVulns.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center justify-between text-sm bg-white/60 rounded px-3 py-2">
                <span className="font-mono text-red-600 text-[12px]">{v.id}</span>
                <span className="text-[#605e5c] text-xs">CVSS {v.cvssV3}</span>
              </div>
            ))}
          </div>
        )}
      </ReportSection>

      {/* ── Section 5: Compliance ── */}
      <ReportSection title="Compliance Posture" icon={<ShieldCheck className="w-4 h-4 text-blue-600" />}>
        <div className="grid grid-cols-1 gap-3">
          {compliance.map(s => {
            const p = s.properties
            const total = p.passedControls + p.failedControls + p.skippedControls
            const passPct = total > 0 ? Math.round((p.passedControls / total) * 100) : 0
            return (
              <div key={s.id} className="flex items-center gap-4">
                <span className="text-sm text-[#4b4b4b] w-40 shrink-0 truncate">{s.name}</span>
                <div className="flex-1 h-2 rounded-full bg-[#edebe9] overflow-hidden">
                  <div className={`h-full rounded-full ${passPct >= 70 ? 'bg-emerald-500' : passPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${passPct}%` }} />
                </div>
                <span className={`text-sm font-semibold tabular-nums w-12 text-right shrink-0 ${passPct >= 70 ? 'text-emerald-600' : passPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {passPct}%
                </span>
                <span className="text-xs text-[#797775] w-28 shrink-0 text-right">
                  {p.passedControls}/{total} passed
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-sm text-[#4b4b4b]">
          Average compliance pass rate across {compliance.length} standards: <strong className="text-white">{overallPassPct}%</strong>.
          {overallPassPct < 60 ? ' Significant gaps remain — prioritise failed controls tied to high-impact frameworks.' : ''}
        </p>
      </ReportSection>

      {/* ── Section 6: Identity & Endpoints ── */}
      <ReportSection title="Identity & Endpoints" icon={<Users className="w-4 h-4 text-purple-600" />}>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#797775] mb-3">Risky Users</p>
            <div className="grid grid-cols-2 gap-3">
              <BigStat label="At Risk" value={riskyUserSummary.atRisk} color="text-amber-600" small />
              <BigStat label="Compromised" value={riskyUserSummary.confirmedCompromised} color="text-red-600" small />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#797775] mb-3">Endpoints (MDE)</p>
            <div className="grid grid-cols-2 gap-3">
              <BigStat label="High / Critical" value={endpointSummary.highRisk} color="text-red-600" small />
              <BigStat label="Total CVEs" value={endpointSummary.totalVulnerabilities} color="text-amber-600" small />
            </div>
          </div>
        </div>
      </ReportSection>

      {/* ── Footer ── */}
      <div className="mt-8 pt-4 border-t border-[#edebe9] print:border-gray-200 flex items-center justify-between text-xs text-[#a19f9d]">
        <span>Azure Security Posture Dashboard</span>
        <span>Generated {generatedAt}</span>
      </div>
    </div>
  )
}

function ReportSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6 bg-white print:bg-white border border-[#edebe9] print:border-gray-200 rounded-xl p-6 break-inside-avoid">
      <div className="flex items-center gap-2 mb-5">
        <span className="print:hidden">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#605e5c] print:text-gray-600">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function BigStat({ label, value, color, icon, small }: {
  label: string; value: string | number; color?: string; icon?: React.ReactNode; small?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-[#797775] print:text-gray-500 mb-1">{label}</p>
      <p className={`font-bold tabular-nums flex items-center gap-1.5 ${small ? 'text-xl' : 'text-3xl'} ${color ?? 'text-white print:text-black'}`}>
        {icon}{value}
      </p>
    </div>
  )
}
