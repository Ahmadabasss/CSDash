export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#f3f2f1]/80 rounded-lg ${className}`} />
  )
}
