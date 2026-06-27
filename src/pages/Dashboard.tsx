import { useFinance } from '../context/FinanceContext'
import { MetricCard } from '../components/dashboard/MetricCard'

export function Dashboard() {
  const { netWorth, totalCash, accounts } = useFinance()

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your financial overview at a glance
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <MetricCard
          label="Net Worth"
          value={netWorth}
          icon="💎"
          accent="blue"
          delay={0}
        />
        <MetricCard
          label="Cash"
          value={totalCash}
          icon="💵"
          accent="emerald"
          delay={80}
        />
      </div>

      {accounts.length === 0 && (
        <div
          className="
            mt-10 rounded-2xl border border-dashed border-gray-200 bg-white p-12
            text-center animate-slide-up
          "
          style={{ animationDelay: '160ms' }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-2xl">
            🏦
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No accounts yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add your first account to start tracking your finances
          </p>
        </div>
      )}
    </div>
  )
}
