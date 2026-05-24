'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <AlertTriangle className="w-9 h-9 text-red-600 opacity-80" />
        <div>
          <p className="text-white font-semibold">Failed to load page</p>
          <p className="text-sm text-[#605e5c] mt-1">{error.message || 'Could not reach the backend.'}</p>
        </div>
        <button onClick={reset}
          className="flex items-center gap-2 text-sm text-[#4b4b4b] hover:text-white bg-[#f3f2f1] hover:bg-[#eaecee] px-4 py-2 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  )
}
