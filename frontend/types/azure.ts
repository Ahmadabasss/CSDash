// ── Network Topology ─────────────────────────────────────────────────────────

export type NsgRisk = 'critical' | 'high' | 'medium' | 'low'

export interface NsgRule {
  name: string
  priority: number
  protocol: string
  source: string
  sourcePort: string
  dest: string
  destPort: string
  access: 'Allow' | 'Deny'
}

export interface NsgDetail {
  resourceGroup: string
  riskLevel: NsgRisk
  inbound: NsgRule[]
  outbound: NsgRule[]
}

export interface RouteDetail {
  resourceGroup: string
  routes: { name: string; addressPrefix: string; nextHopType: string; nextHopIp: string | null }[]
}

export interface SubnetResource {
  name: string
  type: string
}

export interface Subnet {
  name: string
  addressPrefix: string
  nsg: string | null
  routeTable: string | null
  purpose: string
  resourceCount: number
  resources: SubnetResource[]
  nsgDetail: NsgDetail | null
  rtDetail: RouteDetail | null
}

export interface VNet {
  id: string
  name: string
  resourceGroup: string
  location: string
  addressSpace: string[]
  role: 'hub' | 'spoke'
  dnsServers: string[]
  subnets: Subnet[]
}

export interface VNetPeering {
  id: string
  fromVnet: string
  toVnet: string
  state: 'Connected' | 'Disconnected' | 'Initiated'
  allowGatewayTransit: boolean
  useRemoteGateways: boolean
  allowForwardedTraffic: boolean
}

export interface NetworkTopology {
  resourceGroups: string[]
  vnets: VNet[]
  peerings: VNetPeering[]
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational'
export type AlertStatus = 'new' | 'inProgress' | 'resolved' | 'dismissed'

export interface AlertEvidence {
  '@odata.type': string
  resourceId?: string
  userAccount?: { accountName: string; userPrincipalName: string }
}

export interface Alert {
  id: string
  incidentId: string | null
  status: AlertStatus
  severity: Severity
  classification: string
  determination: string
  serviceSource: string
  detectionSource: string
  title: string
  description: string
  recommendedActions: string
  category: string
  assignedTo: string | null
  createdDateTime: string
  lastUpdateDateTime: string
  firstActivityDateTime: string
  lastActivityDateTime: string
  mitreTechniques: string[]
  evidence: AlertEvidence[]
}

export interface PaginatedAlerts {
  items: Alert[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface MitreSummaryRow {
  technique: string
  count: number
  severities: Record<string, number>
}

// ── Recommendations ───────────────────────────────────────────────────────────

export interface Recommendation {
  id: string
  name: string
  type: string
  properties: {
    displayName: string
    status: { code: string; cause: string | null; description: string }
    resourceDetails: { Source: string; Id: string; ResourceName: string; ResourceType: string }
    metadata: {
      severity: string
      categories: string[]
      userImpact: string
      implementationEffort: string
      threats: string[]
      description: string
      remediationDescription: string
    }
  }
}

export interface PaginatedRecommendations {
  items: Recommendation[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface CategoryCount {
  category: string
  count: number
}

// ── Vulnerabilities ───────────────────────────────────────────────────────────

export interface Vulnerability {
  id: string
  name: string
  description: string
  severity: string
  cvssV3: number
  exposedMachines: number
  publishedOn: string
  updatedOn: string
  publicExploit: boolean
  exploitInKit: boolean
  exploitTypes: string[]
  tags: string[]
}

// ── Compliance ────────────────────────────────────────────────────────────────

export interface ComplianceStandard {
  id: string
  name: string
  type: string
  properties: {
    state: string
    passedControls: number
    failedControls: number
    skippedControls: number
    unsupportedControls: number
  }
}

// ── Resources ─────────────────────────────────────────────────────────────────

export interface AzureResource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup: string
  subscriptionId: string
  tags: Record<string, string>
  secureScore: number
  issuesCount: number
  relatedAlerts?: Alert[]
  relatedRecommendations?: Recommendation[]
}

// ── Secure Score ──────────────────────────────────────────────────────────────

export interface ScoreHistory {
  date: string
  percentage: number
}

export interface SecureScore {
  value: Array<{
    id: string
    name: string
    properties: {
      displayName: string
      score: { max: number; current: number; percentage: number }
      weight: number
    }
  }>
  history: ScoreHistory[]
}

// ── Sign-ins ──────────────────────────────────────────────────────────────────

export interface SignIn {
  id: string
  createdDateTime: string
  userDisplayName: string
  userPrincipalName: string
  ipAddress: string
  clientAppUsed: string
  appDisplayName: string
  status: { errorCode: number; failureReason: string }
  location: { city: string; state: string | null; countryOrRegion: string }
  riskLevelAggregated: string
  riskState: string
}

export interface RiskSummary {
  total: number
  risky: number
  failed: number
  riskByLevel: Record<string, number>
  topRiskyIps: Array<{ ip: string; count: number }>
  topCountries: Array<{ country: string; count: number }>
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface SeverityBucket {
  high: number
  medium: number
  low: number
  total: number
}

export interface Summary {
  secureScorePct: number
  openAlerts: SeverityBucket
  unhealthyRecommendations: SeverityBucket
  exploitableCves: number
  totalResources: number
  complianceFailingControls: number
}

// ── Scenario ──────────────────────────────────────────────────────────────────

export type Scenario = 'noisy' | 'compromised' | 'secured'

// ── Endpoints (MDE) ───────────────────────────────────────────────────────────

export interface Endpoint {
  id: string
  computerDnsName: string
  osPlatform: string
  osVersion: string
  healthStatus: string
  onboardingStatus: string
  riskScore: string
  exposureLevel: string
  rbacGroupName: string
  lastSeen: string
  vulnerabilitiesCount: number
  missingCriticalPatches: number
  antivirusStatus: string
  firewallEnabled: boolean
  machineTags: string[]
  isAadJoined: boolean
}

export interface PaginatedEndpoints {
  items: Endpoint[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface EndpointSummary {
  total: number
  onboarded: number
  highRisk: number
  byRisk: Record<string, number>
  byHealth: Record<string, number>
  byOs: Record<string, number>
  totalVulnerabilities: number
}

// ── Virtual Machines ──────────────────────────────────────────────────────────

export interface VirtualMachine {
  id: string
  name: string
  resourceGroup: string
  location: string
  tags?: Record<string, string>
  properties: {
    osType: string
    osName: string
    vmSize: string
    powerState: string
  }
  securityProfile: {
    mdeEnrolled: boolean
    mdeStatus: string
    agentHealth: string
    patchStatus: {
      state: string
      criticalAndSecurityPatchCount: number
      lastAssessmentTime: string
    }
    vulnerabilityCount: number
    secureScore: number
    diskEncrypted: boolean
    justInTimeAccess: boolean
  }
}

export interface PaginatedVMs {
  items: VirtualMachine[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface VMSummary {
  total: number
  running: number
  patchIssues: number
  notMdeEnrolled: number
  noEncryption: number
  byPatchStatus: Record<string, number>
  byOs: Record<string, number>
  totalVulnerabilities: number
}

// ── Incidents (Sentinel) ──────────────────────────────────────────────────────

export interface IncidentEntity {
  type: string
  name: string
}

export interface Incident {
  id: string
  displayName: string
  incidentNumber: number
  severity: string
  status: string
  classification: string
  determination: string
  assignedTo: string | null
  createdDateTime: string
  firstActivityDateTime: string
  lastActivityDateTime: string
  lastModifiedDateTime: string
  alertsCount: number
  bookmarks: number
  comments: number
  tactics: string[]
  tags: string[]
  entities: IncidentEntity[]
}

export interface PaginatedIncidents {
  items: Incident[]
  total: number
  page: number
  limit: number
  pages: number
}

// ── Risky Users (Entra ID) ────────────────────────────────────────────────────

export interface RiskyUser {
  id: string
  userPrincipalName: string
  userDisplayName: string
  riskLevel: string
  riskState: string
  riskLastUpdatedDateTime: string
  riskDetail: string
  department: string
  jobTitle: string
  signInCount: number
  riskySignInCount: number
}

export interface RiskyUserSummary {
  total: number
  atRisk: number
  confirmedCompromised: number
  byLevel: Record<string, number>
  byState: Record<string, number>
}

// ── Compliance Controls ───────────────────────────────────────────────────────

export interface ComplianceControl {
  id: string
  description: string
  state: 'Passed' | 'Failed' | 'Skipped'
}

// ── Blast Radius ──────────────────────────────────────────────────────────────

export interface BlastRadiusNode extends AzureResource {
  relationship: 'shared-alert' | 'same-rg'
  sharedAlertCount: number
  risk: 'high' | 'medium' | 'low'
}

export interface BlastRadiusData {
  center: AzureResource
  nodes: BlastRadiusNode[]
  affectedUsers: { userPrincipalName: string; accountName: string; alertCount: number }[]
  centerAlerts: { id: string; title: string; severity: string }[]
  summary: {
    resourcesAtRisk: number
    centerAlertCount: number
    affectedUserCount: number
    severities: Record<string, number>
  }
}

// ── Orphaned Resources ────────────────────────────────────────────────────────

export type OrphanRisk = 'Critical' | 'High' | 'Medium'
export type OrphanCategory = 'deallocated_vm' | 'exposed_public_ip' | 'stale_nsg' | 'abandoned_storage'

export interface OrphanItem {
  id: string
  name: string
  category: OrphanCategory
  risk: OrphanRisk
  resourceGroup: string
  location: string
  age_days: number
  last_seen: string
  detail: Record<string, unknown>
  why_dangerous: string
  remediation: string[]
}

export interface OrphanReport {
  total: number
  critical: number
  high: number
  medium: number
  by_category: Record<OrphanCategory, number>
  items: OrphanItem[]
}
