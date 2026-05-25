import { api } from '@/lib/api'
import VulnerabilitiesClient from './VulnerabilitiesClient'

export const dynamic = 'force-dynamic'

export default async function VulnerabilitiesPage() {
  const vulns = await api.vulnerabilities()
  const exploitable = vulns.filter(v => v.publicExploit && v.exposedMachines > 0)

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#323130]">CVEs</h1>
        <p className="text-sm text-[#605e5c] mt-0.5">Defender Vulnerability Management — CVE risk ranking</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        {[
          { label: 'Total CVEs', value: vulns.length },
          { label: 'Exploitable', value: exploitable.length, color: 'text-red-600' },
          { label: 'In Exploit Kit', value: vulns.filter(v => v.exploitInKit).length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white border border-[#edebe9] p-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.color ?? 'text-[#323130]'}`}>{s.value}</p>
            <p className="text-xs text-[#797775] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-[#edebe9] p-5">
        <h2 className="mb-5 text-sm font-semibold text-[#4b4b4b]">All CVEs — ranked by risk score</h2>
        <div className="overflow-x-auto">
          <VulnerabilitiesClient vulns={vulns} />
        </div>
      </div>
    </div>
  )
}
