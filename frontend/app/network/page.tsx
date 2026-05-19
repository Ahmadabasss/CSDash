'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Network, Shield, ShieldOff, Route, Server, Database,
  ChevronDown, ChevronRight, X, AlertTriangle, CheckCircle,
  Globe, Lock, Waypoints,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { NetworkTopology, VNet, Subnet, NsgDetail, NsgRule, VNetPeering } from '../../types/azure'

// ── helpers ───────────────────────────────────────────────────────────────────

const NSG_RISK: Record<string, { label: string; dot: string; ring: string; text: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500',    ring: 'ring-red-500/60',    text: 'text-red-400' },
  high:     { label: 'High',     dot: 'bg-orange-500', ring: 'ring-orange-500/60', text: 'text-orange-400' },
  medium:   { label: 'Medium',   dot: 'bg-amber-500',  ring: 'ring-amber-500/60',  text: 'text-amber-400' },
  low:      { label: 'Secure',   dot: 'bg-emerald-500',ring: 'ring-emerald-500/40',text: 'text-emerald-400' },
}

const PURPOSE_ICON: Record<string, React.ElementType> = {
  firewall: Shield,
  gateway:  Route,
  web:      Globe,
  app:      Server,
  database: Database,
  bastion:  Lock,
  management: Server,
  dmz:      Shield,
  compute:  Server,
  storage:  Database,
  monitoring: Server,
  secrets:  Lock,
  cicd:     Server,
  development: Server,
  testing:  Server,
  backup:   Database,
}

function nsgRisk(detail: NsgDetail | null | undefined) {
  if (!detail) return null
  return NSG_RISK[detail.riskLevel] ?? NSG_RISK.low
}

// ── NSG Rules Panel ───────────────────────────────────────────────────────────

function RuleRow({ rule, dir }: { rule: NsgRule; dir: 'inbound' | 'outbound' }) {
  const isAllow = rule.access === 'Allow'
  const isDeny  = rule.access === 'Deny'
  return (
    <tr className="border-b border-white/[0.04] hover:bg-slate-700/20 transition-colors">
      <td className="px-3 py-2 text-xs tabular-nums text-slate-500">{rule.priority}</td>
      <td className="px-3 py-2 text-xs text-slate-300 max-w-36 truncate" title={rule.name}>{rule.name}</td>
      <td className="px-3 py-2 text-xs font-mono text-slate-400 max-w-28 truncate" title={rule.source}>{rule.source}</td>
      <td className="px-3 py-2 text-xs font-mono text-slate-400 max-w-28 truncate" title={rule.dest}>{rule.dest}</td>
      <td className="px-3 py-2 text-xs font-mono text-slate-300">{rule.destPort}</td>
      <td className="px-3 py-2 text-xs">{rule.protocol === '*' ? 'Any' : rule.protocol}</td>
      <td className="px-3 py-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isAllow ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
          {rule.access}
        </span>
      </td>
    </tr>
  )
}

function NsgPanel({ name, detail, onClose }: { name: string; detail: NsgDetail; onClose: () => void }) {
  const risk = NSG_RISK[detail.riskLevel] ?? NSG_RISK.low
  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${risk.dot}`} />
          <span className="text-sm font-semibold text-white truncate">{name}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800 ${risk.text}`}>
            {risk.label}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {detail.riskLevel === 'critical' && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-red-900/20 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">
              This NSG has an allow-all inbound rule. Any source can reach resources in this subnet on any port.
            </p>
          </div>
        )}
        {detail.riskLevel === 'high' && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-orange-900/20 border border-orange-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300">
              Multiple internet-facing ports open. Review rules allowing inbound from Internet.
            </p>
          </div>
        )}

        {/* Inbound rules */}
        <div className="px-4 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Inbound Rules ({detail.inbound.length})
          </p>
          <div className="bg-slate-900/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Pri', 'Name', 'Source', 'Dest', 'Port', 'Proto', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.inbound.map(r => <RuleRow key={r.name} rule={r} dir="inbound" />)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outbound rules */}
        <div className="px-4 pt-4 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Outbound Rules ({detail.outbound.length})
          </p>
          <div className="bg-slate-900/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Pri', 'Name', 'Source', 'Dest', 'Port', 'Proto', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.outbound.map(r => <RuleRow key={r.name} rule={r} dir="outbound" />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subnet row ────────────────────────────────────────────────────────────────

function SubnetRow({
  subnet,
  onNsgClick,
  activeNsg,
}: {
  subnet: Subnet
  onNsgClick: (name: string, detail: NsgDetail) => void
  activeNsg: string | null
}) {
  const PurposeIcon = PURPOSE_ICON[subnet.purpose] ?? Server
  const risk = nsgRisk(subnet.nsgDetail)
  const isNoNsg = !subnet.nsg

  return (
    <div className={`
      flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0
      hover:bg-slate-700/10 transition-colors
    `}>
      {/* NSG risk indicator bar */}
      <div className={`
        w-0.5 h-8 rounded-full shrink-0
        ${isNoNsg ? 'bg-slate-700' : risk ? `${risk.dot}` : 'bg-slate-700'}
      `} />

      <PurposeIcon className="w-3.5 h-3.5 shrink-0 text-slate-500" />

      {/* name + cidr */}
      <div className="min-w-0 w-44 shrink-0">
        <p className="text-xs font-medium text-slate-200 truncate">{subnet.name}</p>
        <p className="text-[11px] font-mono text-slate-500">{subnet.addressPrefix}</p>
      </div>

      {/* NSG badge */}
      <div className="w-40 shrink-0">
        {subnet.nsg ? (
          <button
            onClick={() => subnet.nsgDetail && onNsgClick(subnet.nsg!, subnet.nsgDetail)}
            className={`
              inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded transition-colors
              ${activeNsg === subnet.nsg
                ? 'bg-[#0078d4]/30 text-[#60a5fa] ring-1 ring-[#0078d4]/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }
              ${!subnet.nsgDetail ? 'opacity-50 cursor-default' : ''}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${risk?.dot ?? 'bg-slate-500'}`} />
            <Shield className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-24">{subnet.nsg}</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
            <ShieldOff className="w-3 h-3" />
            No NSG
          </span>
        )}
      </div>

      {/* Route table badge */}
      <div className="w-36 shrink-0">
        {subnet.routeTable ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded bg-slate-800/60 text-slate-400">
            <Route className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-24">{subnet.routeTable}</span>
          </span>
        ) : (
          <span className="text-[11px] text-slate-700">—</span>
        )}
      </div>

      {/* resource chips */}
      <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
        {subnet.resources.slice(0, 4).map(r => (
          <span key={r.name} className="text-[10px] bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded truncate max-w-24" title={r.name}>
            {r.name}
          </span>
        ))}
        {subnet.resources.length > 4 && (
          <span className="text-[10px] text-slate-600">+{subnet.resources.length - 4}</span>
        )}
        {subnet.resourceCount === 0 && (
          <span className="text-[10px] text-slate-700 italic">empty</span>
        )}
      </div>
    </div>
  )
}

// ── VNet block ────────────────────────────────────────────────────────────────

function VNetBlock({
  vnet,
  onNsgClick,
  activeNsg,
}: {
  vnet: VNet
  onNsgClick: (name: string, detail: NsgDetail) => void
  activeNsg: string | null
}) {
  const [collapsed, setCollapsed] = useState(false)

  const criticalCount = vnet.subnets.filter(s => s.nsgDetail?.riskLevel === 'critical').length
  const highCount     = vnet.subnets.filter(s => s.nsgDetail?.riskLevel === 'high').length
  const noNsgCount    = vnet.subnets.filter(s => !s.nsg).length
  const isHub = vnet.role === 'hub'

  return (
    <div className={`
      bg-[#1e293b] border rounded-lg overflow-hidden
      ${isHub ? 'border-[#0078d4]/30' : 'border-white/[0.06]'}
    `}>
      {/* VNet header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <Waypoints className={`w-4 h-4 shrink-0 ${isHub ? 'text-[#60a5fa]' : 'text-slate-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{vnet.name}</span>
            {isHub && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0078d4]/20 text-[#60a5fa]">
                HUB
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] font-mono text-slate-500">{vnet.addressSpace.join(', ')}</span>
            <span className="text-[11px] text-slate-600">{vnet.location}</span>
            <span className="text-[11px] text-slate-600">{vnet.subnets.length} subnets</span>
          </div>
        </div>

        {/* risk pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          {criticalCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-900/40 text-red-300">
              {criticalCount} crit
            </span>
          )}
          {highCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300">
              {highCount} high
            </span>
          )}
          {noNsgCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
              {noNsgCount} unprotected
            </span>
          )}
        </div>

        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        }
      </button>

      {/* column headers */}
      {!collapsed && (
        <>
          <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-900/40 border-t border-b border-white/[0.04]">
            <div className="w-0.5 shrink-0" />
            <div className="w-3.5 shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-44 shrink-0">Subnet / CIDR</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-40 shrink-0">NSG</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-36 shrink-0">Route Table</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Resources</span>
          </div>
          {vnet.subnets.map(subnet => (
            <SubnetRow
              key={subnet.name}
              subnet={subnet}
              onNsgClick={onNsgClick}
              activeNsg={activeNsg}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ── Peering Graph (SVG) ───────────────────────────────────────────────────────

function PeeringGraph({
  vnets,
  peerings,
  onVnetClick,
  activeVnet,
}: {
  vnets: VNet[]
  peerings: VNetPeering[]
  onVnetClick: (v: VNet) => void
  activeVnet: string | null
}) {
  const W = 760, H = 420
  const CX = W / 2, CY = H / 2
  const R = 160

  // place hub at center, spokes around it
  const hub = vnets.find(v => v.role === 'hub')
  const spokes = vnets.filter(v => v.role !== 'hub')

  const positions: Record<string, { x: number; y: number }> = {}
  if (hub) positions[hub.name] = { x: CX, y: CY }
  spokes.forEach((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / spokes.length
    positions[v.name] = {
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    }
  })

  function nodeColor(v: VNet) {
    const criticalNsgs = v.subnets.filter(s => s.nsgDetail?.riskLevel === 'critical').length
    const highNsgs     = v.subnets.filter(s => s.nsgDetail?.riskLevel === 'high').length
    if (criticalNsgs > 0) return { fill: '#1f0a0a', stroke: '#ef4444', text: '#fca5a5' }
    if (highNsgs > 0)     return { fill: '#1a0f05', stroke: '#f97316', text: '#fdba74' }
    if (v.role === 'hub') return { fill: '#0a1628', stroke: '#0078d4', text: '#60a5fa' }
    return { fill: '#0d1f14', stroke: '#22c55e', text: '#86efac' }
  }

  function peeringColor(p: VNetPeering) {
    if (p.state !== 'Connected') return '#ef4444'
    return p.allowGatewayTransit ? '#0078d4' : '#475569'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#475569" />
        </marker>
        <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#0078d4" />
        </marker>
      </defs>

      {/* peering edges */}
      {peerings.map(p => {
        const from = positions[p.fromVnet]
        const to   = positions[p.toVnet]
        if (!from || !to) return null
        const color = peeringColor(p)
        const isGW = p.allowGatewayTransit
        return (
          <g key={p.id}>
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth={isGW ? 1.5 : 1}
              strokeDasharray={isGW ? undefined : '4 3'}
              opacity={0.6}
              markerEnd={isGW ? 'url(#arrow-blue)' : 'url(#arrow)'}
            />
          </g>
        )
      })}

      {/* nodes */}
      {vnets.map(v => {
        const pos = positions[v.name]
        if (!pos) return null
        const c = nodeColor(v)
        const isActive = activeVnet === v.name
        const isHub = v.role === 'hub'
        const rx = isHub ? 38 : 32

        return (
          <g
            key={v.name}
            transform={`translate(${pos.x},${pos.y})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onVnetClick(v)}
          >
            {isActive && (
              <circle r={rx + 7} fill="none" stroke={c.stroke} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
            )}
            <circle
              r={rx}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth={isActive ? 2 : 1.5}
              style={{ transition: 'stroke-width 0.15s' }}
            />
            {isHub && (
              <circle r={rx - 6} fill="none" stroke={c.stroke} strokeWidth={0.5} opacity={0.3} />
            )}
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fill={c.text}
              fontSize={isHub ? 9 : 8.5}
              fontWeight="600"
              fontFamily="monospace"
            >
              {v.name.replace('vnet-', '')}
            </text>
            <text
              y={rx + 14}
              textAnchor="middle"
              fill="#64748b"
              fontSize={8.5}
              fontFamily="sans-serif"
            >
              {v.addressSpace[0]}
            </text>
          </g>
        )
      })}

      {/* legend */}
      <g transform="translate(12, 12)">
        {[
          { color: '#0078d4', dash: false, label: 'Gateway Transit' },
          { color: '#475569', dash: true,  label: 'Direct Peering' },
        ].map(({ color, dash, label }, i) => (
          <g key={label} transform={`translate(0, ${i * 18})`}>
            <line x1={0} y1={7} x2={22} y2={7} stroke={color} strokeWidth={1.5} strokeDasharray={dash ? '4 3' : undefined} />
            <text x={26} y={11} fill="#64748b" fontSize={9} fontFamily="sans-serif">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// ── VNet detail panel (peering mode) ─────────────────────────────────────────

function VNetDetailPanel({ vnet, peerings, allVnets, onClose }: {
  vnet: VNet
  peerings: VNetPeering[]
  allVnets: VNet[]
  onClose: () => void
}) {
  const peers = peerings.filter(p => p.fromVnet === vnet.name || p.toVnet === vnet.name)
  const subnetIssues = vnet.subnets.filter(s =>
    !s.nsg || s.nsgDetail?.riskLevel === 'critical' || s.nsgDetail?.riskLevel === 'high'
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Waypoints className={`w-4 h-4 ${vnet.role === 'hub' ? 'text-[#60a5fa]' : 'text-slate-400'}`} />
          <span className="text-sm font-semibold text-white">{vnet.name}</span>
          {vnet.role === 'hub' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0078d4]/20 text-[#60a5fa]">HUB</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* metadata */}
        <div className="space-y-1.5">
          {[
            { k: 'Address Space', v: vnet.addressSpace.join(', ') },
            { k: 'Location',      v: vnet.location },
            { k: 'Resource Group', v: vnet.resourceGroup },
            { k: 'DNS Servers',   v: vnet.dnsServers.length ? vnet.dnsServers.join(', ') : 'Azure Default' },
            { k: 'Subnets',       v: String(vnet.subnets.length) },
          ].map(({ k, v }) => (
            <div key={k} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">{k}</span>
              <span className="text-slate-300 font-medium truncate max-w-40 font-mono">{v}</span>
            </div>
          ))}
        </div>

        {/* security issues */}
        {subnetIssues.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Security Issues</p>
            <div className="space-y-1.5">
              {subnetIssues.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs bg-slate-900/50 rounded p-2">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-slate-400">{s.name}</span>
                  <span className="ml-auto text-slate-600">
                    {!s.nsg ? 'No NSG' : s.nsgDetail?.riskLevel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* peerings */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Peerings ({peers.length})
          </p>
          <div className="space-y-1.5">
            {peers.map(p => {
              const otherName = p.fromVnet === vnet.name ? p.toVnet : p.fromVnet
              const other = allVnets.find(v => v.name === otherName)
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs bg-slate-900/50 rounded p-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.state === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-slate-300">{otherName}</span>
                  <span className="ml-auto text-slate-500 text-[10px]">
                    {p.allowGatewayTransit ? 'GW Transit' : 'Direct'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* subnets summary */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Subnets
          </p>
          <div className="space-y-1">
            {vnet.subnets.map(s => {
              const risk = nsgRisk(s.nsgDetail)
              return (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.nsg ? (risk?.dot ?? 'bg-slate-500') : 'bg-slate-700'}`} />
                  <span className="text-slate-400 truncate flex-1">{s.name}</span>
                  <span className="font-mono text-slate-600 text-[10px]">{s.addressPrefix}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Mode = 'topology' | 'peering'
type Panel =
  | { type: 'nsg';  name: string; detail: NsgDetail }
  | { type: 'vnet'; vnet: VNet }
  | null

export default function NetworkPage() {
  const [topology, setTopology] = useState<NetworkTopology | null>(null)
  const [error,    setError]    = useState(false)
  const [mode,     setMode]     = useState<Mode>('topology')
  const [selectedRg, setSelectedRg] = useState<string>('all')
  const [panel,    setPanel]    = useState<Panel>(null)

  useEffect(() => {
    api.networkTopology().then(setTopology).catch(() => setError(true))
  }, [])

  const visibleVnets = topology
    ? selectedRg === 'all'
      ? topology.vnets
      : topology.vnets.filter(v => v.resourceGroup === selectedRg)
    : []

  function openNsg(name: string, detail: NsgDetail) {
    setPanel({ type: 'nsg', name, detail })
  }
  function openVnet(vnet: VNet) {
    setPanel({ type: 'vnet', vnet })
  }

  if (error) {
    return <div className="p-8 text-slate-400">Backend offline — start the FastAPI server on port 8000.</div>
  }

  if (!topology) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-7 w-52 bg-slate-800 rounded" />
        <div className="h-10 w-full bg-slate-800 rounded-lg" />
        <div className="h-96 bg-slate-800 rounded-lg" />
      </div>
    )
  }

  // stats
  const totalSubnets   = topology.vnets.flatMap(v => v.subnets).length
  const unprotected    = topology.vnets.flatMap(v => v.subnets).filter(s => !s.nsg).length
  const criticalNsgs   = topology.vnets.flatMap(v => v.subnets).filter(s => s.nsgDetail?.riskLevel === 'critical').length
  const highNsgs       = topology.vnets.flatMap(v => v.subnets).filter(s => s.nsgDetail?.riskLevel === 'high').length

  return (
    <div className="p-6 space-y-5 h-full flex flex-col min-h-0">
      {/* header */}
      <div className="flex items-start justify-between gap-4 shrink-0 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-[#60a5fa]" />
            <h1 className="text-xl font-semibold text-white">Network Topology</h1>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">Azure Virtual Network topology, NSG rules, and VNet peering</p>
        </div>

        {/* mode tabs */}
        <div className="flex items-center bg-slate-800/60 rounded-lg p-0.5 border border-white/[0.06]">
          {([
            { id: 'topology', label: 'RG Topology',  icon: Waypoints },
            { id: 'peering',  label: 'VNet Peering', icon: Network },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setPanel(null) }}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${mode === id
                  ? 'bg-[#1e293b] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'VNets',          value: topology.vnets.length,   color: 'text-white' },
          { label: 'Subnets',        value: totalSubnets,             color: 'text-white' },
          { label: 'Unprotected',    value: unprotected,              color: unprotected > 0 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Critical NSGs',  value: criticalNsgs,             color: criticalNsgs > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1e293b] border border-white/[0.06] rounded-lg p-3.5">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* main body */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* left: main view */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0 overflow-y-auto">

          {mode === 'topology' && (
            <>
              {/* RG filter */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-500">Resource Group</span>
                <select
                  value={selectedRg}
                  onChange={e => setSelectedRg(e.target.value)}
                  className="text-xs bg-slate-800 border border-white/[0.08] rounded px-2.5 py-1.5 text-slate-300 outline-none focus:border-[#0078d4]/60 transition-colors"
                >
                  <option value="all">All Resource Groups</option>
                  {topology.resourceGroups.map(rg => (
                    <option key={rg} value={rg}>{rg}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-600">{visibleVnets.length} VNet{visibleVnets.length !== 1 ? 's' : ''}</span>
              </div>

              {/* VNet blocks */}
              <div className="space-y-3">
                {visibleVnets.length === 0 ? (
                  <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg py-12 text-center">
                    <p className="text-sm text-slate-500">No VNets found in this resource group.</p>
                  </div>
                ) : (
                  visibleVnets.map(v => (
                    <VNetBlock
                      key={v.name}
                      vnet={v}
                      onNsgClick={openNsg}
                      activeNsg={panel?.type === 'nsg' ? panel.name : null}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {mode === 'peering' && (
            <div className="bg-[#1e293b] border border-white/[0.06] rounded-lg overflow-hidden flex-1" style={{ minHeight: 420 }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">VNet Peering Map</p>
                <p className="text-xs text-slate-600">{topology.peerings.length} peering connections · click a node for details</p>
              </div>
              <div className="p-2 h-[420px]">
                <PeeringGraph
                  vnets={topology.vnets}
                  peerings={topology.peerings}
                  onVnetClick={openVnet}
                  activeVnet={panel?.type === 'vnet' ? panel.vnet.name : null}
                />
              </div>
            </div>
          )}
        </div>

        {/* right: detail panel */}
        {panel && (
          <div className="w-96 shrink-0 bg-[#1e293b] border border-white/[0.06] rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)', position: 'sticky', top: 0 }}>
            {panel.type === 'nsg' && (
              <NsgPanel
                name={panel.name}
                detail={panel.detail}
                onClose={() => setPanel(null)}
              />
            )}
            {panel.type === 'vnet' && (
              <VNetDetailPanel
                vnet={panel.vnet}
                peerings={topology.peerings}
                allVnets={topology.vnets}
                onClose={() => setPanel(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
