'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState,
  BackgroundVariant, MarkerType,
  type Node, type Edge, type NodeProps,
  Handle, Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Network, Shield, ShieldOff, Server, Database, Globe,
  Lock, Route, Flame, AlertTriangle, CheckCircle, X,
  Waypoints, ChevronDown, ChevronRight, Play, Search,
  ArrowRight, Info, Zap,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { NetworkTopology, VNet, Subnet, NsgDetail, NsgRule, VNetPeering } from '../../types/azure'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Risk colours
// ─────────────────────────────────────────────────────────────────────────────

const RC = {
  critical: { border: '#ef4444', bg: '#1f0808', text: '#fca5a5' },
  high:     { border: '#f97316', bg: '#1a0e05', text: '#fdba74' },
  medium:   { border: '#f59e0b', bg: '#1a1505', text: '#fcd34d' },
  low:      { border: '#22c55e', bg: '#071510', text: '#86efac' },
  none:     { border: '#334155', bg: '#ffffff', text: '#64748b' },
}

function vnetRisk(v: VNet): keyof typeof RC {
  if (v.subnets.some(s => s.nsgDetail?.riskLevel === 'critical')) return 'critical'
  if (v.subnets.some(s => s.nsgDetail?.riskLevel === 'high'))     return 'high'
  if (v.subnets.some(s => !s.nsg))                                return 'medium'
  if (v.subnets.some(s => s.nsgDetail?.riskLevel === 'medium'))   return 'medium'
  return 'low'
}
function subnetRisk(s: Subnet): keyof typeof RC {
  if (!s.nsg) return 'medium'
  return (s.nsgDetail?.riskLevel ?? 'low') as keyof typeof RC
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Security issue scanner
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityIssue {
  id: string
  severity: 'critical' | 'high' | 'medium'
  type: string
  title: string
  description: string
  vnetName: string
  subnetName?: string
  nsgName?: string
  nodeId: string   // React Flow node id to highlight
  ruleName?: string
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2 }

const MGMT_PORTS: Record<string, string> = {
  '22': 'SSH', '3389': 'RDP', '23': 'Telnet', '21': 'FTP',
  '3306': 'MySQL', '5432': 'PostgreSQL', '1433': 'MSSQL',
  '6379': 'Redis', '27017': 'MongoDB', '8080': 'HTTP-alt',
  '8888': 'Jupyter',
}

function isPublicSource(src: string): boolean {
  return src === '*' || src === 'Internet'
}

function scanIssues(vnets: VNet[]): SecurityIssue[] {
  const issues: SecurityIssue[] = []

  for (const vnet of vnets) {
    for (const subnet of vnet.subnets) {
      const subId = `subnet-${vnet.name}-${subnet.name}`
      const nsgId = `nsg-${vnet.name}-${subnet.name}`

      // no NSG
      if (!subnet.nsg) {
        issues.push({
          id: `no-nsg-${vnet.name}-${subnet.name}`,
          severity: 'high',
          type: 'no_nsg',
          title: `No NSG — ${subnet.name}`,
          description: `Subnet ${subnet.addressPrefix} has no Network Security Group. All traffic is unrestricted by default.`,
          vnetName: vnet.name,
          subnetName: subnet.name,
          nodeId: subId,
        })
        continue
      }

      const nsg = subnet.nsgDetail
      if (!nsg) continue

      for (const rule of nsg.inbound) {
        if (rule.access !== 'Allow') continue
        if (!isPublicSource(rule.source)) continue

        // allow-all on all ports
        if (rule.destPort === '*') {
          issues.push({
            id: `allow-all-${vnet.name}-${subnet.name}-${rule.name}`,
            severity: 'critical',
            type: 'allow_all_inbound',
            title: `Allow-All Inbound — ${subnet.nsg}`,
            description: `Rule "${rule.name}" (priority ${rule.priority}) allows ALL traffic from ${rule.source} on every port. This subnet is fully exposed.`,
            vnetName: vnet.name,
            subnetName: subnet.name,
            nsgName: subnet.nsg,
            nodeId: nsgId,
            ruleName: rule.name,
          })
          break // one critical per NSG is enough
        }

        // management port exposed
        const port = rule.destPort
        const label = MGMT_PORTS[port]
        if (label) {
          issues.push({
            id: `mgmt-port-${vnet.name}-${subnet.name}-${rule.name}`,
            severity: 'high',
            type: 'exposed_mgmt_port',
            title: `${label} (${port}) open from Internet — ${subnet.nsg}`,
            description: `Rule "${rule.name}" (priority ${rule.priority}) allows ${label} port ${port} from ${rule.source}. Management ports should never be open to the internet.`,
            vnetName: vnet.name,
            subnetName: subnet.name,
            nsgName: subnet.nsg,
            nodeId: nsgId,
            ruleName: rule.name,
          })
        }
      }
    }
  }

  return issues.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Traffic path simulator
// ─────────────────────────────────────────────────────────────────────────────

interface TrafficResult {
  verdict: 'ALLOWED' | 'DENIED' | 'NO_NSG'
  matchedRule?: NsgRule
  reason: string
  checkedRules: number
}

function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [net, bits] = cidr.split('/')
    const mask = ~((1 << (32 - parseInt(bits))) - 1) >>> 0
    const ipInt  = ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o), 0) >>> 0
    const netInt = net.split('.').reduce((acc, o) => (acc << 8) + parseInt(o), 0) >>> 0
    return (ipInt & mask) === (netInt & mask)
  } catch { return false }
}

function srcMatches(src: string, ip: string): boolean {
  if (src === '*' || src === 'AnyInbound') return true
  if (src === 'Internet') return !['10.', '172.', '192.168.'].some(p => ip.startsWith(p))
  if (src === 'VirtualNetwork') return ['10.', '172.1', '192.168.'].some(p => ip.startsWith(p))
  if (src.includes('/')) return ipInCidr(ip, src)
  return src === ip
}

function portMatches(portRule: string, port: string): boolean {
  if (portRule === '*') return true
  if (portRule === port) return true
  if (portRule.includes('-')) {
    const [lo, hi] = portRule.split('-').map(Number)
    const p = parseInt(port)
    return p >= lo && p <= hi
  }
  return portRule.split(',').map(s => s.trim()).includes(port)
}

function simulateTraffic(
  srcIp: string,
  destSubnet: Subnet,
  destPort: string,
  protocol: string,
): TrafficResult {
  if (!destSubnet.nsg || !destSubnet.nsgDetail) {
    return { verdict: 'NO_NSG', reason: 'No NSG attached — Azure default allows all inbound VNet traffic', checkedRules: 0 }
  }

  const rules = [...destSubnet.nsgDetail.inbound].sort((a, b) => a.priority - b.priority)
  for (const rule of rules) {
    const protoMatch = rule.protocol === '*' || rule.protocol.toUpperCase() === protocol.toUpperCase()
    const srcMatch   = srcMatches(rule.source, srcIp)
    const portMatch  = portMatches(rule.destPort, destPort)
    if (protoMatch && srcMatch && portMatch) {
      return {
        verdict: rule.access === 'Allow' ? 'ALLOWED' : 'DENIED',
        matchedRule: rule,
        reason: `Matched rule "${rule.name}" (priority ${rule.priority})`,
        checkedRules: rules.indexOf(rule) + 1,
      }
    }
  }
  return { verdict: 'ALLOWED', reason: 'No rule matched — Azure implicit allow', checkedRules: rules.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Custom React Flow nodes
// ─────────────────────────────────────────────────────────────────────────────

function VNetPeeringNode({ data, selected }: NodeProps) {
  const d = data as { vnet: VNet; risk: keyof typeof RC; isHub: boolean; onClick: () => void; highlighted: boolean }
  const c = RC[d.risk]
  const issues = useMemo(() => {
    return d.vnet.subnets.filter(s => !s.nsg || s.nsgDetail?.riskLevel === 'critical' || s.nsgDetail?.riskLevel === 'high').length
  }, [d.vnet])

  return (
    <div
      onClick={d.onClick}
      style={{
        background: c.bg,
        border: `${selected || d.highlighted ? 2 : 1.5}px solid ${selected ? c.border : d.highlighted ? c.border + 'aa' : c.border + '70'}`,
        borderRadius: d.isHub ? 16 : 12,
        padding: '14px 18px',
        minWidth: d.isHub ? 210 : 175,
        boxShadow: selected
          ? `0 0 0 3px ${c.border}35, 0 8px 24px ${c.border}25`
          : d.highlighted ? `0 0 12px ${c.border}40` : '0 4px 12px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: c.border, border: 'none', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left}  style={{ background: c.border, border: 'none', width: 8, height: 8 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Waypoints style={{ color: c.border, width: 15, height: 15, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
          {d.vnet.name}
        </span>
        {d.isHub && (
          <span style={{ background: '#0078d420', color: '#60a5fa', border: '1px solid #0078d440', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
            HUB
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{d.vnet.addressSpace[0]}</div>
      <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{d.vnet.location} · {d.vnet.subnets.length} subnets</div>

      {issues > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, background: c.border + '15', borderRadius: 6, padding: '3px 8px' }}>
          <AlertTriangle style={{ color: c.border, width: 10, height: 10 }} />
          <span style={{ color: c.text, fontSize: 10, fontWeight: 700 }}>{issues} security issue{issues !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

function SubnetNode({ data, selected }: NodeProps) {
  const d = data as { subnet: Subnet; risk: keyof typeof RC; onClick: () => void; highlighted: boolean }
  const c  = RC[d.risk]
  const pc: Record<string, string> = {
    web: '#0078d4', app: '#06b6d4', database: '#f97316', firewall: '#ef4444',
    gateway: '#8b5cf6', bastion: '#6366f1', management: '#64748b',
    dmz: '#f59e0b', compute: '#10b981', storage: '#a78bfa', monitoring: '#22d3ee',
    secrets: '#ec4899', cicd: '#84cc16', development: '#94a3b8', testing: '#94a3b8',
    backup: '#78716c',
  }
  const purposeColor = pc[d.subnet.purpose] ?? '#64748b'

  return (
    <div
      onClick={d.onClick}
      style={{
        background: '#111827',
        border: `${selected || d.highlighted ? 2 : 1.5}px solid ${selected ? c.border : d.highlighted ? c.border + 'bb' : '#1e2d3d'}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 205,
        boxShadow: selected ? `0 0 0 2px ${c.border}35` : d.highlighted ? `0 0 10px ${c.border}35` : '0 2px 8px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: '#1e2d3d', border: `1px solid ${c.border}`, width: 7, height: 7 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#1e2d3d', border: `1px solid ${c.border}`, width: 7, height: 7 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ background: purposeColor + '20', color: purposeColor, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
          {d.subnet.purpose}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.subnet.name}
        </span>
      </div>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{d.subnet.addressPrefix}</div>
      {d.subnet.resourceCount > 0 && (
        <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>{d.subnet.resourceCount} resources</div>
      )}
    </div>
  )
}

function NsgNode({ data, selected }: NodeProps) {
  const d = data as { name: string; detail: NsgDetail | null; onClick: () => void; highlighted: boolean; isActive: boolean }
  const risk = (d.detail?.riskLevel ?? 'low') as keyof typeof RC
  const c    = RC[risk]
  const dangerRules = d.detail?.inbound.filter(r => r.access === 'Allow' && isPublicSource(r.source)) ?? []

  return (
    <div
      onClick={d.onClick}
      style={{
        background: c.bg,
        border: `${selected || d.highlighted || d.isActive ? 2 : 1.5}px solid ${selected || d.isActive ? c.border : d.highlighted ? c.border + 'bb' : c.border + '55'}`,
        borderRadius: 8,
        padding: '9px 13px',
        minWidth: 165,
        boxShadow: selected || d.isActive ? `0 0 0 2px ${c.border}35, 0 6px 16px ${c.border}20` : d.highlighted ? `0 0 10px ${c.border}40` : '0 2px 8px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: c.border, border: 'none', width: 7, height: 7 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Shield style={{ color: c.border, width: 13, height: 13, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <span style={{ background: c.border + '20', color: c.text, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>
          {risk}
        </span>
        {d.detail && (
          <span style={{ color: '#334155', fontSize: 10 }}>
            {d.detail.inbound.length + d.detail.outbound.length} rules
          </span>
        )}
        {dangerRules.length > 0 && (
          <span style={{ color: '#ef4444', fontSize: 10, marginLeft: 'auto' }}>
            {dangerRules.length} exposed
          </span>
        )}
      </div>
    </div>
  )
}

function VNetLabelNode({ data }: NodeProps) {
  const d = data as { vnet: VNet; risk: keyof typeof RC }
  const c = RC[d.risk]
  return (
    <div style={{
      background: 'transparent',
      border: `1.5px dashed ${c.border}40`,
      borderRadius: 14,
      padding: '10px 16px',
      minWidth: 200,
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Waypoints style={{ color: c.border, width: 13, height: 13 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: c.border }}>{d.vnet.name}</span>
      </div>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#334155', marginTop: 3 }}>{d.vnet.addressSpace[0]}</div>
    </div>
  )
}

const NODE_TYPES = {
  vnetPeering: VNetPeeringNode,
  subnetTopo:  SubnetNode,
  nsgTopo:     NsgNode,
  vnetLabel:   VNetLabelNode,
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Graph builders
// ─────────────────────────────────────────────────────────────────────────────

function buildPeeringNodes(
  vnets: VNet[],
  peerings: VNetPeering[],
  onVnetClick: (v: VNet) => void,
  selectedVnet: string | null,
  highlightedNode: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const hub    = vnets.find(v => v.role === 'hub')
  const spokes = vnets.filter(v => v.role !== 'hub')
  const CX = 460, CY = 290, R = 250
  const pos: Record<string, { x: number; y: number }> = {}
  if (hub) pos[hub.name] = { x: CX - 105, y: CY - 65 }
  spokes.forEach((v, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / spokes.length
    pos[v.name] = { x: CX + R * Math.cos(a) - 87, y: CY + R * Math.sin(a) - 55 }
  })

  const nodes: Node[] = vnets.map(v => ({
    id: v.name,
    type: 'vnetPeering',
    position: pos[v.name] ?? { x: 0, y: 0 },
    selected: selectedVnet === v.name,
    data: {
      vnet: v,
      risk: vnetRisk(v),
      isHub: v.role === 'hub',
      onClick: () => onVnetClick(v),
      highlighted: highlightedNode === v.name,
    },
  }))

  const edges: Edge[] = peerings.map(p => {
    const gw = p.allowGatewayTransit
    return {
      id: p.id,
      source: p.fromVnet,
      target: p.toVnet,
      type: 'smoothstep',
      animated: gw,
      label: gw ? 'GW Transit' : undefined,
      labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: '#f3f2f1', fillOpacity: 0.9 },
      style: { stroke: gw ? '#0078d4' : '#334155', strokeWidth: gw ? 2 : 1.5, strokeDasharray: gw ? undefined : '6 4' },
      markerEnd: { type: MarkerType.ArrowClosed, color: gw ? '#0078d4' : '#334155', width: 13, height: 13 },
    }
  })
  return { nodes, edges }
}

function buildTopologyNodes(
  vnets: VNet[],
  onSubnetClick: (s: Subnet, vnet: VNet) => void,
  onNsgClick: (name: string, detail: NsgDetail, subnet: Subnet) => void,
  selectedId: string | null,
  highlightedNode: string | null,
  activeNsg: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let gY = 0

  for (const vnet of vnets) {
    const risk = vnetRisk(vnet)
    const vId  = `vnet-${vnet.name}`

    nodes.push({
      id: vId, type: 'vnetLabel',
      position: { x: 0, y: gY },
      data: { vnet, risk },
      draggable: false,
    })

    let sY = gY + 60
    for (const subnet of vnet.subnets) {
      const sId  = `subnet-${vnet.name}-${subnet.name}`
      const nId  = `nsg-${vnet.name}-${subnet.name}`
      const risk = subnetRisk(subnet)
      const c    = RC[risk]

      nodes.push({
        id: sId, type: 'subnetTopo',
        position: { x: 240, y: sY },
        selected: selectedId === sId,
        data: {
          subnet, risk,
          onClick: () => onSubnetClick(subnet, vnet),
          highlighted: highlightedNode === sId,
        },
      })
      edges.push({
        id: `e-${vId}-${sId}`, source: vId, target: sId,
        type: 'smoothstep',
        style: { stroke: '#e2e8f0', strokeWidth: 1 },
      })

      if (subnet.nsg) {
        nodes.push({
          id: nId, type: 'nsgTopo',
          position: { x: 520, y: sY + 5 },
          selected: selectedId === nId,
          data: {
            name: subnet.nsg,
            detail: subnet.nsgDetail ?? null,
            onClick: () => subnet.nsgDetail && onNsgClick(subnet.nsg!, subnet.nsgDetail, subnet),
            highlighted: highlightedNode === nId,
            isActive: activeNsg === subnet.nsg,
          },
        })
        edges.push({
          id: `e-${sId}-${nId}`, source: sId, target: nId,
          type: 'smoothstep',
          style: { stroke: c.border + '55', strokeWidth: 1.5, strokeDasharray: '4 3' },
          markerEnd: { type: MarkerType.ArrowClosed, color: c.border, width: 10, height: 10 },
        })
      }
      sY += 115
    }
    gY = sY + 40
  }
  return { nodes, edges }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Security issues panel
// ─────────────────────────────────────────────────────────────────────────────

function IssueItem({ issue, active, onClick }: { issue: SecurityIssue; active: boolean; onClick: () => void }) {
  const SEV_STYLE = {
    critical: { dot: '#ef4444', bg: '#fef2f2', border: '#fee2e2', tag: '#dc2626', tagBg: '#fee2e2' },
    high:     { dot: '#f97316', bg: '#fff7ed', border: '#fed7aa', tag: '#c2410c', tagBg: '#ffedd5' },
    medium:   { dot: '#f59e0b', bg: '#fffbeb', border: '#fde68a', tag: '#b45309', tagBg: '#fef9c3' },
  }
  const s = SEV_STYLE[issue.severity]

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-all"
      style={{
        background: active ? s.bg : 'transparent',
        border: `1px solid ${active ? s.border : 'transparent'}`,
        borderRadius: 8,
        padding: '9px 12px',
        marginBottom: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ background: s.tagBg, color: s.tag, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', flexShrink: 0 }}>
              {issue.severity}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#323130', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {issue.title}
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.45 }}>{issue.description}</p>
          <p style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>{issue.vnetName}{issue.subnetName ? ` › ${issue.subnetName}` : ''}</p>
        </div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Traffic simulator panel
// ─────────────────────────────────────────────────────────────────────────────

function TrafficSimulator({ vnets }: { vnets: VNet[] }) {
  const [srcIp,   setSrcIp]   = useState('203.0.113.50')
  const [destSub, setDestSub] = useState('')
  const [port,    setPort]    = useState('443')
  const [proto,   setProto]   = useState('TCP')
  const [result,  setResult]  = useState<TrafficResult | null>(null)

  const allSubnets = useMemo(() => vnets.flatMap(v => v.subnets.map(s => ({ ...s, vnetName: v.name }))), [vnets])

  function run() {
    const sub = allSubnets.find(s => `${s.vnetName}/${s.name}` === destSub)
    if (!sub) return
    setResult(simulateTraffic(srcIp, sub, port, proto))
  }

  const verdictColor = result
    ? result.verdict === 'ALLOWED' ? '#22c55e'
    : result.verdict === 'DENIED'  ? '#ef4444'
    : '#f59e0b'
    : '#64748b'

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Zap style={{ color: '#60a5fa', width: 13, height: 13 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4b4b4b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Traffic Simulator</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 4 }}>SOURCE IP</label>
          <input
            value={srcIp} onChange={e => setSrcIp(e.target.value)}
            placeholder="e.g. 203.0.113.1 or 10.0.1.5"
            style={{ width: '100%', background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: '#4b4b4b', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 4 }}>DESTINATION SUBNET</label>
          <select
            value={destSub} onChange={e => setDestSub(e.target.value)}
            style={{ width: '100%', background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: '#4b4b4b', outline: 'none', boxSizing: 'border-box' }}
          >
            <option value="">Select subnet…</option>
            {allSubnets.map(s => (
              <option key={`${s.vnetName}/${s.name}`} value={`${s.vnetName}/${s.name}`}>
                {s.name} ({s.addressPrefix})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 4 }}>PORT</label>
            <input
              value={port} onChange={e => setPort(e.target.value)}
              placeholder="443"
              style={{ width: '100%', background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: '#4b4b4b', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 4 }}>PROTOCOL</label>
            <select
              value={proto} onChange={e => setProto(e.target.value)}
              style={{ width: '100%', background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: '#4b4b4b', outline: 'none', boxSizing: 'border-box' }}
            >
              <option>TCP</option><option>UDP</option><option>Any</option>
            </select>
          </div>
        </div>

        <button
          onClick={run}
          disabled={!srcIp || !destSub || !port}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: (!srcIp || !destSub || !port) ? '#e2e8f0' : '#0078d4',
            color: (!srcIp || !destSub || !port) ? '#334155' : '#fff',
            border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 12, fontWeight: 700,
            cursor: (!srcIp || !destSub || !port) ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <Play style={{ width: 12, height: 12 }} /> Simulate
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 12, background: verdictColor + '10', border: `1px solid ${verdictColor}30`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: verdictColor, letterSpacing: '-0.02em' }}>
              {result.verdict}
            </span>
            {result.verdict === 'ALLOWED' && <CheckCircle style={{ color: verdictColor, width: 16, height: 16 }} />}
            {result.verdict === 'DENIED'  && <X style={{ color: verdictColor, width: 16, height: 16 }} />}
            {result.verdict === 'NO_NSG'  && <AlertTriangle style={{ color: verdictColor, width: 16, height: 16 }} />}
          </div>
          <p style={{ fontSize: 11, color: verdictColor, marginBottom: 4 }}>{result.reason}</p>
          {result.matchedRule && (
            <div style={{ background: '#f3f2f1', borderRadius: 6, padding: '7px 10px', marginTop: 6 }}>
              <p style={{ fontSize: 10, color: '#475569', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matched Rule</p>
              <p style={{ fontSize: 11, color: '#4b4b4b', fontFamily: 'monospace' }}>{result.matchedRule.name}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {[
                  { k: 'Priority', v: String(result.matchedRule.priority) },
                  { k: 'Source', v: result.matchedRule.source },
                  { k: 'Port', v: result.matchedRule.destPort },
                  { k: 'Action', v: result.matchedRule.access },
                ].map(({ k, v }) => (
                  <span key={k} style={{ fontSize: 10, color: '#475569' }}>
                    <span style={{ color: '#334155' }}>{k}:</span>{' '}
                    <span style={{ color: result.matchedRule!.access === 'Allow' ? '#15803d' : '#dc2626', fontFamily: 'monospace' }}>{v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <p style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>Checked {result.checkedRules} rule{result.checkedRules !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — NSG detail panel (right)
// ─────────────────────────────────────────────────────────────────────────────

function NsgDetailPanel({ name, detail, subnet, onClose }: { name: string; detail: NsgDetail; subnet: Subnet; onClose: () => void }) {
  const risk = detail.riskLevel as keyof typeof RC
  const c    = RC[risk]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff', borderLeft: '1px solid #edebe9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #edebe9', flexShrink: 0 }}>
        <Shield style={{ color: c.border, width: 15, height: 15 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#323130', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ background: c.border + '20', color: c.border, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase' }}>{risk}</span>
        <button onClick={onClose} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {(risk === 'critical' || risk === 'high') && (
        <div style={{ margin: '10px 12px 0', background: c.border + '10', border: `1px solid ${c.border}25`, borderRadius: 8, padding: '8px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <AlertTriangle style={{ color: c.border, width: 12, height: 12, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: c.border, lineHeight: 1.5 }}>
              {risk === 'critical' ? 'Allow-all inbound rule active. This subnet accepts connections from any source on any port.' : 'Internet-facing management ports open. Remote access services should not be exposed to 0.0.0.0/0.'}
            </p>
          </div>
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
        {(['inbound', 'outbound'] as const).map(dir => {
          const rules: NsgRule[] = detail[dir]
          return (
            <div key={dir} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155', marginBottom: 8 }}>
                {dir} ({rules.length})
              </p>
              <div style={{ border: '1px solid #edebe9', borderRadius: 8, overflow: 'hidden' }}>
                {rules.map((r, i) => {
                  const isAllow   = r.access === 'Allow'
                  const isDanger  = isAllow && isPublicSource(r.source)
                  const isAllPort = r.destPort === '*'
                  const mgmtLabel = MGMT_PORTS[r.destPort]
                  return (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '38px 1fr 90px 60px 64px',
                      gap: 0,
                      borderBottom: i < rules.length - 1 ? '1px solid #edebe9' : 'none',
                      background: isDanger && (isAllPort || mgmtLabel) ? '#fef2f2' : i % 2 === 0 ? '#f3f2f1' : 'transparent',
                      padding: '6px 10px',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{r.priority}</span>
                      <span style={{ fontSize: 11, color: isDanger && (isAllPort || mgmtLabel) ? '#dc2626' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                        {r.name}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: isDanger ? '#dc2626' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.source}>
                        {r.source}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569' }}>
                        {r.destPort}{mgmtLabel && <span style={{ color: '#ef4444', marginLeft: 2 }}>({mgmtLabel})</span>}
                      </span>
                      <span>
                        <span style={{
                          background: isAllow ? '#dcfce7' : '#fee2e2',
                          color: isAllow ? '#15803d' : '#dc2626',
                          fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        }}>{r.access}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — VNet detail panel (right)
// ─────────────────────────────────────────────────────────────────────────────

function VNetDetailPanel({ vnet, peerings, onClose }: { vnet: VNet; peerings: VNetPeering[]; onClose: () => void }) {
  const risk = vnetRisk(vnet)
  const c    = RC[risk]
  const myP  = peerings.filter(p => p.fromVnet === vnet.name || p.toVnet === vnet.name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff', borderLeft: '1px solid #edebe9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #edebe9', flexShrink: 0 }}>
        <Waypoints style={{ color: c.border, width: 15, height: 15 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#323130', flex: 1 }}>{vnet.name}</span>
        {vnet.role === 'hub' && <span style={{ background: '#eff6ff', color: '#0078d4', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>HUB</span>}
        <button onClick={onClose} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '14px 16px' }}>
        {/* meta */}
        <div style={{ display: 'grid', rowGap: 7, marginBottom: 18 }}>
          {[
            { k: 'Address Space', v: vnet.addressSpace.join(', ') },
            { k: 'Location',      v: vnet.location },
            { k: 'Resource Group', v: vnet.resourceGroup },
            { k: 'DNS Servers',   v: vnet.dnsServers.length ? vnet.dnsServers.join(', ') : 'Azure Default' },
          ].map(({ k, v }) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#475569' }}>{k}</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#4b4b4b', textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* subnets */}
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155', marginBottom: 8 }}>Subnets ({vnet.subnets.length})</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
          {vnet.subnets.map(s => {
            const sr = subnetRisk(s)
            const sc = RC[sr]
            return (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', borderRadius: 6, padding: '7px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.border, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#4b4b4b', flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#334155' }}>{s.addressPrefix}</span>
                {!s.nsg && <ShieldOff style={{ color: '#f59e0b', width: 11, height: 11 }} />}
              </div>
            )
          })}
        </div>

        {/* peerings */}
        {myP.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155', marginBottom: 8 }}>Peerings ({myP.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {myP.map(p => {
                const other = p.fromVnet === vnet.name ? p.toVnet : p.fromVnet
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', borderRadius: 6, padding: '7px 10px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.state === 'Connected' ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#4b4b4b', flex: 1 }}>{other}</span>
                    <span style={{ fontSize: 10, color: '#334155' }}>{p.allowGatewayTransit ? 'GW Transit' : 'Direct'}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: p.state === 'Connected' ? '#15803d' : '#dc2626' }}>{p.state}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — React Flow canvases
// ─────────────────────────────────────────────────────────────────────────────

type PanelState = { type: 'nsg'; name: string; detail: NsgDetail; subnet: Subnet } | { type: 'vnet'; vnet: VNet } | null

function PeeringCanvas({ topology, onVnetClick, selectedVnet, highlightedNode }: {
  topology: NetworkTopology; onVnetClick: (v: VNet) => void
  selectedVnet: string | null; highlightedNode: string | null
}) {
  const { nodes: n0, edges: e0 } = useMemo(
    () => buildPeeringNodes(topology.vnets, topology.peerings, onVnetClick, selectedVnet, highlightedNode),
    [topology, selectedVnet, highlightedNode],
  )
  const [nodes, , onNC] = useNodesState(n0)
  const [edges, , onEC] = useEdgesState(e0)
  useEffect(() => { /* nodes updated via useMemo re-render */ }, [n0])

  return (
    <ReactFlow nodes={n0} edges={e0} onNodesChange={onNC} onEdgesChange={onEC}
      nodeTypes={NODE_TYPES} fitView fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3} maxZoom={2.5} proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} color="#e2e8f0" gap={24} size={1} />
      <Controls style={{ background: '#ffffff', border: '1px solid #edebe9', borderRadius: 8 }} />
      <MiniMap style={{ background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: 8 }}
        nodeColor={n => RC[(n.data as { risk?: string }).risk as keyof typeof RC]?.border ?? '#334155'}
        maskColor="#f3f2f199" />
      <Panel position="top-right">
        <div style={{ display: 'flex', gap: 16, background: '#ffffff', border: '1px solid #edebe9', borderRadius: 8, padding: '6px 12px' }}>
          {[{ color: '#0078d4', dash: false, label: 'GW Transit' }, { color: '#334155', dash: true, label: 'Direct' }].map(({ color, dash, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
              <svg width={22} height={8}><line x1={0} y1={4} x2={22} y2={4} stroke={color} strokeWidth={1.5} strokeDasharray={dash ? '5 3' : undefined} /></svg>
              {label}
            </span>
          ))}
        </div>
      </Panel>
    </ReactFlow>
  )
}

function TopologyCanvas({ topology, rgFilter, onSubnetClick, onNsgClick, selectedId, highlightedNode, activeNsg }: {
  topology: NetworkTopology; rgFilter: string
  onSubnetClick: (s: Subnet, v: VNet) => void
  onNsgClick: (name: string, d: NsgDetail, s: Subnet) => void
  selectedId: string | null; highlightedNode: string | null; activeNsg: string | null
}) {
  const vnets = rgFilter === 'all' ? topology.vnets : topology.vnets.filter(v => v.resourceGroup === rgFilter)
  const { nodes: n0, edges: e0 } = useMemo(
    () => buildTopologyNodes(vnets, onSubnetClick, onNsgClick, selectedId, highlightedNode, activeNsg),
    [vnets, selectedId, highlightedNode, activeNsg],
  )

  return (
    <ReactFlow nodes={n0} edges={e0} nodeTypes={NODE_TYPES}
      fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.2} maxZoom={2.5}
      proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Lines} color="#e2e8f040" gap={32} />
      <Controls style={{ background: '#ffffff', border: '1px solid #edebe9', borderRadius: 8 }} />
      <MiniMap style={{ background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: 8 }}
        nodeColor={n => RC[(n.data as { risk?: string }).risk as keyof typeof RC]?.border ?? '#e2e8f0'}
        maskColor="#f3f2f199" />
      <Panel position="top-right">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', background: '#ffffff', border: '1px solid #edebe9', borderRadius: 8, padding: '6px 12px' }}>
          {[['#ef4444','Critical'],['#f97316','High'],['#f59e0b','No NSG'],['#22c55e','Secure']].map(([color, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />{label}
            </span>
          ))}
        </div>
      </Panel>
    </ReactFlow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [topology, setTopology] = useState<NetworkTopology | null>(null)
  const [error,    setError]    = useState(false)
  const [mode,     setMode]     = useState<'peering' | 'topology'>('peering')
  const [rgFilter, setRgFilter] = useState('all')
  const [panel,    setPanel]    = useState<PanelState>(null)
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  const [issueFilter,     setIssueFilter]     = useState<'all' | 'critical' | 'high' | 'medium'>('all')
  const [simOpen,         setSimOpen]         = useState(false)

  useEffect(() => {
    api.networkTopology().then(setTopology).catch(() => setError(true))
  }, [])

  const issues = useMemo(() => topology ? scanIssues(topology.vnets) : [], [topology])

  const filteredIssues = useMemo(
    () => issueFilter === 'all' ? issues : issues.filter(i => i.severity === issueFilter),
    [issues, issueFilter],
  )

  function handleIssueClick(issue: SecurityIssue) {
    setHighlightedNode(issue.nodeId)
    // switch to the right mode
    if (issue.nsgName && mode !== 'topology') setMode('topology')
    setTimeout(() => setHighlightedNode(null), 3000)
  }

  if (error) return <div style={{ padding: 32, color: '#64748b' }}>Backend offline — start the FastAPI server on port 8000.</div>

  if (!topology) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[260, 96, 'calc(100vh - 220px)'].map((h, i) => (
          <div key={i} style={{ height: h, background: '#e5e7eb', borderRadius: 12, animation: 'pulse 2s infinite' }} />
        ))}
      </div>
    )
  }

  const allSubnets  = topology.vnets.flatMap(v => v.subnets)
  const critCount   = issues.filter(i => i.severity === 'critical').length
  const highCount   = issues.filter(i => i.severity === 'high').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: '#f3f2f1' }}>

      {/* ── top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', borderBottom: '1px solid #edebe9', flexShrink: 0, flexWrap: 'wrap', rowGap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network style={{ color: '#0078d4', width: 18, height: 18 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#323130' }}>Network Topology</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#475569' }}>
          <span><span style={{ color: '#323130', fontWeight: 700 }}>{topology.vnets.length}</span> VNets</span>
          <span style={{ color: '#a19f9d' }}>·</span>
          <span><span style={{ color: '#323130', fontWeight: 700 }}>{allSubnets.length}</span> Subnets</span>
          <span style={{ color: '#a19f9d' }}>·</span>
          <span><span style={{ color: '#323130', fontWeight: 700 }}>{topology.peerings.length}</span> Peerings</span>
          {critCount > 0 && <>
            <span style={{ color: '#e2e8f0' }}>·</span>
            <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle style={{ width: 12, height: 12 }} />{critCount} critical
            </span>
          </>}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {mode === 'topology' && (
            <select
              value={rgFilter} onChange={e => setRgFilter(e.target.value)}
              style={{ background: '#ffffff', border: '1px solid #edebe9', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: '#4b4b4b', outline: 'none' }}
            >
              <option value="all">All Resource Groups</option>
              {topology.resourceGroups.map(rg => <option key={rg} value={rg}>{rg}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', background: '#ffffff', border: '1px solid #edebe9', borderRadius: 8, padding: 2 }}>
            {([['peering','Peering Map',Network],['topology','Subnet Topology',Waypoints]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setMode(id); setPanel(null); setSelectedId(null); setHighlightedNode(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: mode === id ? '#eff6ff' : 'transparent',
                  color: mode === id ? '#0078d4' : '#475569',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                <Icon style={{ width: 13, height: 13 }} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── body: left panel + canvas + right panel ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── LEFT: issues + simulator ── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #edebe9', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>

          {/* simulator toggle */}
          <div style={{ borderBottom: '1px solid #edebe9' }}>
            <button
              onClick={() => setSimOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer', color: simOpen ? '#60a5fa' : '#475569',
                borderBottom: simOpen ? '1px solid #edebe9' : 'none',
              }}
            >
              <Zap style={{ width: 13, height: 13, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left' }}>
                Traffic Simulator
              </span>
              {simOpen ? <ChevronDown style={{ width: 13, height: 13 }} /> : <ChevronRight style={{ width: 13, height: 13 }} />}
            </button>
            {simOpen && <TrafficSimulator vnets={topology.vnets} />}
          </div>

          {/* issues header */}
          <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid #edebe9', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4b4b4b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Security Findings
              </span>
              <span style={{ background: critCount > 0 ? '#fee2e2' : '#f3f2f1', color: critCount > 0 ? '#dc2626' : '#605e5c', fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999 }}>
                {issues.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all','critical','high','medium'] as const).map(f => (
                <button key={f} onClick={() => setIssueFilter(f)}
                  style={{
                    padding: '2px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                    background: issueFilter === f ? '#eff6ff' : 'transparent',
                    color: issueFilter === f ? '#0078d4' : '#334155',
                    textTransform: 'capitalize',
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* issues list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {filteredIssues.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                <CheckCircle style={{ color: '#22c55e', width: 28, height: 28, margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: '#334155' }}>No issues found</p>
              </div>
            ) : (
              filteredIssues.map(issue => (
                <IssueItem
                  key={issue.id}
                  issue={issue}
                  active={highlightedNode === issue.nodeId}
                  onClick={() => handleIssueClick(issue)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── CENTER: React Flow canvas ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {mode === 'peering' && (
            <PeeringCanvas
              topology={topology}
              onVnetClick={v => { setPanel({ type: 'vnet', vnet: v }); setSelectedId(v.name) }}
              selectedVnet={panel?.type === 'vnet' ? panel.vnet.name : null}
              highlightedNode={highlightedNode}
            />
          )}
          {mode === 'topology' && (
            <TopologyCanvas
              topology={topology}
              rgFilter={rgFilter}
              onSubnetClick={() => {}}
              onNsgClick={(name, detail, subnet) => { setPanel({ type: 'nsg', name, detail, subnet }); setSelectedId(`nsg-…-${name}`) }}
              selectedId={selectedId}
              highlightedNode={highlightedNode}
              activeNsg={panel?.type === 'nsg' ? panel.name : null}
            />
          )}
        </div>

        {/* ── RIGHT: detail panel ── */}
        {panel && (
          <div style={{ width: 320, flexShrink: 0 }}>
            {panel.type === 'nsg' && (
              <NsgDetailPanel name={panel.name} detail={panel.detail} subnet={panel.subnet}
                onClose={() => { setPanel(null); setSelectedId(null) }} />
            )}
            {panel.type === 'vnet' && (
              <VNetDetailPanel vnet={panel.vnet} peerings={topology.peerings}
                onClose={() => { setPanel(null); setSelectedId(null) }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
