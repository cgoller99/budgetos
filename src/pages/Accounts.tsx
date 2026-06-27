import { useState } from 'react'
import { useFinance } from '../context/FinanceContext'
import { AccountCard } from '../components/accounts/AccountCard'
import { AddAccountModal } from '../components/accounts/AddAccountModal'
import { Button } from '../components/ui/Button'

export function Accounts() {
  const { accounts } = useFinance()
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your financial accounts in one place
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div
          className="
            rounded-2xl border border-dashed border-gray-200 bg-white p-16
            text-center animate-slide-up
          "
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
            🏦
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No accounts yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Connect your bank accounts, credit cards, and investments to get a complete
            picture of your finances.
          </p>
          <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, index) => (
            <AccountCard key={account.id} account={account} index={index} />
          ))}
        </div>
      )}

      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
