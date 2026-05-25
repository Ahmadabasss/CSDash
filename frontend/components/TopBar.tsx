'use client'

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import { useLastUpdated } from '@/lib/useLastUpdated'

const BREADCRUMB_MAP: Record<string, string> = {
  '/': 'Overview',
  '/alerts': 'Alerts',
  '/incidents': 'Incidents',
  '/secure-score': 'Secure Score',
  '/recommendations': 'Recommendations',
  '/compliance': 'Compliance',
  '/endpoints': 'Endpoints',
  '/virtual-machines': 'Virtual Machines',
  '/vulnerabilities': 'CVEs',
  '/signins': 'Sign-ins',
  '/risky-users': 'Risky Users',
  '/resources': 'All Resources',
}

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const pageLabel = BREADCRUMB_MAP[pathname] ?? pathname.replace('/', '')

  const doRefresh = useCallback(async () => { router.refresh() }, [router])
  const { label, refreshing, refresh } = useLastUpdated(doRefresh)

  return (
    <header className="flex items-center justify-between px-5 h-14 border-b border-[#edebe9] bg-white shrink-0">
      <nav className="flex items-center gap-1.5 text-[13px]">
        <span className="text-[#797775]">Vigil</span>
        <span className="text-[#a19f9d]">/</span>
        <span className="text-[#323130] font-medium">{pageLabel}</span>
      </nav>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <div className="flex items-center gap-2 text-xs text-[#797775]">
          <span>Updated {label}</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Refresh data"
            className="rounded p-1 hover:bg-[#f3f2f1] hover:text-[#4b4b4b] transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  )
}
