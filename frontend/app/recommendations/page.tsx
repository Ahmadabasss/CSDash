import RecommendationsTable from '@/components/RecommendationsTable'

export default function RecommendationsPage() {
  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#323130]">Recommendations</h1>
        <p className="text-sm text-[#605e5c] mt-0.5">Vigil — security recommendations</p>
      </div>
      <div className="rounded-xl bg-white border border-[#edebe9] p-5">
        <RecommendationsTable limit={50} showPagination />
      </div>
    </div>
  )
}
