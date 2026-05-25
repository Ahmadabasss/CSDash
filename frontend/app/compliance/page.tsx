import Link from 'next/link'
import { api } from '@/lib/api'
import ComplianceDonut from '@/components/ComplianceDonut'
import StatusBadge from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const standards = await api.compliance()
  const totalFailing = standards.reduce((s, c) => s + c.properties.failedControls, 0)
  const totalPassing = standards.reduce((s, c) => s + c.properties.passedControls, 0)

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#323130]">Compliance</h1>
        <p className="text-sm text-[#605e5c] mt-0.5">Defender for Cloud — regulatory compliance posture</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Standards', value: standards.length },
          { label: 'Failing Controls', value: totalFailing, color: 'text-red-600' },
          { label: 'Passing Controls', value: totalPassing, color: 'text-emerald-600' },
          { label: 'Failed Standards', value: standards.filter(s => s.properties.state === 'Failed').length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white border border-[#edebe9] p-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.color ?? 'text-[#323130]'}`}>{s.value}</p>
            <p className="text-xs text-[#797775] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white border border-[#edebe9] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#797775]">By Standard</h2>
          <ComplianceDonut standards={standards} />
        </div>

        <div className="rounded-xl bg-white border border-[#edebe9] p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#797775]">All Standards</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#edebe9] text-left">
                  {['Standard', 'State', 'Passed', 'Failed', 'Skipped', 'Pass Rate'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#797775]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {standards.map(s => {
                  const total = s.properties.passedControls + s.properties.failedControls
                  const rate = total > 0 ? Math.round((s.properties.passedControls / total) * 100) : 0
                  return (
                    <tr key={s.id} className="group hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/compliance/${encodeURIComponent(s.name)}`} className="text-[#323130] group-hover:text-[#0078d4] transition-colors">
                          {s.name.replace('Azure-', '')}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.properties.state} /></td>
                      <td className="px-4 py-3 tabular-nums text-emerald-600">{s.properties.passedControls}</td>
                      <td className="px-4 py-3 tabular-nums text-red-600">{s.properties.failedControls}</td>
                      <td className="px-4 py-3 tabular-nums text-[#797775]">{s.properties.skippedControls}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-[#edebe9]">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="tabular-nums text-xs text-[#605e5c]">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
