import AlertsTable from '@/components/AlertsTable'

export default function AlertsPage() {
  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#323130]">Alerts</h1>
        <p className="text-sm text-[#605e5c] mt-0.5">Vigil — active security alerts</p>
      </div>
      <div className="rounded-xl bg-white border border-[#edebe9] p-5">
        <AlertsTable limit={50} showPagination />
      </div>
    </div>
  )
}
