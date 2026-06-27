import { useState, type FormEvent } from 'react'
import type { AccountType } from '../../types/finance'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../types/finance'
import { useFinance } from '../../context/FinanceContext'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'

interface AddAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

interface FormState {
  name: string
  institution: string
  type: AccountType
  balance: string
}

const initialForm: FormState = {
  name: '',
  institution: '',
  type: 'checking',
  balance: '',
}

export function AddAccountModal({ isOpen, onClose }: AddAccountModalProps) {
  const { addAccount } = useFinance()
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const resetForm = () => {
    setForm(initialForm)
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Account name is required'
    }
    if (!form.institution.trim()) {
      newErrors.institution = 'Institution is required'
    }
    if (!form.balance.trim()) {
      newErrors.balance = 'Balance is required'
    } else if (isNaN(Number(form.balance))) {
      newErrors.balance = 'Enter a valid number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    addAccount({
      name: form.name.trim(),
      institution: form.institution.trim(),
      type: form.type,
      balance: Number(form.balance),
    })

    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Account Name"
          placeholder="e.g. Primary Checking"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          error={errors.name}
          autoFocus
        />

        <Input
          label="Institution"
          placeholder="e.g. Chase Bank"
          value={form.institution}
          onChange={(e) => setForm((prev) => ({ ...prev, institution: e.target.value }))}
          error={errors.institution}
        />

        <Select
          label="Account Type"
          value={form.type}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, type: e.target.value as AccountType }))
          }
          options={ACCOUNT_TYPES.map((type) => ({
            value: type,
            label: ACCOUNT_TYPE_LABELS[type],
          }))}
        />

        <Input
          label="Current Balance"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={form.balance}
          onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
          error={errors.balance}
        />

        <div className="mt-2 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Save Account
          </Button>
        </div>
      </form>
    </Modal>
  )
}
