import { ListChecks } from 'lucide-react'
import RecommendationsTable from '@/components/RecommendationsTable'

export default function RecommendationsPage() {
  return (
    <main className="min-h-screen px-6 py-8 max-w-[1400px] mx-auto w-full">
      <div className="mb-6 flex items-center gap-3">
        <a href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Dashboard</a>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 text-sm font-medium flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-amber-400" /> Recommendations
        </span>
      </div>
      <div className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-slate-700/60">
        <h1 className="mb-6 text-lg font-semibold text-slate-100">Security Recommendations</h1>
        <RecommendationsTable limit={50} showPagination />
      </div>
    </main>
  )
}
