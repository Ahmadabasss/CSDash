'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Bell, ClipboardList, Bug, FolderOpen, Siren, UserX, Monitor, Server } from 'lucide-react'
import { api } from '@/lib/api'
import type { Alert, Recommendation, Vulnerability, AzureResource, Incident, RiskyUser, VirtualMachine, Endpoint } from '@/types/azure'

interface Result {
  id: string
  label: string
  sub: string
  href: string
  icon: React.ElementType
  iconCls: string
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useDebounce(query, 250)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); return }
    const q = debounced.toLowerCase()
    setLoading(true)

    Promise.allSettled([
      api.alerts({ page: 1, limit: 100 }),
      api.recommendations({ page: 1, limit: 100 }),
      api.vulnerabilities(),
      api.resources(),
      api.incidents({ page: 1, limit: 100 }),
      api.riskyUsers(),
      api.virtualMachines({ limit: 200 }),
      api.endpoints({ limit: 200 }),
    ]).then(([alertsRes, recsRes, vulnsRes, resourcesRes, incidentsRes, riskyUsersRes, vmsRes, endpointsRes]) => {
      const out: Result[] = []

      if (alertsRes.status === 'fulfilled') {
        alertsRes.value.items
          .filter((a: Alert) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
          .slice(0, 3)
          .forEach((a: Alert) => out.push({
            id: a.id, label: a.title,
            sub: `Alert · ${a.severity} · ${a.category}`,
            href: `/alerts/${encodeURIComponent(a.id)}`, icon: Bell, iconCls: 'text-red-400',
          }))
      }

      if (incidentsRes.status === 'fulfilled') {
        incidentsRes.value.items
          .filter((i: Incident) => i.displayName.toLowerCase().includes(q))
          .slice(0, 3)
          .forEach((i: Incident) => out.push({
            id: i.id, label: i.displayName,
            sub: `Incident · ${i.severity} · ${i.status}`,
            href: `/incidents/${encodeURIComponent(i.id)}`, icon: Siren, iconCls: 'text-red-400',
          }))
      }

      if (recsRes.status === 'fulfilled') {
        recsRes.value.items
          .filter((r: Recommendation) => r.properties.displayName.toLowerCase().includes(q))
          .slice(0, 3)
          .forEach((r: Recommendation) => out.push({
            id: r.id, label: r.properties.displayName,
            sub: `Recommendation · ${r.properties.metadata.severity}`,
            href: `/recommendations/${r.name}`, icon: ClipboardList, iconCls: 'text-amber-400',
          }))
      }

      if (vulnsRes.status === 'fulfilled') {
        (vulnsRes.value as Vulnerability[])
          .filter(v => v.id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
          .slice(0, 2)
          .forEach(v => out.push({
            id: v.id, label: v.id,
            sub: `CVE · CVSS ${v.cvssV3} · ${v.name}`,
            href: `/vulnerabilities/${encodeURIComponent(v.id)}`, icon: Bug, iconCls: 'text-orange-400',
          }))
      }

      if (resourcesRes.status === 'fulfilled') {
        (resourcesRes.value as AzureResource[])
          .filter(r => r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q))
          .slice(0, 2)
          .forEach(r => out.push({
            id: r.id, label: r.name,
            sub: `Resource · ${r.type.split('/').pop()} · ${r.location}`,
            href: `/resources/${encodeURIComponent(r.name)}`, icon: FolderOpen, iconCls: 'text-sky-400',
          }))
      }

      if (riskyUsersRes.status === 'fulfilled') {
        (riskyUsersRes.value as RiskyUser[])
          .filter(u => u.userDisplayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q))
          .slice(0, 2)
          .forEach(u => out.push({
            id: u.id, label: u.userDisplayName,
            sub: `Risky User · ${u.riskLevel} risk · ${u.department || u.userPrincipalName}`,
            href: `/risky-users/${encodeURIComponent(u.id)}`, icon: UserX, iconCls: 'text-purple-400',
          }))
      }

      if (vmsRes.status === 'fulfilled') {
        (vmsRes.value.items as VirtualMachine[])
          .filter(v => v.name.toLowerCase().includes(q) || v.resourceGroup.toLowerCase().includes(q))
          .slice(0, 2)
          .forEach(v => out.push({
            id: v.id, label: v.name,
            sub: `VM · ${v.properties.osType} · ${v.resourceGroup}`,
            href: `/virtual-machines/${encodeURIComponent(v.name)}`, icon: Server, iconCls: 'text-blue-400',
          }))
      }

      if (endpointsRes.status === 'fulfilled') {
        (endpointsRes.value.items as Endpoint[])
          .filter(e => e.computerDnsName.toLowerCase().includes(q) || e.rbacGroupName.toLowerCase().includes(q))
          .slice(0, 2)
          .forEach(e => out.push({
            id: e.id, label: e.computerDnsName,
            sub: `Endpoint · ${e.riskScore} risk · ${e.osPlatform}`,
            href: `/endpoints/${encodeURIComponent(e.id)}`, icon: Monitor, iconCls: 'text-emerald-400',
          }))
      }

      setResults(out)
      setSelected(0)
    }).finally(() => setLoading(false))
  }, [debounced])

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected].href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 ring-1 ring-slate-700 hover:ring-slate-500 hover:text-slate-200 transition-all"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl rounded-2xl bg-[#1e293b] shadow-2xl ring-1 ring-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-700/60 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search alerts, incidents, users, devices, CVEs…"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400 shrink-0" />}
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {results.length > 0 && (
              <ul className="max-h-96 overflow-y-auto py-2">
                {results.map((r, i) => {
                  const Icon = r.icon
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => navigate(r.href)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'}`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${r.iconCls}`} />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{r.label}</p>
                          <p className="text-xs text-slate-500 truncate">{r.sub}</p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {query && !loading && results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No results for &ldquo;{query}&rdquo;</p>
            )}

            {!query && (
              <div className="px-4 py-4">
                <p className="text-xs text-slate-600 mb-2">Search across</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Alerts', cls: 'text-red-400' },
                    { label: 'Incidents', cls: 'text-red-400' },
                    { label: 'Recommendations', cls: 'text-amber-400' },
                    { label: 'CVEs', cls: 'text-orange-400' },
                    { label: 'Resources', cls: 'text-sky-400' },
                    { label: 'Risky Users', cls: 'text-purple-400' },
                    { label: 'VMs', cls: 'text-blue-400' },
                    { label: 'Endpoints', cls: 'text-emerald-400' },
                  ].map(({ label, cls }) => (
                    <span key={label} className={`text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 ${cls}`}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
