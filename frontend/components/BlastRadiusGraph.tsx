'use client'

import { useState, useRef, useCallback } from 'react'
import type { BlastRadiusData, BlastRadiusNode } from '@/types/azure'

const W = 900
const H = 520
const CX = 450
const CY = 260

const INNER_R = 168
const OUTER_R = 275
const USER_R  = 94

const RISK_COLOR = {
  high:   { fill: '#3b0a0a', stroke: '#ef4444', text: '#fca5a5', badge: 'bg-red-100 text-red-700' },
  medium: { fill: '#2d1e00', stroke: '#f59e0b', text: '#fcd34d', badge: 'bg-amber-100 text-amber-700' },
  low:    { fill: '#0c1a30', stroke: '#60a5fa', text: '#93c5fd', badge: 'bg-blue-100 text-blue-700' },
  none:   { fill: '#111c2a', stroke: '#475569', text: '#94a3b8', badge: 'bg-slate-100 text-slate-600' },
} as const

type RiskKey = keyof typeof RISK_COLOR

function polar(angle: number, r: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
}

function shortType(type: string) {
  const last = (type.split('/').pop() ?? type).toLowerCase()
  const abbrev: Record<string, string> = {
    virtualmachines: 'VM', storageaccounts: 'SA', networksecuritygroups: 'NSG',
    publicipaddresses: 'IP', sites: 'WEB', vaults: 'KV', databases: 'DB',
    servers: 'SQL', virtualnetworks: 'VNET', workspaces: 'LOG',
  }
  return abbrev[last] ?? last.slice(0, 3).toUpperCase()
}

interface HoverInfo {
  x: number
  y: number
  kind: 'node' | 'user' | 'center'
  name: string
  subtype?: string
  risk?: RiskKey
  alerts?: number
  score?: number
  rg?: string
  relationship?: string
}

interface Props {
  data: BlastRadiusData
  selectedNodeId?: string | null
  onSelectNode?: (node: BlastRadiusNode | null) => void
}

export default function BlastRadiusGraph({ data, selectedNodeId, onSelectNode }: Props) {
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const innerNodes = data.nodes.filter(n => n.relationship === 'shared-alert')
  const outerNodes = data.nodes.filter(n => n.relationship === 'same-rg')

  const innerAngles = innerNodes.map((_, i) => (i / Math.max(innerNodes.length, 1)) * Math.PI * 2 - Math.PI / 2)
  const outerAngles = outerNodes.map((_, i) => (i / Math.max(outerNodes.length, 1)) * Math.PI * 2 - Math.PI / 2)
  const userAngles  = data.affectedUsers.map((_, i) => (i / Math.max(data.affectedUsers.length, 1)) * Math.PI * 2 - Math.PI / 2)

  const showHover = useCallback((e: React.MouseEvent<SVGElement>, info: Omit<HoverInfo, 'x' | 'y'>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, ...info })
  }, [])

  const clearHover = useCallback(() => {
    setHover(null)
    setHoveredId(null)
  }, [])

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Dark canvas for graph visualization */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#071422', border: '1px solid #1e3a5f' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          onMouseLeave={clearHover}
        >
          <defs>
            <radialGradient id="br-cg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="br-grid" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0f2040" stopOpacity="1" />
              <stop offset="100%" stopColor="#071422" stopOpacity="1" />
            </radialGradient>
            <filter id="br-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="br-glow-xl" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="9" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="br-glow-sm" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <style>{`
              @keyframes br-pulse {
                0%   { r: 44; opacity: 0.45; }
                100% { r: 82; opacity: 0; }
              }
              .br-pulse { animation: br-pulse 2.6s ease-out infinite; }
              @keyframes br-df { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
              @keyframes br-ds { from { stroke-dashoffset: 22; } to { stroke-dashoffset: 0; } }
              @keyframes br-du { from { stroke-dashoffset: 14; } to { stroke-dashoffset: 0; } }
              .br-da { animation: br-df 1.0s linear infinite; }
              .br-dr { animation: br-ds 3.0s linear infinite; }
              .br-du { animation: br-du 4.0s linear infinite; }
              .br-node { transition: opacity 0.15s; }
              .br-node:hover { opacity: 0.92; }
            `}</style>
          </defs>

          {/* Background */}
          <rect x="0" y="0" width={W} height={H} fill="url(#br-grid)" />

          {/* Orbit rings */}
          {innerNodes.length > 0 && (
            <circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="#ef444428" strokeWidth="1.5" strokeDasharray="6 10" />
          )}
          {outerNodes.length > 0 && (
            <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke="#1e3a5f" strokeWidth="1" strokeDasharray="4 10" />
          )}
          {data.affectedUsers.length > 0 && (
            <circle cx={CX} cy={CY} r={USER_R} fill="none" stroke="#4c1d9540" strokeWidth="1" strokeDasharray="2 7" />
          )}

          {/* Connection lines → inner (shared alert) */}
          {innerNodes.map((n, i) => {
            const p = polar(innerAngles[i], INNER_R)
            const active = selectedNodeId === n.id || hoveredId === n.id
            return (
              <line key={n.id + '-l'} x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke={active ? '#ef4444' : '#ef444435'}
                strokeWidth={active ? 2 : 0.8}
                strokeDasharray="5 4"
                className="br-da"
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
              />
            )
          })}

          {/* Connection lines → outer (same RG) */}
          {outerNodes.map((n, i) => {
            const p = polar(outerAngles[i], OUTER_R)
            const active = selectedNodeId === n.id || hoveredId === n.id
            return (
              <line key={n.id + '-l'} x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke={active ? '#3b82f6' : '#1e3a5f'}
                strokeWidth={active ? 1.5 : 0.8}
                strokeDasharray="4 7"
                className="br-dr"
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
              />
            )
          })}

          {/* Connection lines → users */}
          {data.affectedUsers.map((u, i) => {
            const p = polar(userAngles[i], USER_R)
            return (
              <line key={u.userPrincipalName + '-l'} x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke="#6d28d940" strokeWidth="0.7" strokeDasharray="2 5"
                className="br-du"
              />
            )
          })}

          {/* Center glow */}
          <circle cx={CX} cy={CY} r={90} fill="url(#br-cg)" />
          <circle className="br-pulse" cx={CX} cy={CY} fill="none" stroke="#ef4444" strokeWidth="1.2" />

          {/* Center node */}
          <g
            style={{ cursor: 'default' }}
            onMouseEnter={e => {
              setHoveredId('center')
              showHover(e, {
                kind: 'center',
                name: data.center.name,
                subtype: data.center.type.split('/').pop(),
                rg: data.center.resourceGroup,
                alerts: data.centerAlerts?.length ?? 0,
                score: data.center.secureScore,
              })
            }}
            onMouseLeave={clearHover}
          >
            <circle cx={CX} cy={CY} r={42} fill="#7f1d1d" stroke="#ef4444" strokeWidth="2.5"
              filter="url(#br-glow-xl)" />
            <circle cx={CX} cy={CY} r={48} fill="none" stroke="#ef444430" strokeWidth="1" />
            <text x={CX} y={CY - 8} textAnchor="middle" fill="#fca5a5" fontSize="12" fontFamily="monospace" fontWeight="800" letterSpacing="0.5">
              {shortType(data.center.type)}
            </text>
            <text x={CX} y={CY + 9} textAnchor="middle" fill="#ef4444cc" fontSize="7" fontFamily="monospace" letterSpacing="2">
              TARGET
            </text>
            <text x={CX} y={CY + 66} textAnchor="middle" fill="#f87171" fontSize="10" fontWeight="600">
              {data.center.name.length > 22 ? data.center.name.slice(0, 21) + '…' : data.center.name}
            </text>
          </g>

          {/* Inner ring: shared-alert nodes */}
          {innerNodes.map((n, i) => {
            const p = polar(innerAngles[i], INNER_R)
            const c = RISK_COLOR[n.risk as RiskKey] ?? RISK_COLOR.none
            const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
            const sel = selectedNodeId === n.id
            const hov = hoveredId === n.id
            const nodeR = 22 + (n.sharedAlertCount > 4 ? 6 : n.sharedAlertCount > 2 ? 3 : 0)
            return (
              <g key={n.id} className="br-node" style={{ cursor: 'pointer' }}
                onClick={() => onSelectNode?.(sel ? null : n)}
                onMouseEnter={e => {
                  setHoveredId(n.id)
                  showHover(e, {
                    kind: 'node',
                    name: n.name,
                    subtype: n.type.split('/').pop(),
                    risk: n.risk as RiskKey,
                    alerts: n.sharedAlertCount,
                    score: n.secureScore,
                    rg: n.resourceGroup,
                    relationship: 'Shared alert',
                  })
                }}
                onMouseLeave={clearHover}
              >
                {(sel || hov) && (
                  <circle cx={p.x} cy={p.y} r={nodeR + 11} fill="none" stroke={c.stroke}
                    strokeWidth={sel ? 1.5 : 1}
                    strokeOpacity={sel ? 0.6 : 0.35}
                    strokeDasharray={sel ? '3 3' : '2 4'}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={nodeR}
                  fill={hov ? c.stroke + '28' : c.fill}
                  stroke={c.stroke}
                  strokeWidth={sel ? 2.5 : hov ? 2 : 1.5}
                  filter={(sel || hov) ? 'url(#br-glow-sm)' : undefined}
                  style={{ transition: 'fill 0.15s, stroke-width 0.15s' }}
                />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fill={c.text} fontSize="9.5" fontFamily="monospace" fontWeight="700">
                  {shortType(n.type)}
                </text>
                <text x={p.x} y={p.y + nodeR + 15} textAnchor="middle"
                  fill={sel ? '#e2e8f0' : hov ? '#cbd5e1' : '#64748b'} fontSize="7.5"
                  fontWeight={sel ? '600' : '400'}>
                  {label}
                </text>
                {n.sharedAlertCount > 0 && (
                  <>
                    <circle cx={p.x + nodeR - 1} cy={p.y - nodeR + 1} r={9.5}
                      fill="#dc2626" filter="url(#br-glow-sm)" />
                    <text x={p.x + nodeR - 1} y={p.y - nodeR + 5.5} textAnchor="middle"
                      fill="white" fontSize="8.5" fontWeight="800">
                      {n.sharedAlertCount}
                    </text>
                  </>
                )}
              </g>
            )
          })}

          {/* Outer ring: same-rg nodes */}
          {outerNodes.map((n, i) => {
            const p = polar(outerAngles[i], OUTER_R)
            const c = RISK_COLOR[n.risk as RiskKey] ?? RISK_COLOR.none
            const label = n.name.length > 13 ? n.name.slice(0, 12) + '…' : n.name
            const sel = selectedNodeId === n.id
            const hov = hoveredId === n.id
            return (
              <g key={n.id} className="br-node" style={{ cursor: 'pointer' }}
                onClick={() => onSelectNode?.(sel ? null : n)}
                onMouseEnter={e => {
                  setHoveredId(n.id)
                  showHover(e, {
                    kind: 'node',
                    name: n.name,
                    subtype: n.type.split('/').pop(),
                    risk: n.risk as RiskKey,
                    alerts: n.sharedAlertCount,
                    score: n.secureScore,
                    rg: n.resourceGroup,
                    relationship: 'Same resource group',
                  })
                }}
                onMouseLeave={clearHover}
              >
                {(sel || hov) && (
                  <circle cx={p.x} cy={p.y} r={27} fill="none" stroke={c.stroke}
                    strokeWidth={sel ? 1.5 : 1}
                    strokeOpacity={sel ? 0.6 : 0.3}
                    strokeDasharray={sel ? '3 3' : '2 4'}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={18}
                  fill={hov ? c.stroke + '20' : c.fill}
                  stroke={sel || hov ? c.stroke : '#2a4a6b'}
                  strokeWidth={sel ? 2 : hov ? 1.5 : 1}
                  filter={(sel || hov) ? 'url(#br-glow-sm)' : undefined}
                  style={{ transition: 'fill 0.15s, stroke-width 0.15s' }}
                />
                <text x={p.x} y={p.y + 4} textAnchor="middle"
                  fill={sel || hov ? c.text : '#64748b'} fontSize="8" fontFamily="monospace">
                  {shortType(n.type)}
                </text>
                <text x={p.x} y={p.y + 29} textAnchor="middle"
                  fill={sel || hov ? '#94a3b8' : '#475569'} fontSize="7">
                  {label}
                </text>
              </g>
            )
          })}

          {/* User nodes */}
          {data.affectedUsers.map((u, i) => {
            const p = polar(userAngles[i], USER_R)
            const initials = (u.accountName || u.userPrincipalName).slice(0, 2).toUpperCase()
            const hov = hoveredId === u.userPrincipalName
            return (
              <g key={u.userPrincipalName} style={{ cursor: 'default' }}
                onMouseEnter={e => {
                  setHoveredId(u.userPrincipalName)
                  showHover(e, {
                    kind: 'user',
                    name: u.userPrincipalName,
                    alerts: u.alertCount,
                  })
                }}
                onMouseLeave={clearHover}
              >
                <circle cx={p.x} cy={p.y} r={15}
                  fill={hov ? '#3b0764' : '#2e1065'}
                  stroke={hov ? '#a855f7' : '#7c3aed'}
                  strokeWidth={hov ? 2 : 1.5}
                  filter={hov ? 'url(#br-glow-sm)' : undefined}
                  style={{ transition: 'fill 0.15s' }}
                />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#c4b5fd" fontSize="7" fontWeight="700">
                  {initials}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* HTML hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-50 min-w-45 max-w-60"
          style={{
            left: hover.x + (hover.x > (containerRef.current?.offsetWidth ?? 600) / 2 ? -200 : 16),
            top: hover.y - 10,
          }}
        >
          <div className="rounded-xl bg-white ring-1 ring-[#edebe9] shadow-2xl px-3.5 py-3 text-xs">
            {hover.kind === 'center' && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded px-1.5 py-0.5 bg-red-100 text-red-700 font-mono text-[10px] font-bold">TARGET</span>
                  <span className="text-[#605e5c] font-mono text-[10px]">{hover.subtype}</span>
                </div>
                <p className="font-semibold text-[#323130] text-[12px] leading-snug mb-2 break-all">{hover.name}</p>
                <div className="space-y-1 text-[11px]">
                  <Row label="Resource Group" value={hover.rg ?? '—'} />
                  <Row label="Direct Alerts" value={String(hover.alerts ?? 0)} highlight={(hover.alerts ?? 0) > 0} />
                  {hover.score !== undefined && <Row label="Secure Score" value={`${hover.score}%`} />}
                </div>
              </>
            )}

            {hover.kind === 'node' && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize
                    ${hover.risk === 'high' ? 'bg-red-100 text-red-700' :
                      hover.risk === 'medium' ? 'bg-amber-100 text-amber-700' :
                      hover.risk === 'low' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'}`}>
                    {hover.risk ?? 'none'} risk
                  </span>
                  <span className="text-[#797775] font-mono text-[10px]">{hover.subtype}</span>
                </div>
                <p className="font-semibold text-[#323130] text-[12px] leading-snug mb-2 break-all">{hover.name}</p>
                <div className="space-y-1 text-[11px]">
                  <Row label="Relation" value={hover.relationship ?? '—'} />
                  <Row label="Shared Alerts" value={String(hover.alerts ?? 0)} highlight={(hover.alerts ?? 0) > 0} />
                  {hover.score !== undefined && <Row label="Secure Score" value={`${hover.score}%`} />}
                  {hover.rg && <Row label="Resource Group" value={hover.rg} />}
                </div>
                <p className="mt-2 pt-2 border-t border-[#edebe9] text-[#a19f9d] text-[10px]">Click to inspect</p>
              </>
            )}

            {hover.kind === 'user' && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="rounded px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold">User</span>
                </div>
                <p className="font-mono text-[#323130] text-[11px] leading-snug mb-2 break-all">{hover.name}</p>
                <div className="text-[11px]">
                  <Row label="Linked Alerts" value={String(hover.alerts ?? 0)} highlight={(hover.alerts ?? 0) >= 2} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[11px] text-[#797775]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-700 ring-1 ring-red-500 shrink-0" />Target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-100 ring-1 ring-red-400 shrink-0" />Shared alert
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200 ring-1 ring-slate-400 shrink-0" />Same RG
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-100 ring-1 ring-purple-400 shrink-0" />Affected user
        </span>
        <span className="ml-auto text-[#a19f9d] italic text-[10px]">Hover to preview · Click to inspect</span>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#797775]">{label}</span>
      <span className={`font-medium ${highlight ? 'text-amber-600' : 'text-[#4b4b4b]'}`}>{value}</span>
    </div>
  )
}
