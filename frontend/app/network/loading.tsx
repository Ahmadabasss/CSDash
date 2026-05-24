export default function NetworkLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-7 w-52 bg-[#f3f2f1] rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <div key={i} className="h-16 bg-[#f3f2f1] rounded-lg" />)}
      </div>
      <div className="h-12 bg-[#f3f2f1] rounded-lg" />
      <div className="space-y-3">
        {[0,1,2].map(i => <div key={i} className="h-32 bg-[#f3f2f1] rounded-lg" />)}
      </div>
    </div>
  )
}
