import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Server, CheckCircle, XCircle, MapPin, HardDrive, Cpu, Clock } from 'lucide-react'
import { api } from '../../../lib/api'

export const dynamic = 'force-dynamic'

const POWER_STYLE: Record<string, string> = {
  running: 'bg-emerald-100 text-emerald-700',
  deallocated: 'bg-[#edebe9] text-[#605e5c]',
  stopped: 'bg-red-100 text-red-700',
  starting: 'bg-blue-100 text-blue-700',
  stopping: 'bg-amber-100 text-amber-700',
}

const PATCH_STYLE: Record<string, string> = {
  up_to_date: 'text-emerald-600',
  pending: 'text-amber-600',
  missing: 'text-red-600',
  unknown: 'text-[#605e5c]',
}

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

export default async function VMDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  let vm
  try {
    vm = await api.virtualMachine(decodedName)
  } catch {
    notFound()
  }

  const props = vm.properties
  const sec = vm.securityProfile
  const powerKey = props.powerState?.toLowerCase().replace(/\s+/g, '') ?? 'unknown'
  const patchKey = sec.patchStatus.state?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown'

  return (
    <div className="px-6 py-6 max-w-5xl">
      <Link href="/virtual-machines" className="inline-flex items-center gap-1.5 text-sm text-[#605e5c] hover:text-[#323130] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Virtual Machines
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white border border-[#edebe9] flex items-center justify-center shrink-0">
          <Server className="w-5 h-5 text-[#0078d4]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-mono text-white">{vm.name}</h1>
          <p className="text-sm text-[#605e5c] mt-0.5">{props.osType} · {props.osName}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded capitalize ${POWER_STYLE[powerKey] ?? 'bg-[#edebe9] text-[#605e5c]'}`}>
          {props.powerState}
        </span>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Secure Score"
          value={`${sec.secureScore}%`}
          color={SCORE_COLOR(sec.secureScore)}
        />
        <StatCard
          label="Vulnerabilities"
          value={sec.vulnerabilityCount}
          color={sec.vulnerabilityCount > 10 ? 'text-red-600' : sec.vulnerabilityCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <StatCard
          label="Missing Patches"
          value={sec.patchStatus.criticalAndSecurityPatchCount}
          color={sec.patchStatus.criticalAndSecurityPatchCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <StatCard label="VM Size" value={props.vmSize} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* System info */}
          <Section title="System Information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <MetaRow label="Resource Group" value={vm.resourceGroup} />
              <MetaRow icon={<MapPin className="w-3 h-3" />} label="Location" value={vm.location} />
              <MetaRow icon={<Cpu className="w-3 h-3" />} label="VM Size" value={props.vmSize} mono />
              <MetaRow label="OS Type" value={props.osType} />
              <MetaRow label="OS Name" value={props.osName} />
              <MetaRow label="Power State" value={props.powerState} />
            </dl>
          </Section>

          {/* Security controls */}
          <Section title="Security Controls">
            <dl className="space-y-2.5">
              <BoolRow label="MDE Enrolled" value={sec.mdeEnrolled} />
              <BoolRow label="Disk Encrypted" value={sec.diskEncrypted} />
              <BoolRow label="Just-in-Time Access" value={sec.justInTimeAccess} />
              <div className="flex items-center justify-between">
                <dt className="text-xs text-[#797775]">MDE Status</dt>
                <dd className={`text-xs font-medium ${sec.mdeStatus === 'running' || sec.mdeStatus === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {sec.mdeStatus}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-[#797775]">Agent Health</dt>
                <dd className={`text-xs font-medium ${sec.agentHealth === 'healthy' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {sec.agentHealth}
                </dd>
              </div>
            </dl>
          </Section>

          {/* Tags */}
          {vm.tags && Object.keys(vm.tags).length > 0 && (
            <Section title="Tags">
              <div className="flex flex-wrap gap-2">
                {Object.entries(vm.tags).map(([k, v]) => (
                  <span key={k} className="text-xs bg-[#edebe9] text-[#4b4b4b] px-2.5 py-1 rounded-full">
                    <span className="text-[#797775]">{k}:</span> {String(v)}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Patch status */}
          <Section title="Patch Status">
            <dl className="space-y-2.5">
              <div>
                <dt className="text-xs text-[#797775]">State</dt>
                <dd className={`text-sm font-semibold mt-0.5 ${PATCH_STYLE[patchKey] ?? 'text-[#4b4b4b]'}`}>
                  {sec.patchStatus.state}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#797775]">Critical & Security Patches</dt>
                <dd className={`text-2xl font-bold mt-0.5 tabular-nums ${sec.patchStatus.criticalAndSecurityPatchCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {sec.patchStatus.criticalAndSecurityPatchCount}
                </dd>
              </div>
              {sec.patchStatus.lastAssessmentTime && (
                <div>
                  <dt className="text-xs text-[#797775] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Last Assessment
                  </dt>
                  <dd className="text-xs text-[#4b4b4b] mt-0.5">
                    {new Date(sec.patchStatus.lastAssessmentTime).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </Section>

          {/* Secure score */}
          <Section title="Secure Score">
            <div className="text-center py-2">
              <p className={`text-5xl font-bold tabular-nums ${SCORE_COLOR(sec.secureScore)}`}>
                {sec.secureScore}
              </p>
              <p className="text-xs text-[#797775] mt-1">/ 100</p>
              <div className="mt-3 h-2 rounded-full bg-[#edebe9] overflow-hidden">
                <div
                  className={`h-full rounded-full ${sec.secureScore >= 70 ? 'bg-emerald-500' : sec.secureScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${sec.secureScore}%` }}
                />
              </div>
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

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-[#edebe9] rounded-lg p-4">
      <p className="text-xs text-[#605e5c] uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color ?? 'text-[#323130]'}`}>{value}</p>
    </div>
  )
}

function MetaRow({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[#797775] flex items-center gap-1">{icon}{label}</dt>
      <dd className={`text-xs text-[#4b4b4b] mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function BoolRow({ label, value, invertColor }: { label: string; value: boolean; invertColor?: boolean }) {
  const isGood = invertColor ? !value : value
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-[#797775]">{label}</dt>
      <dd className="flex items-center gap-1">
        {isGood
          ? <CheckCircle className="w-4 h-4 text-emerald-600" />
          : <XCircle className="w-4 h-4 text-red-600" />}
        <span className={`text-xs ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>{value ? 'Yes' : 'No'}</span>
      </dd>
    </div>
  )
}
