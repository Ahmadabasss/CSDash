import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Monitor, Shield, Wifi, AlertTriangle, Clock, Tag, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../../../lib/api'

export const dynamic = 'force-dynamic'

const RISK_COLOR: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 ring-red-700/50',
  High:     'bg-red-100 text-red-700 ring-red-700/40',
  Medium:   'bg-amber-100 text-amber-700 ring-amber-700/40',
  Low:      'bg-blue-100 text-blue-700 ring-blue-700/30',
  None:     'bg-[#edebe9] text-[#605e5c] ring-[#edebe9]',
}

const HEALTH_COLOR: Record<string, string> = {
  Active:        'text-emerald-600',
  Inactive:      'text-red-600',
  Misconfigured: 'text-amber-600',
}

export default async function EndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let device
  try {
    device = await api.endpoint(decodeURIComponent(id))
  } catch {
    notFound()
  }

  const isHighRisk = device.riskScore === 'Critical' || device.riskScore === 'High'
  const d = device as typeof device & { lastIpAddress?: string; firstSeen?: string }

  return (
    <div className="px-6 py-6 max-w-4xl">
      <Link href="/endpoints"
        className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Endpoints
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-[#f3f2f1] ring-1 ring-[#edebe9] flex items-center justify-center shrink-0">
          <Monitor className="w-7 h-7 text-[#605e5c]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#323130] font-mono">{device.computerDnsName}</h1>
          <p className="text-sm text-[#605e5c] mt-0.5">{device.osPlatform} · {device.osVersion}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${RISK_COLOR[device.riskScore] ?? RISK_COLOR.None}`}>
              {device.riskScore} risk
            </span>
            <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-[#f3f2f1] ring-1 ring-[#edebe9] ${HEALTH_COLOR[device.healthStatus] ?? 'text-[#605e5c]'}`}>
              {device.healthStatus}
            </span>
            <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${device.onboardingStatus === 'Onboarded' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {device.onboardingStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* Security posture */}
          <Section title="Security Posture" icon={<Shield className="w-4 h-4 text-red-600" />}>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Stat label="Vulnerabilities" value={device.vulnerabilitiesCount}
                color={device.vulnerabilitiesCount > 20 ? 'text-red-600' : device.vulnerabilitiesCount > 5 ? 'text-amber-600' : 'text-emerald-600'} />
              <Stat label="Missing Critical Patches" value={device.missingCriticalPatches}
                color={device.missingCriticalPatches > 5 ? 'text-red-600' : device.missingCriticalPatches > 0 ? 'text-amber-600' : 'text-emerald-600'} />
            </div>
            <div className="space-y-3">
              <CheckRow label="Antivirus" value={device.antivirusStatus} ok={device.antivirusStatus === 'Updated'} />
              <CheckRow label="Firewall" value={device.firewallEnabled ? 'Enabled' : 'Disabled'} ok={device.firewallEnabled} />
              <CheckRow label="AAD Joined" value={device.isAadJoined ? 'Yes' : 'No'} ok={device.isAadJoined} />
              <CheckRow label="MDE Onboarding" value={device.onboardingStatus} ok={device.onboardingStatus === 'Onboarded'} />
            </div>
            {device.vulnerabilitiesCount > 0 && (
              <div className="mt-5">
                <div className="flex justify-between text-[11px] text-[#797775] mb-1">
                  <span>Vulnerability exposure</span>
                  <span>{device.vulnerabilitiesCount} CVEs · {device.missingCriticalPatches} critical patches missing</span>
                </div>
                <div className="h-2 rounded-full bg-[#edebe9] overflow-hidden">
                  <div className="h-full rounded-full bg-red-500/70"
                    style={{ width: `${Math.min((device.vulnerabilitiesCount / 50) * 100, 100)}%` }} />
                </div>
              </div>
            )}
          </Section>

          {/* Recommended actions */}
          {isHighRisk && (
            <Section title="Recommended Actions" icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}>
              <ul className="space-y-2">
                {device.missingCriticalPatches > 0 && (
                  <ActionItem>Apply {device.missingCriticalPatches} missing critical patch{device.missingCriticalPatches !== 1 ? 'es' : ''} immediately</ActionItem>
                )}
                {!device.firewallEnabled && <ActionItem>Enable the host-based firewall</ActionItem>}
                {device.antivirusStatus !== 'Updated' && <ActionItem>Update antivirus definitions</ActionItem>}
                {!device.isAadJoined && <ActionItem>Join device to Azure AD for conditional access enforcement</ActionItem>}
                {device.vulnerabilitiesCount > 10 && <ActionItem>Run vulnerability remediation — {device.vulnerabilitiesCount} CVEs detected</ActionItem>}
                <ActionItem>Review device in Microsoft Defender portal for full investigation</ActionItem>
              </ul>
            </Section>
          )}

          {/* Tags */}
          {device.machineTags?.length > 0 && (
            <Section title="Device Tags" icon={<Tag className="w-4 h-4 text-[#605e5c]" />}>
              <div className="flex flex-wrap gap-2">
                {device.machineTags.map(tag => (
                  <span key={tag} className="text-xs bg-[#edebe9] text-[#4b4b4b] px-2.5 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Device Info" icon={<Monitor className="w-4 h-4 text-[#605e5c]" />}>
            <dl className="space-y-3">
              <DetailRow label="DNS Name" value={device.computerDnsName} mono />
              <DetailRow label="OS Platform" value={device.osPlatform} />
              <DetailRow label="OS Version" value={device.osVersion} />
              <DetailRow label="Exposure Level" value={device.exposureLevel} />
              <DetailRow label="RBAC Group" value={device.rbacGroupName} />
            </dl>
          </Section>

          <Section title="Network" icon={<Wifi className="w-4 h-4 text-[#605e5c]" />}>
            <dl className="space-y-3">
              {d.lastIpAddress && <DetailRow label="Last IP" value={d.lastIpAddress} mono />}
              <DetailRow label="AAD Joined" value={device.isAadJoined ? 'Yes' : 'No'} />
            </dl>
          </Section>

          <Section title="Timeline" icon={<Clock className="w-4 h-4 text-[#605e5c]" />}>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#797775]">Last Seen</p>
                <p className="text-sm text-[#4b4b4b] mt-0.5">{new Date(device.lastSeen).toLocaleString()}</p>
              </div>
              {d.firstSeen && (
                <div>
                  <p className="text-xs text-[#797775]">First Seen</p>
                  <p className="text-sm text-[#4b4b4b] mt-0.5">{new Date(d.firstSeen).toLocaleString()}</p>
                </div>
              )}
            </div>
          </Section>
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

function CheckRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#605e5c]">{label}</span>
      <span className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
        {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {value}
      </span>
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
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
      {children}
    </li>
  )
}
