export default function OrphansLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-7 w-52 bg-[#f3f2f1] rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <div key={i} className="h-20 bg-[#f3f2f1] rounded-lg" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-[#f3f2f1] rounded-lg" />
        <div className="h-40 bg-[#f3f2f1] rounded-lg" />
      </div>
      <div className="h-96 bg-[#f3f2f1] rounded-lg" />
    </div>
  )
}
