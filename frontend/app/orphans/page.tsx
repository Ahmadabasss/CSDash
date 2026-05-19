'use client'

import { useState } from 'react'
import { Ghost, Server, Globe, ShieldOff, Archive, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { OrphanItem, OrphanCategory, OrphanRisk, OrphanReport } from '../../types/azure'
import { api } from '../../lib/api'

// ── constants ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<OrphanCategory, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  deallocated_vm:    { label: 'Deallocated VM',    icon: Server,    color: 'text-red-400',    badge: 'bg-red-900/40 text-red-300' },
  exposed_public_ip: { label: 'Exposed Public IP', icon: Globe,     color: 'text-orange-400', badge: 'bg-orange-900/40 text-orange-300' },
  stale_nsg:         { label: 'Stale NSG',         icon: ShieldOff, color: 'text-amber-400',  badge: 'bg-amber-900/40 text-amber-300' },
  abandoned_storage: { label: 'Abandoned Storage', icon: Archive,   color: 'text-purple-400', badge: 'bg-purple-900/40 text-purple-300' },
}

const RISK_COLORS: Record<OrphanRisk, string> = {
  Critical: 'bg-red-900 text-red-300',
  High:     'bg-red-800/60 text-red-400',
  Medium:   'bg-amber-900/60 text-amber-300',
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function DistCard({ title, data, colorMap }: {
  title: string
  data: Record<string, number>
  colorMap: Record<string, string>
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium w-36 shrink-0 truncate ${colorMap[key] ?? 'bg-slate-700 text-slate-300'}`}>
              {key}
            </span>
            <div className="flex-1 bg-slate-700/40 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[#0078d4]" style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
            </div>
            <span className="text-xs text-slate-400 w-5 text-right tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrphanRow({ item }: { item: OrphanItem }) {
  const [expanded, setExpanded] = useState(false)
  const cat  = CATEGORY_META[item.category]
  const Icon = cat.icon
  const detail = item.detail as Record<string, string>

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      {/* main row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <Icon className={`w-4 h-4 shrink-0 ${cat.color}`} />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 truncate font-medium">{item.name}</p>
          <p className="text-xs text-slate-500 truncate">{item.resourceGroup} · {item.location}</p>
        </div>

        <span className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${cat.badge}`}>
          {cat.label}
        </span>

        <span className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${RISK_COLORS[item.risk]}`}>
          {item.risk}
        </span>

        <span className="text-xs text-slate-500 shrink-0 tabular-nums">{item.age_days}d idle</span>

        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        }
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* metadata */}
          <div className="bg-slate-900/50 rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Details</p>
            {detail.osType     && <MetaRow k="OS"           v={detail.osType} />}
            {detail.vmSize     && <MetaRow k="VM Size"      v={detail.vmSize} />}
            {detail.patchState && <MetaRow k="Patch State"  v={detail.patchState} />}
            {detail.mdeStatus  && <MetaRow k="MDE Status"   v={detail.mdeStatus} />}
            {detail.vulnCount  && <MetaRow k="CVEs"         v={String(detail.vulnCount)} />}
            {detail.env        && <MetaRow k="Environment"  v={detail.env} />}
            {detail.owner      && detail.owner !== 'unassigned' && <MetaRow k="Owner" v={detail.owner} />}
            <MetaRow k="Last seen" v={new Date(item.last_seen).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} />
          </div>

          {/* why + remediation */}
          <div className="space-y-3">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{item.why_dangerous}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Remediation</p>
              <ol className="space-y-1">
                {item.remediation.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="shrink-0 text-slate-600 tabular-nums">{i + 1}.</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-300 font-medium truncate max-w-40">{v}</span>
    </div>
  )
}

// ── client wrapper (filter state) ──────────────────────────────────────────────

function OrphansList({ items }: { items: OrphanItem[] }) {
  const [risk, setRisk]  = useState<string>('all')
  const [cat, setCat]    = useState<string>('all')

  const filtered = items.filter(i =>
    (risk === 'all' || i.risk === risk) &&
    (cat  === 'all' || i.category === cat)
  )

  return (
    <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-wrap">
        <span className="text-xs text-slate-400">{filtered.length} of {items.length} resources</span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select
            value={risk}
            onChange={e => setRisk(e.target.value)}
            className="text-xs bg-slate-800 border border-white/[0.08] rounded px-2 py-1 text-slate-300 outline-none"
          >
            <option value="all">All severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>
          <select
            value={cat}
            onChange={e => setCat(e.target.value)}
            className="text-xs bg-slate-800 border border-white/[0.08] rounded px-2 py-1 text-slate-300 outline-none"
          >
            <option value="all">All types</option>
            <option value="deallocated_vm">Deallocated VMs</option>
            <option value="exposed_public_ip">Exposed Public IPs</option>
            <option value="stale_nsg">Stale NSGs</option>
            <option value="abandoned_storage">Abandoned Storage</option>
          </select>
        </div>
      </div>

      {/* column headers */}
      <div className="hidden md:flex items-center gap-3 px-4 py-2 border-b border-white/[0.04] text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        <span className="w-4" />
        <span className="flex-1">Resource</span>
        <span className="w-36">Type</span>
        <span className="w-20">Risk</span>
        <span className="w-16 text-right">Idle</span>
        <span className="w-4" />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">No orphaned resources match this filter.</div>
      ) : (
        filtered.map(item => <OrphanRow key={item.id} item={item} />)
      )}
    </div>
  )
}

// ── page (server data fetch is done here; client parts handle interactivity) ───
// This file is 'use client', so we load data client-side via useEffect.
// Alternatively export a server wrapper — but keeping it simple with client fetch.

import { useEffect } from 'react'

export default function OrphansPage() {
  const [report, setReport] = useState<OrphanReport | null>(null)
  const [error,  setError]  = useState(false)

  useEffect(() => {
    api.orphans().then(setReport).catch(() => setError(true))
  }, [])

  if (error) {
    return <div className="p-8 text-slate-400">Backend offline — start the FastAPI server on port 8000.</div>
  }

  if (!report) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-slate-800 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-slate-800 rounded-lg" />
          <div className="h-40 bg-slate-800 rounded-lg" />
        </div>
        <div className="h-96 bg-slate-800 rounded-lg" />
      </div>
    )
  }

  const { items, total, critical, high, medium, by_category } = report

  const catDistribution: Record<string, number> = {
    'Deallocated VMs':    by_category.deallocated_vm,
    'Exposed Public IPs': by_category.exposed_public_ip,
    'Stale NSGs':         by_category.stale_nsg,
    'Abandoned Storage':  by_category.abandoned_storage,
  }

  const riskDistribution: Record<string, number> = { Critical: critical, High: high, Medium: medium }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Ghost className="w-5 h-5 text-red-400" />
          <h1 className="text-xl font-semibold text-white">Ghost Resources</h1>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">Abandoned infrastructure posing active security threats</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Orphans"  value={total}    />
        <StatCard label="Critical"       value={critical} color="text-red-400" />
        <StatCard label="High"           value={high}     color="text-orange-400" />
        <StatCard label="Medium"         value={medium}   color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DistCard
          title="By Risk Level"
          data={riskDistribution}
          colorMap={{ Critical: 'bg-red-900 text-red-300', High: 'bg-red-800/60 text-red-400', Medium: 'bg-amber-900/60 text-amber-300' }}
        />
        <DistCard
          title="By Category"
          data={catDistribution}
          colorMap={{
            'Deallocated VMs':    'bg-red-900/40 text-red-300',
            'Exposed Public IPs': 'bg-orange-900/40 text-orange-300',
            'Stale NSGs':         'bg-amber-900/40 text-amber-300',
            'Abandoned Storage':  'bg-purple-900/40 text-purple-300',
          }}
        />
      </div>

      {total === 0 ? (
        <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg py-16 text-center">
          <Ghost className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-white">No ghost resources detected</p>
          <p className="text-xs text-slate-500 mt-1">Your environment has no orphaned or abandoned resources.</p>
        </div>
      ) : (
        <OrphansList items={items} />
      )}
    </div>
  )
}
