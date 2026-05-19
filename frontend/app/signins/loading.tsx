import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="px-6 py-6 space-y-4 max-w-7xl">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl mt-4" />
    </div>
  )
}
