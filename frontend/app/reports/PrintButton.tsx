'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-[#f3f2f1] hover:bg-[#eaecee] text-[#323130] border border-[#edebe9] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <Printer className="w-4 h-4" />
      Print / Export PDF
    </button>
  )
}
