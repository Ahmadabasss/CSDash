import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, AlertTriangle, ShieldAlert, Clock, Activity } from 'lucide-react'
import { api } from '../../../lib/api'

export const dynamic = 'force-dynamic'

const RISK_LEVEL: Record<string, string> = {
  high:   'bg-red-900/50 text-red-300 ring-red-700/50',
  medium: 'bg-amber-900/40 text-amber-300 ring-amber-700/40',
  low:    'bg-blue-900/30 text-blue-300 ring-blue-700/30',
  none:   'bg-slate-700 text-slate-400 ring-slate-600/40',
}

const RISK_STATE: Record<string, string> = {
  atRisk:               'bg-red-900/40 text-red-300',
  confirmedCompromised: 'bg-red-900 text-red-200',
  remediated:           'bg-emerald-900/40 text-emerald-300',
  dismissed:            'bg-slate-700 text-slate-400',
}

const RISK_DETAIL_LABEL: Record<string, string> = {
  userPerformedSecuredPasswordChange: 'User performed secured password change',
  userPerformedSecuredPasswordReset:  'User performed secured password reset',
  adminConfirmedSigninCompromised:    'Admin confirmed sign-in compromised',
  adminDismissedAllRiskForUser:       'Admin dismissed all risk for user',
  adminConfirmedUserCompromised:      'Admin confirmed user compromised',
  hidden: 'Hidden', none: 'None', unknownFutureValue: 'Unknown',
}

export default async function RiskyUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let user
  try {
    user = await api.riskyUser(decodeURIComponent(id))
  } catch {
    notFound()
  }

  const riskPct = user.signInCount > 0
    ? Math.round((user.riskySignInCount / user.signInCount) * 100)
    : 0

  return (
    <div className="px-6 py-6 max-w-4xl">
      <Link href="/risky-users"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Risky Users
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-slate-800 ring-1 ring-slate-700 flex items-center justify-center shrink-0">
          <User className="w-7 h-7 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white">{user.userDisplayName}</h1>
          <p className="text-sm font-mono text-slate-400 mt-0.5">{user.userPrincipalName}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ring-1 capitalize ${RISK_LEVEL[user.riskLevel] ?? RISK_LEVEL.none}`}>
              {user.riskLevel} risk
            </span>
            <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full capitalize ${RISK_STATE[user.riskState] ?? 'bg-slate-700 text-slate-400'}`}>
              {user.riskState.replace(/([A-Z])/g, ' $1').trim()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Sign-in risk overview */}
          <Section title="Sign-in Risk Overview" icon={<Activity className="w-4 h-4 text-amber-400" />}>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Stat label="Total Sign-ins" value={user.signInCount} />
              <Stat label="Risky Sign-ins" value={user.riskySignInCount} color="text-amber-400" />
              <Stat label="Risk Rate" value={`${riskPct}%`}
                color={riskPct > 20 ? 'text-red-400' : riskPct > 5 ? 'text-amber-400' : 'text-emerald-400'} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Risky vs safe sign-ins</span>
                <span>{user.riskySignInCount} / {user.signInCount}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${Math.min(riskPct, 100)}%` }} />
              </div>
            </div>
          </Section>

          {/* Risk detection detail */}
          <Section title="Risk Detection Detail" icon={<ShieldAlert className="w-4 h-4 text-red-400" />}>
            <div className="space-y-3 mb-4">
              <DetailRow label="Risk Detail" value={RISK_DETAIL_LABEL[user.riskDetail] ?? user.riskDetail} />
              <DetailRow label="Risk State" value={user.riskState.replace(/([A-Z])/g, ' $1').trim()} />
              <DetailRow label="Risk Level" value={user.riskLevel} />
              <DetailRow label="Last Updated" value={new Date(user.riskLastUpdatedDateTime).toLocaleString()} />
            </div>
            <div className="rounded-lg bg-slate-900/60 px-4 py-3 text-sm text-slate-400 leading-relaxed">
              {user.riskState === 'confirmedCompromised'
                ? 'This account has been confirmed compromised. Disable immediately, force credential reset, and audit all recent activity for lateral movement signs.'
                : user.riskState === 'atRisk'
                ? 'Entra ID has detected risk signals. Review recent sign-ins and consider enforcing MFA or a password reset.'
                : user.riskState === 'remediated'
                ? 'Risk remediated via secure password change. Continue monitoring for recurrence.'
                : 'Risk dismissed by an administrator. No immediate action required.'}
            </div>
          </Section>

          {/* Recommended actions */}
          <Section title="Recommended Actions" icon={<AlertTriangle className="w-4 h-4 text-[#0078d4]" />}>
            <ul className="space-y-2">
              {(user.riskLevel === 'high' || user.riskState === 'confirmedCompromised') ? (
                <>
                  <ActionItem>Disable account immediately and notify the security team</ActionItem>
                  <ActionItem>Force password reset with MFA verification</ActionItem>
                  <ActionItem>Audit all sign-ins and device registrations from the past 30 days</ActionItem>
                  <ActionItem>Review mailbox forwarding rules and OAuth app grants</ActionItem>
                  <ActionItem>Revoke all refresh tokens and active sessions</ActionItem>
                </>
              ) : user.riskLevel === 'medium' ? (
                <>
                  <ActionItem>Enforce MFA on next sign-in</ActionItem>
                  <ActionItem>Review recent sign-in locations and devices</ActionItem>
                  <ActionItem>Verify no suspicious mailbox rules are active</ActionItem>
                </>
              ) : (
                <>
                  <ActionItem>Monitor for additional risk signals</ActionItem>
                  <ActionItem>Confirm MFA is enrolled and enforced</ActionItem>
                </>
              )}
            </ul>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Identity" icon={<User className="w-4 h-4 text-slate-400" />}>
            <dl className="space-y-3">
              <DetailRow label="Display Name" value={user.userDisplayName} />
              <DetailRow label="UPN" value={user.userPrincipalName} mono />
              {user.department && <DetailRow label="Department" value={user.department} />}
              {user.jobTitle && <DetailRow label="Job Title" value={user.jobTitle} />}
            </dl>
          </Section>

          <Section title="Timeline" icon={<Clock className="w-4 h-4 text-slate-400" />}>
            <div>
              <p className="text-xs text-slate-500">Risk Last Updated</p>
              <p className="text-sm text-slate-300 mt-0.5">
                {new Date(user.riskLastUpdatedDateTime).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(user.riskLastUpdatedDateTime).toLocaleTimeString()}
              </p>
            </div>
          </Section>

          <div className="rounded-lg bg-[#0078d4]/10 border border-[#0078d4]/30 p-4">
            <p className="text-xs font-semibold text-white mb-1">Investigate Sign-ins</p>
            <p className="text-xs text-slate-400 mb-3">View auth logs for this user in the sign-ins page.</p>
            <Link href="/signins"
              className="text-xs text-[#60a5fa] hover:text-white transition-colors font-medium">
              Open Sign-ins →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1e293b] border border-white/6 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">{icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-sm mt-0.5 break-all text-slate-300 ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </div>
  )
}

function ActionItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-300">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0078d4] shrink-0" />
      {children}
    </li>
  )
}
