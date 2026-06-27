import type { ReactNode } from 'react'
import { formatCurrency } from '../../utils/format'

interface MetricCardProps {
  label: string
  value: number
  icon: ReactNode
  accent?: 'blue' | 'emerald' | 'violet'
  delay?: number
}

const accentStyles = {
  blue: 'from-blue-500/10 to-blue-600/5 text-blue-600',
  emerald: 'from-emerald-500/10 to-emerald-600/5 text-emerald-600',
  violet: 'from-violet-500/10 to-violet-600/5 text-violet-600',
}

export function MetricCard({
  label,
  value,
  icon,
  accent = 'blue',
  delay = 0,
}: MetricCardProps) {
  return (
    <div
      className="
        relative overflow-hidden rounded-2xl border border-gray-100 bg-white
        p-6 shadow-sm transition-all duration-300 ease-out
        hover:-translate-y-0.5 hover:shadow-md
        animate-slide-up
      "
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`
          absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br opacity-50
          ${accentStyles[accent]}
        `}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
            {formatCurrency(value)}
          </p>
        </div>
        <div
          className={`
            flex h-10 w-10 items-center justify-center rounded-xl
            bg-gradient-to-br text-lg
            ${accentStyles[accent]}
          `}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
