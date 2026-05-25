import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, AlertTriangle, ShieldAlert, Clock, Activity } from 'lucide-react'
import { api } from '../../../lib/api'

export const dynamic = 'force-dynamic'

const RISK_LEVEL: Record<string, string> = {
  high:   'bg-red-100 text-red-700 ring-red-700/50',
  medium: 'bg-amber-100 text-amber-700 ring-amber-700/40',
  low:    'bg-blue-100 text-blue-700 ring-blue-700/30',
  none:   'bg-[#edebe9] text-[#605e5c] ring-[#edebe9]',
}

const RISK_STATE: Record<string, string> = {
  atRisk:               'bg-red-100 text-red-700',
  confirmedCompromised: 'bg-red-100 text-red-700',
  remediated:           'bg-emerald-100 text-emerald-700',
  dismissed:            'bg-[#edebe9] text-[#605e5c]',
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
        className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Risky Users
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-[#f3f2f1] ring-1 ring-[#edebe9] flex items-center justify-center shrink-0">
          <User className="w-7 h-7 text-[#605e5c]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#323130]">{user.userDisplayName}</h1>
          <p className="text-sm font-mono text-[#605e5c] mt-0.5">{user.userPrincipalName}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ring-1 capitalize ${RISK_LEVEL[user.riskLevel] ?? RISK_LEVEL.none}`}>
              {user.riskLevel} risk
            </span>
            <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full capitalize ${RISK_STATE[user.riskState] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
              {user.riskState.replace(/([A-Z])/g, ' $1').trim()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Sign-in risk overview */}
          <Section title="Sign-in Risk Overview" icon={<Activity className="w-4 h-4 text-amber-600" />}>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Stat label="Total Sign-ins" value={user.signInCount} />
              <Stat label="Risky Sign-ins" value={user.riskySignInCount} color="text-amber-600" />
              <Stat label="Risk Rate" value={`${riskPct}%`}
                color={riskPct > 20 ? 'text-red-600' : riskPct > 5 ? 'text-amber-600' : 'text-emerald-600'} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-[#797775] mb-1">
                <span>Risky vs safe sign-ins</span>
                <span>{user.riskySignInCount} / {user.signInCount}</span>
              </div>
              <div className="h-2 rounded-full bg-[#edebe9] overflow-hidden">
                <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${Math.min(riskPct, 100)}%` }} />
              </div>
            </div>
          </Section>

          {/* Risk detection detail */}
          <Section title="Risk Detection Detail" icon={<ShieldAlert className="w-4 h-4 text-red-600" />}>
            <div className="space-y-3 mb-4">
              <DetailRow label="Risk Detail" value={RISK_DETAIL_LABEL[user.riskDetail] ?? user.riskDetail} />
              <DetailRow label="Risk State" value={user.riskState.replace(/([A-Z])/g, ' $1').trim()} />
              <DetailRow label="Risk Level" value={user.riskLevel} />
              <DetailRow label="Last Updated" value={new Date(user.riskLastUpdatedDateTime).toLocaleString()} />
            </div>
            <div className="rounded-lg bg-white/60 px-4 py-3 text-sm text-[#605e5c] leading-relaxed">
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
          <Section title="Identity" icon={<User className="w-4 h-4 text-[#605e5c]" />}>
            <dl className="space-y-3">
              <DetailRow label="Display Name" value={user.userDisplayName} />
              <DetailRow label="UPN" value={user.userPrincipalName} mono />
              {user.department && <DetailRow label="Department" value={user.department} />}
              {user.jobTitle && <DetailRow label="Job Title" value={user.jobTitle} />}
            </dl>
          </Section>

          <Section title="Timeline" icon={<Clock className="w-4 h-4 text-[#605e5c]" />}>
            <div>
              <p className="text-xs text-[#797775]">Risk Last Updated</p>
              <p className="text-sm text-[#4b4b4b] mt-0.5">
                {new Date(user.riskLastUpdatedDateTime).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </p>
              <p className="text-xs text-[#797775] mt-0.5">
                {new Date(user.riskLastUpdatedDateTime).toLocaleTimeString()}
              </p>
            </div>
          </Section>

          <div className="rounded-lg bg-[#0078d4]/10 border border-[#0078d4]/30 p-4">
            <p className="text-xs font-semibold text-[#323130] mb-1">Investigate Sign-ins</p>
            <p className="text-xs text-[#605e5c] mb-3">View auth logs for this user in the sign-ins page.</p>
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
    <div className="bg-white border border-[#edebe9] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">{icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#797775]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-[#797775] mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color ?? 'text-[#323130]'}`}>{value}</p>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-[#797775]">{label}</dt>
      <dd className={`text-sm mt-0.5 break-all text-[#4b4b4b] ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </div>
  )
}

function ActionItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#4b4b4b]">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0078d4] shrink-0" />
      {children}
    </li>
  )
}
