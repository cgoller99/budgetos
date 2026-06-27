"use client";

import { Badge, FormField, Input, Select } from "@/components/ui";
import { TRANSACTION_CATEGORY_OPTIONS } from "@/lib/finance/transactionCategories";
import {
  DEFAULT_TRANSACTION_FILTERS,
  type TransactionFilterState,
} from "@/lib/transactions";

type TransactionFiltersProps = {
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
};

export function TransactionFilters({
  filters,
  onChange,
}: TransactionFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FormField label="Search">
        <Input
          type="search"
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
          placeholder="Category, notes, account..."
        />
      </FormField>

      <FormField label="Type">
        <Select
          value={filters.type}
          onChange={(event) =>
            onChange({
              ...filters,
              type: event.target.value as TransactionFilterState["type"],
            })
          }
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </Select>
      </FormField>

      <FormField label="Category">
        <Select
          value={filters.category}
          onChange={(event) =>
            onChange({ ...filters, category: event.target.value })
          }
        >
          <option value="all">All categories</option>
          {TRANSACTION_CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Sort">
        <Select
          value={`${filters.sortField}:${filters.sortDirection}`}
          onChange={(event) => {
            const [sortField, sortDirection] = event.target.value.split(":") as [
              TransactionFilterState["sortField"],
              TransactionFilterState["sortDirection"],
            ];
            onChange({ ...filters, sortField, sortDirection });
          }}
        >
          <option value="date:desc">Newest first</option>
          <option value="date:asc">Oldest first</option>
          <option value="amount:desc">Highest amount</option>
          <option value="amount:asc">Lowest amount</option>
        </Select>
      </FormField>
    </div>
  );
}

export { DEFAULT_TRANSACTION_FILTERS };
