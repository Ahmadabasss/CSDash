'use client'

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import ScenarioSwitcher from './ScenarioSwitcher'
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
    <header className="flex items-center justify-between px-5 h-14 border-b border-white/6 bg-[#0d1117] shrink-0">
      <nav className="flex items-center gap-1.5 text-[13px]">
        <span className="text-slate-500">Microsoft Defender</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-200 font-medium">{pageLabel}</span>
      </nav>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Updated {label}</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Refresh data"
            className="rounded p-1 hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <ScenarioSwitcher onSwitch={() => router.refresh()} />
      </div>
    </header>
  )
}
