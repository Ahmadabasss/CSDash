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
