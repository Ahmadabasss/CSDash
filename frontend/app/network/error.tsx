'use client'

import { AlertTriangle } from 'lucide-react'

export default function NetworkError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <AlertTriangle className="w-10 h-10 text-amber-600" />
      <p className="text-[#4b4b4b] font-medium">Failed to load network topology</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-[#f3f2f1] hover:bg-[#eaecee] text-sm text-[#323130] border border-[#edebe9] transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
