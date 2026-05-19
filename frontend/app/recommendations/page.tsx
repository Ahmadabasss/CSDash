import RecommendationsTable from '@/components/RecommendationsTable'

export default function RecommendationsPage() {
  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Recommendations</h1>
        <p className="text-sm text-slate-400 mt-0.5">Microsoft Defender for Cloud — security recommendations</p>
      </div>
      <div className="rounded-xl bg-[#1e293b] border border-white/6 p-5">
        <RecommendationsTable limit={50} showPagination />
      </div>
    </div>
  )
}
