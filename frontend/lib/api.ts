const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  summary: () => fetchJSON<import('../types/azure').Summary>('/api/summary'),

  secureScore: () => fetchJSON<import('../types/azure').SecureScore>('/api/secure-score'),

  alerts: (params?: Record<string, string | number>) =>
    fetchJSON<import('../types/azure').PaginatedAlerts>(
      '/api/alerts?' + new URLSearchParams(params as Record<string, string>)
    ),
  alert: (id: string) => fetchJSON<import('../types/azure').Alert>(`/api/alerts/${id}`),
  mitreSummary: () => fetchJSON<import('../types/azure').MitreSummaryRow[]>('/api/alerts/mitre-summary'),

  recommendations: (params?: Record<string, string | number>) =>
    fetchJSON<import('../types/azure').PaginatedRecommendations>(
      '/api/recommendations?' + new URLSearchParams(params as Record<string, string>)
    ),
  recommendation: (id: string) =>
    fetchJSON<import('../types/azure').Recommendation>(`/api/recommendations/${encodeURIComponent(id)}`),
  recommendationCategories: () =>
    fetchJSON<import('../types/azure').CategoryCount[]>('/api/recommendations/categories'),

  vulnerabilities: () => fetchJSON<import('../types/azure').Vulnerability[]>('/api/vulnerabilities'),

  compliance: () => fetchJSON<import('../types/azure').ComplianceStandard[]>('/api/compliance'),
  complianceControls: (name: string) =>
    fetchJSON<import('../types/azure').ComplianceControl[]>(`/api/compliance/${encodeURIComponent(name)}/controls`),

  resources: () => fetchJSON<import('../types/azure').AzureResource[]>('/api/resources'),
  resource: (id: string) =>
    fetchJSON<import('../types/azure').AzureResource>(`/api/resources/${encodeURIComponent(id)}`),

  signins: () => fetchJSON<import('../types/azure').SignIn[]>('/api/signins'),
  signin: (id: string) => fetchJSON<import('../types/azure').SignIn>(`/api/signins/${encodeURIComponent(id)}`),
  riskSummary: () => fetchJSON<import('../types/azure').RiskSummary>('/api/signins/risk-summary'),

  endpoints: (params?: Record<string, string | number>) =>
    fetchJSON<import('../types/azure').PaginatedEndpoints>(
      '/api/endpoints?' + new URLSearchParams(params as Record<string, string>)
    ),
  endpoint: (id: string) => fetchJSON<import('../types/azure').Endpoint>(`/api/endpoints/${id}`),
  endpointSummary: () => fetchJSON<import('../types/azure').EndpointSummary>('/api/endpoints/summary'),

  virtualMachines: (params?: Record<string, string | number>) =>
    fetchJSON<import('../types/azure').PaginatedVMs>(
      '/api/virtual-machines?' + new URLSearchParams(params as Record<string, string>)
    ),
  virtualMachine: (id: string) => fetchJSON<import('../types/azure').VirtualMachine>(`/api/virtual-machines/${encodeURIComponent(id)}`),
  vmSummary: () => fetchJSON<import('../types/azure').VMSummary>('/api/virtual-machines/summary'),

  incidents: (params?: Record<string, string | number>) =>
    fetchJSON<import('../types/azure').PaginatedIncidents>(
      '/api/incidents?' + new URLSearchParams(params as Record<string, string>)
    ),
  incident: (id: string) => fetchJSON<import('../types/azure').Incident>(`/api/incidents/${id}`),

  riskyUsers: () => fetchJSON<import('../types/azure').RiskyUser[]>('/api/risky-users'),
  riskyUser: (id: string) => fetchJSON<import('../types/azure').RiskyUser>(`/api/risky-users/${id}`),
  riskyUserSummary: () => fetchJSON<import('../types/azure').RiskyUserSummary>('/api/risky-users/summary'),

  scenario: () => fetchJSON<{ scenario: string }>('/api/scenario'),
  setScenario: (scenario: string) =>
    fetchJSON<{ scenario: string; message: string }>('/api/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    }),

  blastRadius: (name: string) =>
    fetchJSON<import('../types/azure').BlastRadiusData>(`/api/blast-radius/${encodeURIComponent(name)}`),

  triage: (type: 'alert' | 'incident', id: string) =>
    fetchJSON<{ summary: string }>('/api/triage', {
      method: 'POST',
      body: JSON.stringify({ type, id }),
    }),

  orphans: () => fetchJSON<import('../types/azure').OrphanReport>('/api/orphans'),

  networkTopology: (rg?: string) =>
    fetchJSON<import('../types/azure').NetworkTopology>(
      `/api/network/topology${rg ? `?rg=${encodeURIComponent(rg)}` : ''}`
    ),
  networkNsg: (name: string) =>
    fetchJSON<import('../types/azure').NsgDetail & { name: string }>(`/api/network/nsg/${encodeURIComponent(name)}`),
}
