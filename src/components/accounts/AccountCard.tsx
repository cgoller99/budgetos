import type { Account } from '../../types/finance'
import { ACCOUNT_TYPE_LABELS } from '../../types/finance'
import { formatCurrency } from '../../utils/format'

const typeIcons: Record<Account['type'], string> = {
  checking: '🏦',
  savings: '💰',
  credit_card: '💳',
  investment: '📈',
  crypto: '₿',
  cash: '💵',
}

const typeColors: Record<Account['type'], string> = {
  checking: 'from-blue-500/10 to-blue-600/5 text-blue-600',
  savings: 'from-emerald-500/10 to-emerald-600/5 text-emerald-600',
  credit_card: 'from-violet-500/10 to-violet-600/5 text-violet-600',
  investment: 'from-amber-500/10 to-amber-600/5 text-amber-600',
  crypto: 'from-orange-500/10 to-orange-600/5 text-orange-600',
  cash: 'from-teal-500/10 to-teal-600/5 text-teal-600',
}

interface AccountCardProps {
  account: Account
  index: number
}

export function AccountCard({ account, index }: AccountCardProps) {
  const isNegative = account.balance < 0

  return (
    <div
      className="
        group relative overflow-hidden rounded-2xl border border-gray-100 bg-white
        p-6 shadow-sm transition-all duration-300 ease-out
        hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/50
        animate-slide-up
      "
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        className={`
          absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br opacity-60
          transition-transform duration-500 ease-out group-hover:scale-110
          ${typeColors[account.type]}
        `}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`
              flex h-11 w-11 items-center justify-center rounded-xl
              bg-gradient-to-br text-lg
              ${typeColors[account.type]}
            `}
          >
            {typeIcons[account.type]}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{account.name}</h3>
            <p className="text-sm text-gray-500">{account.institution}</p>
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex items-end justify-between">
        <span
          className={`
            inline-flex rounded-lg px-2.5 py-1 text-xs font-medium
            bg-gradient-to-br ${typeColors[account.type]}
          `}
        >
          {ACCOUNT_TYPE_LABELS[account.type]}
        </span>
        <p
          className={`
            text-xl font-semibold tracking-tight tabular-nums
            ${isNegative ? 'text-red-600' : 'text-gray-900'}
          `}
        >
          {formatCurrency(account.balance)}
        </p>
      </div>
    </div>
  )
}
