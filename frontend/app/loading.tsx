export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#edebe9] border-t-[#0078d4] animate-spin" />
        <p className="text-sm text-[#797775]">Loading…</p>
      </div>
    </div>
  )
}
