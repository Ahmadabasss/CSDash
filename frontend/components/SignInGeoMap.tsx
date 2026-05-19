'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import type { RiskSummary } from '@/types/azure'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ISO 3166-1 alpha-2 → numeric codes used by world-atlas
const ISO2_TO_NUMERIC: Record<string, number> = {
  US: 840, GB: 826, DE: 276, FR: 250, CA: 124, AU: 36,  JP: 392, CN: 156,
  IN: 356, BR: 76,  RU: 643, NG: 566, ZA: 710, SG: 702, KR: 410, MX: 484,
  IT: 380, ES: 724, NL: 528, SE: 752, NO: 578, FI: 246, DK: 208, PL: 616,
  UA: 804, TR: 792, SA: 682, AE: 784, IL: 376, EG: 818, AR: 32,  CL: 152,
  CO: 170, PH: 608, TH: 764, VN: 704, ID: 360, MY: 458, PK: 586, BD: 50,
  NZ: 554, CH: 756, AT: 40,  BE: 56,  PT: 620, CZ: 203, HU: 348, RO: 642,
  BG: 100, HR: 191, SK: 703, SI: 705, RS: 688, GR: 300, IE: 372,
}

interface Props {
  riskSummary: RiskSummary
  /** ISO 3166-1 alpha-2 code of the currently selected sign-in country */
  highlighted?: string
}

export default function SignInGeoMap({ riskSummary, highlighted }: Props) {
  const [tooltip, setTooltip] = useState<{ country: string; count: number } | null>(null)

  const highlightedNumeric = highlighted ? ISO2_TO_NUMERIC[highlighted] : null
  const countByNumeric: Record<number, number> = {}
  const maxCount = riskSummary.topCountries[0]?.count ?? 1

  riskSummary.topCountries.forEach(({ country, count }) => {
    const numeric = ISO2_TO_NUMERIC[country]
    if (numeric) countByNumeric[numeric] = count
  })

  function fillColor(numericId: number): string {
    if (numericId === highlightedNumeric) return '#f0abfc' // violet-300 — selected
    const count = countByNumeric[numericId]
    if (!count) return '#1e293b'
    const intensity = count / maxCount
    if (intensity > 0.7) return '#dc2626'
    if (intensity > 0.4) return '#ea580c'
    if (intensity > 0.15) return '#d97706'
    return '#0369a1'
  }

  function strokeWidth(numericId: number): number {
    return numericId === highlightedNumeric ? 2 : 0.5
  }

  function strokeColor(numericId: number): string {
    return numericId === highlightedNumeric ? '#c026d3' : '#0f172a'
  }

  function labelFor(numericId: number): { country: string; count: number } | null {
    const entry = riskSummary.topCountries.find(
      c => ISO2_TO_NUMERIC[c.country] === numericId
    )
    return entry ?? null
  }

  return (
    <div className="relative">
      <ComposableMap
        projection="geoNaturalEarth1"
        style={{ width: '100%', height: 'auto' }}
        projectionConfig={{ scale: 140 }}
      >
        <ZoomableGroup center={[0, 20]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: { rsmKey: string; id: string }[] }) =>
              geographies.map(geo => {
                const numericId = parseInt(geo.id, 10)
                const fill = fillColor(numericId)
                const isHighlighted = numericId === highlightedNumeric
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={strokeColor(numericId)}
                    strokeWidth={strokeWidth(numericId)}
                    onMouseEnter={() => {
                      const entry = labelFor(numericId)
                      if (entry) setTooltip(entry)
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: { outline: 'none', opacity: highlighted && !isHighlighted ? 0.5 : 1 },
                      hover: { fill: fill === '#1e293b' ? '#334155' : fill, outline: 'none', opacity: 0.85 },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute top-2 right-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs ring-1 ring-slate-700 pointer-events-none">
          <span className="font-semibold text-slate-200">{tooltip.country}</span>
          <span className="ml-2 text-slate-400">{tooltip.count} sign-ins</span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
        <span>Volume:</span>
        {[
          { color: 'bg-sky-700', label: 'Low' },
          { color: 'bg-amber-600', label: 'Med' },
          { color: 'bg-red-600', label: 'High' },
          { color: 'bg-violet-400', label: 'Selected' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-sm ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
