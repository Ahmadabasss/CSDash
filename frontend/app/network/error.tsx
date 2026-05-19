'use client'

import { AlertTriangle } from 'lucide-react'

export default function NetworkError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <AlertTriangle className="w-10 h-10 text-amber-400" />
      <p className="text-slate-300 font-medium">Failed to load network topology</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 border border-white/8 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
