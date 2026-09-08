/**
 * Presentation-only category normalization.
 * Preserves raw Plaid / ledger category strings in storage;
 * converts them to clean Buxme labels for UI and report grouping.
 */

export type DisplayCategory =
  | "Transfers"
  | "Credit Card Payment"
  | "Loan Payment"
  | "Shopping"
  | "Automotive"
  | "Groceries"
  | "Restaurants"
  | "Food & Drink"
  | "Travel"
  | "Entertainment"
  | "Healthcare"
  | "Insurance"
  | "Utilities"
  | "Rent"
  | "Mortgage"
  | "Home"
  | "Income"
  | "Payroll"
  | "Interest"
  | "Fees"
  | "Subscriptions"
  | "Personal Care"
  | "Education"
  | "Government"
  | "Gas"
  | "Transit"
  | "Bank Fees"
  | "Savings"
  | "Other";

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const EXACT_MAP: Record<string, DisplayCategory> = {
  TRANSFER: "Transfers",
  TRANSFERS: "Transfers",
  "TRANSFER IN": "Transfers",
  "TRANSFER OUT": "Transfers",
  "TRANSFER IN ACCOUNT TRANSFER": "Transfers",
  "TRANSFER OUT ACCOUNT TRANSFER": "Transfers",
  "TRANSFER IN SAVINGS": "Transfers",
  "TRANSFER OUT SAVINGS": "Transfers",
  "TRANSFER IN CHECKING": "Transfers",
  "TRANSFER OUT CHECKING": "Transfers",
  "TRANSFER IN DEPOSIT": "Transfers",
  "TRANSFER OUT WITHDRAWAL": "Transfers",
  "TRANSFER IN INVESTMENT AND RETIREMENT FUNDS": "Transfers",
  "TRANSFER OUT INVESTMENT AND RETIREMENT FUNDS": "Transfers",
  "LOAN PAYMENTS": "Loan Payment",
  "LOAN PAYMENTS CREDIT CARD PAYMENT": "Credit Card Payment",
  "LOAN PAYMENTS CAR PAYMENT": "Loan Payment",
  "LOAN PAYMENTS MORTGAGE PAYMENT": "Mortgage",
  "LOAN PAYMENTS STUDENT LOAN PAYMENT": "Loan Payment",
  "GENERAL MERCHANDISE": "Shopping",
  "GENERAL MERCHANDISE ONLINE MARKETPLACES": "Shopping",
  "GENERAL MERCHANDISE SUPERSTORES": "Shopping",
  "GENERAL MERCHANDISE CLOTHING AND ACCESSORIES": "Shopping",
  "GENERAL SERVICES": "Other",
  "GENERAL SERVICES AUTOMOTIVE": "Automotive",
  "GENERAL SERVICES OTHER GENERAL SERVICES": "Other",
  "FOOD AND DRINK": "Food & Drink",
  "FOOD AND DRINK GROCERIES": "Groceries",
  "FOOD AND DRINK RESTAURANT": "Restaurants",
  "FOOD AND DRINK COFFEE": "Restaurants",
  "FOOD AND DRINK FAST FOOD": "Restaurants",
  "TRANSPORTATION": "Transit",
  "TRANSPORTATION GAS": "Gas",
  "TRANSPORTATION PUBLIC TRANSIT": "Transit",
  "TRANSPORTATION TAXIS AND RIDE SHARES": "Transit",
  "TRAVEL": "Travel",
  "TRAVEL FLIGHTS": "Travel",
  "TRAVEL LODGING": "Travel",
  "ENTERTAINMENT": "Entertainment",
  "ENTERTAINMENT TV AND MOVIES": "Entertainment",
  "ENTERTAINMENT MUSIC AND AUDIO": "Entertainment",
  "MEDICAL": "Healthcare",
  "MEDICAL HEALTH INSURANCE": "Insurance",
  "RENT AND UTILITIES": "Utilities",
  "RENT AND UTILITIES RENT": "Rent",
  "RENT AND UTILITIES GAS AND ELECTRICITY": "Utilities",
  "RENT AND UTILITIES INTERNET AND CABLE": "Utilities",
  "RENT AND UTILITIES WATER": "Utilities",
  "HOME IMPROVEMENT": "Home",
  INCOME: "Income",
  "INCOME WAGES": "Payroll",
  "INCOME DIVIDENDS": "Interest",
  "INCOME INTEREST EARNED": "Interest",
  "BANK FEES": "Bank Fees",
  "BANK FEES ATM FEES": "Bank Fees",
  "BANK FEES OVERDRAFT FEES": "Bank Fees",
  "PERSONAL CARE": "Personal Care",
  EDUCATION: "Education",
  GOVERNMENT_AND_NON_PROFIT: "Government",
  "GOVERNMENT AND NON PROFIT": "Government",
};

const PREFIX_RULES: Array<{ prefix: string; label: DisplayCategory }> = [
  { prefix: "TRANSFER", label: "Transfers" },
  { prefix: "LOAN PAYMENTS CREDIT CARD", label: "Credit Card Payment" },
  { prefix: "LOAN PAYMENTS", label: "Loan Payment" },
  { prefix: "GENERAL MERCHANDISE", label: "Shopping" },
  { prefix: "GENERAL SERVICES AUTOMOTIVE", label: "Automotive" },
  { prefix: "FOOD AND DRINK GROCERIES", label: "Groceries" },
  { prefix: "FOOD AND DRINK", label: "Food & Drink" },
  { prefix: "TRANSPORTATION GAS", label: "Gas" },
  { prefix: "TRANSPORTATION", label: "Transit" },
  { prefix: "TRAVEL", label: "Travel" },
  { prefix: "ENTERTAINMENT", label: "Entertainment" },
  { prefix: "MEDICAL", label: "Healthcare" },
  { prefix: "RENT AND UTILITIES RENT", label: "Rent" },
  { prefix: "RENT AND UTILITIES", label: "Utilities" },
  { prefix: "HOME", label: "Home" },
  { prefix: "INCOME", label: "Income" },
  { prefix: "BANK FEES", label: "Bank Fees" },
  { prefix: "PERSONAL CARE", label: "Personal Care" },
  { prefix: "EDUCATION", label: "Education" },
];

const TITLE_CASE_KNOWN: Record<string, DisplayCategory | string> = {
  salary: "Income",
  freelance: "Income",
  investment: "Income",
  refund: "Income",
  housing: "Home",
  utilities: "Utilities",
  food: "Food & Drink",
  transport: "Transit",
  insurance: "Insurance",
  healthcare: "Healthcare",
  lifestyle: "Entertainment",
  subscriptions: "Subscriptions",
  education: "Education",
  savings: "Savings",
  transfer: "Transfers",
  other: "Other",
  shopping: "Shopping",
  automotive: "Automotive",
  groceries: "Groceries",
  restaurants: "Restaurants",
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Convert a raw ledger/Plaid category into a clean display label. */
export function getDisplayCategory(rawCategory: string | null | undefined): string {
  const trimmed = (rawCategory ?? "").trim();
  if (!trimmed) {
    return "Other";
  }

  const known = TITLE_CASE_KNOWN[trimmed.toLowerCase()];
  if (known) {
    return known;
  }

  const key = normalizeKey(trimmed);
  if (EXACT_MAP[key]) {
    return EXACT_MAP[key];
  }

  for (const rule of PREFIX_RULES) {
    if (key === rule.prefix || key.startsWith(`${rule.prefix} `)) {
      return rule.label;
    }
  }

  // Collapse overly long raw strings into a readable title without ALL CAPS noise.
  if (trimmed === trimmed.toUpperCase() || /_/.test(trimmed)) {
    return toTitleCase(key);
  }

  return trimmed;
}

/** Clean merchant / notes for list rows. */
export function getDisplayMerchant(params: {
  notes?: string | null;
  category?: string | null;
  type?: string | null;
}): string {
  const notes = (params.notes ?? "").trim();
  if (notes) {
    // Strip common bank noise prefixes while keeping the useful name.
    const cleaned = notes
      .replace(/^(POS|ACH|DEBIT|CREDIT|PURCHASE|CHECKCARD)\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (cleaned) {
      return cleaned.length > 48 ? `${cleaned.slice(0, 45).trimEnd()}…` : cleaned;
    }
  }

  if (params.type === "transfer") {
    return "Transfer";
  }

  return getDisplayCategory(params.category);
}

export function isTransferDisplayCategory(rawCategory: string | null | undefined): boolean {
  const display = getDisplayCategory(rawCategory);
  return (
    display === "Transfers" ||
    display === "Credit Card Payment" ||
    display === "Loan Payment"
  );
}
