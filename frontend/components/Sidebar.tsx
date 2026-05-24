'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  LayoutDashboard,
  Bell,
  Siren,
  ShieldCheck,
  ClipboardList,
  CheckSquare,
  Monitor,
  Server,
  Bug,
  LogIn,
  UserX,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crosshair,
  FileText,
  Ghost,
  Network,
} from 'lucide-react'
import clsx from 'clsx'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

interface NavSection {
  heading: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    heading: '',
    items: [{ label: 'Overview', href: '/', icon: LayoutDashboard }],
  },
  {
    heading: 'Threat Management',
    items: [
      { label: 'Alerts', href: '/alerts', icon: Bell },
      { label: 'Incidents', href: '/incidents', icon: Siren },
    ],
  },
  {
    heading: 'Posture Management',
    items: [
      { label: 'Secure Score', href: '/secure-score', icon: ShieldCheck },
      { label: 'Recommendations', href: '/recommendations', icon: ClipboardList },
      { label: 'Compliance', href: '/compliance', icon: CheckSquare },
    ],
  },
  {
    heading: 'Workloads',
    items: [
      { label: 'Endpoints', href: '/endpoints', icon: Monitor },
      { label: 'Virtual Machines', href: '/virtual-machines', icon: Server },
    ],
  },
  {
    heading: 'Vulnerabilities',
    items: [{ label: 'CVEs', href: '/vulnerabilities', icon: Bug }],
  },
  {
    heading: 'Identity',
    items: [
      { label: 'Sign-ins', href: '/signins', icon: LogIn },
      { label: 'Risky Users', href: '/risky-users', icon: UserX },
    ],
  },
  {
    heading: 'Resources',
    items: [{ label: 'All Resources', href: '/resources', icon: FolderOpen }],
  },
  {
    heading: 'Investigation',
    items: [
      { label: 'Blast Radius',    href: '/blast-radius', icon: Crosshair },
      { label: 'Ghost Resources', href: '/orphans',      icon: Ghost },
      { label: 'Network Topology',href: '/network',      icon: Network },
    ],
  },
  {
    heading: 'Reports',
    items: [{ label: 'Executive Summary', href: '/reports', icon: FileText }],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [badges, setBadges] = useState<{ alerts: number; recommendations: number; riskyUsers: number; orphans: number } | null>(null)

  useEffect(() => {
    Promise.all([api.summary(), api.riskyUserSummary(), api.orphans()]).then(([s, ru, orph]) => {
      setBadges({
        alerts: s.openAlerts.total,
        recommendations: s.unhealthyRecommendations.total,
        riskyUsers: ru.atRisk,
        orphans: orph.critical + orph.high,
      })
    }).catch(() => {})
  }, [])

  const badgeMap: Record<string, number | undefined> = {
    '/alerts': badges?.alerts,
    '/recommendations': badges?.recommendations,
    '/risky-users': badges?.riskyUsers,
    '/orphans': badges?.orphans,
  }

  return (
    <aside
      className={clsx(
        'flex flex-col shrink-0 bg-[#1b3a5c] border-r border-[#154a7a] transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-white/10 min-h-14">
        <div className="shrink-0 w-7 h-7 bg-white rounded flex items-center justify-center">
          <Shield className="w-4 h-4 text-[#0078d4]" />
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold text-white leading-tight tracking-tight">
            Vigil
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-4">
        {NAV.map((section) => (
          <div key={section.heading}>
            {section.heading && !collapsed && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {section.heading}
              </p>
            )}
            {section.heading && collapsed && (
              <div className="mx-2 my-1 border-t border-white/10" />
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={clsx(
                    'flex items-center gap-2.5 mx-1.5 px-2 py-1.5 rounded text-[13px] transition-colors',
                    active
                      ? 'bg-white/15 text-white font-medium'
                      : 'text-white/60 hover:bg-white/8 hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>
                      {badgeMap[item.href] != null && badgeMap[item.href]! > 0 && (
                        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                          {badgeMap[item.href]! > 999 ? '999+' : badgeMap[item.href]}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center py-3 border-t border-white/10 text-white/40 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
