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

  resources: () => fetchJSON<import('../types/azure').AzureResource[]>('/api/resources'),
  resource: (id: string) =>
    fetchJSON<import('../types/azure').AzureResource>(`/api/resources/${encodeURIComponent(id)}`),

  signins: () => fetchJSON<import('../types/azure').SignIn[]>('/api/signins'),
  riskSummary: () => fetchJSON<import('../types/azure').RiskSummary>('/api/signins/risk-summary'),

  scenario: () => fetchJSON<{ scenario: string }>('/api/scenario'),
  setScenario: (scenario: string) =>
    fetchJSON<{ scenario: string; message: string }>('/api/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    }),
}
