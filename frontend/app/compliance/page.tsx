import { ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import ComplianceDonut from '@/components/ComplianceDonut'
import StatusBadge from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const standards = await api.compliance()
  const totalFailing = standards.reduce((s, c) => s + c.properties.failedControls, 0)
  const totalPassing = standards.reduce((s, c) => s + c.properties.passedControls, 0)

  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <a href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Dashboard</a>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 text-sm font-medium flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-sky-400" /> Compliance
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Standards', value: standards.length },
          { label: 'Failing Controls', value: totalFailing, red: true },
          { label: 'Passing Controls', value: totalPassing, green: true },
          { label: 'Failed Standards', value: standards.filter(s => s.properties.state === 'Failed').length, red: true },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-slate-800/50 p-4 ring-1 ring-slate-700/60 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.red ? 'text-red-400' : s.green ? 'text-emerald-400' : 'text-slate-100'}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">By Standard</h2>
          <ComplianceDonut standards={standards} />
        </div>

        <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">All Standards</h2>
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/40">
                  {['Standard', 'State', 'Passed', 'Failed', 'Skipped', 'Pass Rate'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {standards.map(s => {
                  const total = s.properties.passedControls + s.properties.failedControls
                  const rate = total > 0 ? Math.round((s.properties.passedControls / total) * 100) : 0
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{s.name.replace('Azure-', '')}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.properties.state} /></td>
                      <td className="px-4 py-3 tabular-nums text-emerald-400">{s.properties.passedControls}</td>
                      <td className="px-4 py-3 tabular-nums text-red-400">{s.properties.failedControls}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">{s.properties.skippedControls}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-700">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="tabular-nums text-xs text-slate-400">{rate}%</span>
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
    </main>
  )
}
