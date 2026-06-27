export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'crypto'
  | 'cash'

export interface Account {
  id: string
  name: string
  institution: string
  type: AccountType
  balance: number
}

export interface NewAccount {
  name: string
  institution: string
  type: AccountType
  balance: number
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  investment: 'Investment',
  crypto: 'Crypto',
  cash: 'Cash',
}

export const ACCOUNT_TYPES: AccountType[] = [
  'checking',
  'savings',
  'credit_card',
  'investment',
  'crypto',
  'cash',
]

export const CASH_ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'cash']
