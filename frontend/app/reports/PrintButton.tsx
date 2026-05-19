'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/8 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <Printer className="w-4 h-4" />
      Print / Export PDF
    </button>
  )
}
