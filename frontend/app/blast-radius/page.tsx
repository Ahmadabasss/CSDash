'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Crosshair, AlertTriangle, Users, Shield,
  ChevronDown, X, ExternalLink, Server, Database, Globe,
} from 'lucide-react'
import { fetchJSON } from '@/lib/api'
import BlastRadiusGraph from '@/components/BlastRadiusGraph'
import type { AzureResource, BlastRadiusData, BlastRadiusNode } from '@/types/azure'

const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-red-400',
  medium:   'text-amber-400',
  low:      'text-blue-400',
  informational: 'text-slate-400',
}

const SEV_BG: Record<string, string> = {
  critical: 'bg-red-900/50 text-red-300',
  high:     'bg-red-900/40 text-red-300',
  medium:   'bg-amber-900/40 text-amber-300',
  low:      'bg-blue-900/30 text-blue-300',
  informational: 'bg-slate-700 text-slate-400',
}

const RISK_RING: Record<string, string> = {
  high:   'ring-red-500/60',
  medium: 'ring-amber-500/50',
  low:    'ring-blue-500/40',
}

function ResourceTypeIcon({ type }: { type: string }) {
  const t = (type.split('/').pop() ?? '').toLowerCase()
  if (t.includes('virtual') && t.includes('machine')) return <Server className="w-3.5 h-3.5 text-[#0078d4]" />
  if (t.includes('database') || t.includes('server')) return <Database className="w-3.5 h-3.5 text-emerald-400" />
  return <Globe className="w-3.5 h-3.5 text-slate-400" />
}

export default function BlastRadiusPage() {
  const [resources, setResources] = useState<AzureResource[]>([])
  const [selected, setSelected] = useState<string>('')
  const [data, setData] = useState<BlastRadiusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [selectedNode, setSelectedNode] = useState<BlastRadiusNode | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const analyze = useCallback(async (name: string) => {
    if (!name) return
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedNode(null)
    try {
      const result = await fetchJSON<BlastRadiusData>(`/api/blast-radius/${encodeURIComponent(name)}`)
      setData(result)
    } catch {
      setError('Could not compute blast radius — try a different resource.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJSON<AzureResource[]>('/api/resources')
      .then(rs => {
        const sorted = [...rs].sort((a, b) => (b.issuesCount ?? 0) - (a.issuesCount ?? 0))
        setResources(sorted)
        if (sorted.length > 0) {
          const first = sorted[0].name
          setSelected(first)
          analyze(first)
        }
      })
      .catch(() => setError('Failed to load resources'))
  }, [analyze])

  const filtered = resources.filter(r =>
    r.name.toLowerCase().includes(filter.toLowerCase()) ||
    r.type.toLowerCase().includes(filter.toLowerCase()) ||
    r.resourceGroup.toLowerCase().includes(filter.toLowerCase())
  )

  const selectedRes = resources.find(r => r.name === selected)

  // Severity breakdown for center alerts
  const sevBreakdown = data
    ? (['critical', 'high', 'medium', 'low'] as const).map(s => ({
        label: s,
        count: data.summary.severities[s] ?? 0,
      })).filter(s => s.count > 0)
    : []

  return (
    <div className="px-6 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Crosshair className="w-5 h-5 text-red-400" />
          <h1 className="text-xl font-semibold text-white">Blast Radius</h1>
        </div>
        <p className="text-sm text-slate-400">
          Visualize a resource&apos;s attack surface — shared alerts, neighboring resources, and affected users.
        </p>
      </div>

      {/* Resource selector */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative w-96" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 bg-[#1e293b] border border-white/6 rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:border-sky-700/50 transition-colors"
          >
            <span className="flex items-center gap-2 truncate min-w-0">
              {selectedRes
                ? <>
                    <ResourceTypeIcon type={selectedRes.type} />
                    <span className="truncate">{selectedRes.name}</span>
                    <span className="shrink-0 text-slate-500 font-mono text-[11px]">
                      [{selectedRes.type.split('/').pop()?.slice(0, 10)}]
                    </span>
                  </>
                : <span className="text-slate-500">Select a resource…</span>
              }
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute z-50 top-full mt-1 w-full bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-2 border-b border-white/6">
                <input
                  autoFocus
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Search by name, type, or resource group…"
                  className="w-full bg-slate-900 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filtered.slice(0, 40).map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r.name); setOpen(false); setFilter('') }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-3 ${
                      r.name === selected ? 'bg-sky-900/30 text-sky-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      <ResourceTypeIcon type={r.type} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-2">
                      <span className="text-slate-600 font-mono text-[10px]">{r.resourceGroup.slice(0, 16)}</span>
                      {(r.issuesCount ?? 0) > 0 && (
                        <span className="text-xs text-red-400 font-mono font-bold">{r.issuesCount}!</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => analyze(selected)}
          disabled={!selected || loading}
          className="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
        >
          <Crosshair className="w-4 h-4" />
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-950/40 border border-red-900/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-28 text-slate-500 text-sm">
          <Crosshair className="w-5 h-5 mr-2 animate-spin" />
          Computing blast radius…
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Resources at Risk" value={data.summary.resourcesAtRisk}
              icon={<Shield className="w-4 h-4 text-red-400" />} color="text-red-400" />
            <StatCard label="Center Alerts" value={data.summary.centerAlertCount}
              icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} color="text-amber-400" />
            <StatCard label="Affected Users" value={data.summary.affectedUserCount}
              icon={<Users className="w-4 h-4 text-purple-400" />} color="text-purple-400" />
            <StatCard label="Resource Group" value={data.center.resourceGroup}
              icon={<Crosshair className="w-4 h-4 text-slate-400" />} color="text-slate-300" small />
          </div>

          {/* Severity breakdown bar */}
          {sevBreakdown.length > 0 && (
            <div className="rounded-xl bg-slate-800/40 ring-1 ring-slate-700/50 px-5 py-3 flex items-center gap-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider shrink-0">Alert severity</span>
              <div className="flex items-center gap-2 flex-wrap">
                {sevBreakdown.map(({ label, count }) => (
                  <span key={label} className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${SEV_BG[label]}`}>
                    {count} {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Graph + node detail panel */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
            <div className={`${selectedNode ? 'xl:col-span-3' : 'xl:col-span-5'} rounded-2xl bg-slate-800/50 ring-1 ring-slate-700/60 p-5 transition-all`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Attack Surface Graph</h2>
                <span className="text-xs text-slate-500 font-mono">{data.center.name}</span>
              </div>
              <BlastRadiusGraph
                data={data}
                selectedNodeId={selectedNode?.id ?? null}
                onSelectNode={setSelectedNode}
              />
            </div>

            {/* Node detail side panel */}
            {selectedNode && (
              <div className="xl:col-span-2 rounded-2xl bg-slate-800/50 ring-1 ring-slate-700/60 p-5 xl:sticky xl:top-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                      {selectedNode.relationship === 'shared-alert' ? 'Shared Alert Node' : 'Same Resource Group'}
                    </p>
                    <h3 className="text-sm font-semibold text-white leading-snug break-all">{selectedNode.name}</h3>
                  </div>
                  <button onClick={() => setSelectedNode(null)}
                    className="text-slate-600 hover:text-slate-300 transition-colors ml-2 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Risk badge */}
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-4 ring-1 capitalize
                  ${selectedNode.risk === 'high' ? 'bg-red-900/40 text-red-300 ring-red-700/50' :
                    selectedNode.risk === 'medium' ? 'bg-amber-900/40 text-amber-300 ring-amber-700/50' :
                    'bg-blue-900/30 text-blue-300 ring-blue-700/40'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedNode.risk === 'high' ? 'bg-red-400' :
                    selectedNode.risk === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  {selectedNode.risk} risk
                </div>

                {/* Resource details */}
                <dl className="space-y-2.5 mb-4">
                  <NodeRow label="Type" value={selectedNode.type.split('/').slice(-1)[0]} />
                  <NodeRow label="Resource Group" value={selectedNode.resourceGroup} />
                  {selectedNode.location && <NodeRow label="Location" value={selectedNode.location} />}
                  <NodeRow label="Issues" value={String(selectedNode.issuesCount ?? 0)} />
                  {selectedNode.relationship === 'shared-alert' && (
                    <NodeRow label="Shared Alerts" value={String(selectedNode.sharedAlertCount)} highlight />
                  )}
                  {selectedNode.secureScore !== undefined && (
                    <NodeRow label="Secure Score" value={`${selectedNode.secureScore}%`} />
                  )}
                </dl>

                {/* Secure score mini bar */}
                {selectedNode.secureScore !== undefined && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Secure Score</span>
                      <span>{selectedNode.secureScore}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${selectedNode.secureScore >= 70 ? 'bg-emerald-500' : selectedNode.secureScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${selectedNode.secureScore}%` }}
                      />
                    </div>
                  </div>
                )}

                <Link
                  href={`/resources/${encodeURIComponent(selectedNode.id)}`}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View resource details
                </Link>
              </div>
            )}
          </div>

          {/* Bottom panels: center alerts + affected users */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Center alerts — clickable */}
            <div className="rounded-2xl bg-slate-800/50 ring-1 ring-slate-700/60 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                Alerts on Target Resource
              </h3>
              {data.centerAlerts.length === 0 ? (
                <p className="text-sm text-slate-500">No direct alerts found.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.centerAlerts.map(a => (
                    <Link
                      key={a.id}
                      href={`/alerts/${encodeURIComponent(a.id)}`}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors group"
                    >
                      <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded min-w-11 text-center ${SEV_BG[a.severity.toLowerCase()] ?? 'bg-slate-700 text-slate-400'}`}>
                        {a.severity}
                      </span>
                      <span className="text-slate-300 text-sm truncate group-hover:text-white transition-colors">{a.title}</span>
                      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400 shrink-0 ml-auto transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Affected users */}
            <div className="rounded-2xl bg-slate-800/50 ring-1 ring-slate-700/60 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                Affected Users in Resource Group
              </h3>
              {data.affectedUsers.length === 0 ? (
                <p className="text-sm text-slate-500">No user activity linked to this area.</p>
              ) : (
                <div className="space-y-2">
                  {data.affectedUsers.map(u => (
                    <div key={u.userPrincipalName}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-900/40">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-purple-950 ring-1 ring-purple-700 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-purple-300">
                            {(u.accountName || u.userPrincipalName).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-mono text-slate-300 truncate">{u.userPrincipalName}</p>
                          {u.accountName && u.accountName !== u.userPrincipalName && (
                            <p className="text-[11px] text-slate-500">{u.accountName}</p>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${
                        u.alertCount >= 3 ? 'bg-red-900/40 text-red-300 ring-red-700/40' :
                        u.alertCount >= 2 ? 'bg-amber-900/40 text-amber-300 ring-amber-700/40' :
                        'bg-slate-700/60 text-slate-400 ring-slate-600/40'
                      }`}>
                        {u.alertCount} alert{u.alertCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-28 text-slate-600">
          <Crosshair className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm">Select a resource above to begin analysis</p>
          <p className="text-xs mt-1 text-slate-700">Resources are sorted by issue count — try the top ones</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color, small }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; small?: boolean
}) {
  return (
    <div className="rounded-xl bg-slate-800/50 ring-1 ring-slate-700/60 p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <p className={`font-bold tabular-nums ${small ? 'text-sm truncate' : 'text-2xl'} ${color}`}>{value}</p>
    </div>
  )
}

function NodeRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-xs text-right truncate ${highlight ? 'text-amber-300 font-semibold' : 'text-slate-300'}`}>{value}</dd>
    </div>
  )
}
