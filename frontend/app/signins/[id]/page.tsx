import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, MapPin, Monitor, Globe, Clock, CheckCircle, XCircle, ShieldAlert } from 'lucide-react'
import { api } from '../../../lib/api'

export const dynamic = 'force-dynamic'

const RISK_STYLE: Record<string, string> = {
  high: 'bg-red-900/60 text-red-200 ring-1 ring-red-700',
  medium: 'bg-amber-900/40 text-amber-300 ring-1 ring-amber-800',
  low: 'bg-blue-900/40 text-blue-300 ring-1 ring-blue-800',
  none: 'bg-slate-700 text-slate-400',
  hidden: 'bg-slate-700 text-slate-500',
}

const RISK_STATE_STYLE: Record<string, string> = {
  atRisk: 'bg-red-900/40 text-red-300',
  confirmedCompromised: 'bg-red-900 text-red-100',
  remediated: 'bg-emerald-900/40 text-emerald-300',
  dismissed: 'bg-slate-700 text-slate-400',
  none: 'bg-slate-700 text-slate-400',
}

export default async function SignInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let signin
  try {
    signin = await api.signin(decodeURIComponent(id))
  } catch {
    notFound()
  }

  const success = signin.status.errorCode === 0
  const riskKey = signin.riskLevelAggregated?.toLowerCase() ?? 'none'
  const riskStateKey = signin.riskState ?? 'none'

  return (
    <div className="px-6 py-6 max-w-4xl">
      <Link href="/signins" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Sign-ins
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#1e293b] border border-white/6 flex items-center justify-center shrink-0">
          <LogIn className="w-5 h-5 text-[#0078d4]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">{signin.userDisplayName}</h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">{signin.userPrincipalName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded ${success ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
            {success ? 'Success' : 'Failed'}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded capitalize ${RISK_STYLE[riskKey] ?? 'bg-slate-700 text-slate-400'}`}>
            {signin.riskLevelAggregated} Risk
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Authentication result */}
          <Section title="Authentication Result">
            <div className="flex items-start gap-3">
              {success
                ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-semibold ${success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {success ? 'Sign-in successful' : 'Sign-in failed'}
                </p>
                {!success && (
                  <p className="text-sm text-slate-400 mt-1">{signin.status.failureReason || 'Authentication failure'}</p>
                )}
                {!success && signin.status.errorCode !== 0 && (
                  <p className="text-xs text-slate-600 mt-0.5 font-mono">Error code: {signin.status.errorCode}</p>
                )}
              </div>
            </div>
          </Section>

          {/* App & client */}
          <Section title="Application & Client">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <MetaRow label="Application" value={signin.appDisplayName} />
              <MetaRow label="Client App" value={signin.clientAppUsed} />
            </dl>
          </Section>

          {/* Risk */}
          {riskKey !== 'none' && (
            <Section title="Risk Signals">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Risk Level</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${RISK_STYLE[riskKey] ?? 'bg-slate-700 text-slate-400'}`}>
                      {signin.riskLevelAggregated}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Risk State</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${RISK_STATE_STYLE[riskStateKey] ?? 'bg-slate-700 text-slate-400'}`}>
                      {signin.riskState}
                    </span>
                  </div>
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Network */}
          <Section title="Network">
            <dl className="space-y-2.5">
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> IP Address
                </dt>
                <dd className="text-xs text-slate-200 font-mono mt-0.5">{signin.ipAddress}</dd>
              </div>
            </dl>
          </Section>

          {/* Location */}
          <Section title="Location">
            <dl className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <div>
                  {signin.location.city && (
                    <p className="text-xs text-slate-200">{signin.location.city}{signin.location.state ? `, ${signin.location.state}` : ''}</p>
                  )}
                  <p className="text-xs text-slate-400">{signin.location.countryOrRegion}</p>
                </div>
              </div>
            </dl>
          </Section>

          {/* Device */}
          <Section title="Device & Client">
            <dl className="space-y-2.5">
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1">
                  <Monitor className="w-3 h-3" /> Client App Used
                </dt>
                <dd className="text-xs text-slate-300 mt-0.5">{signin.clientAppUsed}</dd>
              </div>
            </dl>
          </Section>

          {/* Timestamp */}
          <Section title="Timestamp">
            <div>
              <dt className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Sign-in Time
              </dt>
              <dd className="text-xs text-slate-300 mt-0.5">
                {new Date(signin.createdDateTime).toLocaleString()}
              </dd>
              <dd className="text-[11px] text-slate-500 mt-0.5 font-mono">{signin.id}</dd>
            </div>
          </Section>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-xs text-slate-300 mt-0.5">{value}</dd>
    </div>
  )
}
