import { api } from '../../lib/api'
import VMsClient from './VMsClient'

export const dynamic = 'force-dynamic'

export default async function VirtualMachinesPage() {
  let summary, data
  try {
    ;[summary, data] = await Promise.all([api.vmSummary(), api.virtualMachines({ limit: 200 })])
  } catch {
    return (
      <div className="p-8 text-slate-400">
        Backend offline — start the FastAPI server on port 8000.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Virtual Machines</h1>
        <p className="text-sm text-slate-400 mt-0.5">Azure VM security posture — patches, encryption, MDE enrollment</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total VMs" value={summary.total} />
        <StatCard label="Running" value={summary.running} color="text-emerald-400" />
        <StatCard label="Patch Issues" value={summary.patchIssues} color="text-red-400" />
        <StatCard label="Not MDE Enrolled" value={summary.notMdeEnrolled} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="No Disk Encryption" value={summary.noEncryption} color="text-red-400" />
        <StatCard label="Total Vulnerabilities" value={summary.totalVulnerabilities} color="text-amber-400" />
        <PatchDistCard data={summary.byPatchStatus} />
        <OsDistCard data={summary.byOs} />
      </div>

      <VMsClient items={data.items} />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-white'}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function PatchDistCard({ data }: { data: Record<string, number> }) {
  const COLOR: Record<string, string> = {
    CriticalPatches: 'text-red-400',
    SecurityPatches: 'text-amber-400',
    UpToDate: 'text-emerald-400',
    Unknown: 'text-slate-500',
  }
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4 col-span-1">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Patch Status</p>
      <div className="space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className={COLOR[k] ?? 'text-slate-400'}>{k}</span>
            <span className="text-slate-400">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OsDistCard({ data }: { data: Record<string, number> }) {
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4 col-span-1">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">OS Type</p>
      <div className="space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-slate-300">{k}</span>
            <span className="text-slate-400">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
