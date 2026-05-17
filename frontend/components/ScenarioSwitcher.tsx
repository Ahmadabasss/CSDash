'use client'

import { useEffect, useState, useTransition } from 'react'
import { api } from '@/lib/api'
import type { Scenario } from '@/types/azure'
import clsx from 'clsx'

const SCENARIOS: { value: Scenario; label: string; score: string; color: string }[] = [
  { value: 'secured',    label: 'Secured',    score: '~78%', color: 'text-emerald-400' },
  { value: 'noisy',      label: 'Noisy',      score: '~55%', color: 'text-amber-400'   },
  { value: 'compromised',label: 'Compromised',score: '~32%', color: 'text-red-400'     },
]

export default function ScenarioSwitcher({ onSwitch }: { onSwitch?: () => void }) {
  const [current, setCurrent] = useState<Scenario>('noisy')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    api.scenario().then(r => setCurrent(r.scenario as Scenario)).catch(() => {})
  }, [])

  function switchTo(scenario: Scenario) {
    startTransition(async () => {
      await api.setScenario(scenario)
      setCurrent(scenario)
      onSwitch?.()
    })
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-800/60 p-1 ring-1 ring-slate-700">
      <span className="px-2 text-xs text-slate-500 font-medium">Scenario</span>
      {SCENARIOS.map(s => (
        <button
          key={s.value}
          onClick={() => switchTo(s.value)}
          disabled={pending}
          className={clsx(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            current === s.value
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <span className={current === s.value ? s.color : ''}>{s.label}</span>
          <span className="ml-1 text-slate-500">{s.score}</span>
        </button>
      ))}
    </div>
  )
}
