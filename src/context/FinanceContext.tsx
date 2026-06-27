import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Account, NewAccount } from '../types/finance'
import { CASH_ACCOUNT_TYPES } from '../types/finance'

interface FinanceContextValue {
  accounts: Account[]
  addAccount: (account: NewAccount) => void
  netWorth: number
  totalCash: number
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

function createId(): string {
  return crypto.randomUUID()
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])

  const addAccount = useCallback((account: NewAccount) => {
    setAccounts((prev) => [
      ...prev,
      {
        ...account,
        id: createId(),
      },
    ])
  }, [])

  const netWorth = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  )

  const totalCash = useMemo(
    () =>
      accounts
        .filter((account) => CASH_ACCOUNT_TYPES.includes(account.type))
        .reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  )

  const value = useMemo(
    () => ({
      accounts,
      addAccount,
      netWorth,
      totalCash,
    }),
    [accounts, addAccount, netWorth, totalCash],
  )

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  )
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext)
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider')
  }
  return context
}
