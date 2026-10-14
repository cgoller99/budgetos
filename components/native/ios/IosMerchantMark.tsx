type MerchantKind = "income" | "spending" | "refund" | "transfer";

const PATHS: Record<string, string> = {
  income: "M12 19V5M6 11l6-6 6 6",
  refund: "M8 7H5v3M5.5 12a6.5 6.5 0 1 0 1.2-3.7",
  transfer: "M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3",
  food: "M8 4v7a4 4 0 0 0 8 0V4M12 15v5",
  housing: "M4 11 12 4l8 7M6 10v9h12v-9",
  transport: "M5 16V8l3-3h8l3 3v8M7 16v2M17 16v2M7 8h10",
  utilities: "M13 3 6 14h6l-1 7 7-11h-6l1-7",
  health: "M12 5v14M5 12h14",
  insurance: "M12 3l8 3v6c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V6l8-3",
  subscriptions: "M8 7a4 4 0 1 1-1 2.5M16 17a4 4 0 1 1 1-2.5",
  education: "M4 8l8-4 8 4-8 4-8-4M8 10v5c2 2 6 2 8 0v-5",
  savings: "M12 6v12M8 10h8M8 14h8",
  lifestyle: "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4",
  investment: "M4 16l5-5 3 3 8-8",
  other: "M6 7h4v4H6zM14 7h4v4h-4zM6 15h4v4H6zM14 15h4v4h-4z",
};

function markName(category: string, kind: MerchantKind): string {
  if (kind === "refund" || kind === "transfer" || kind === "income") {
    return kind;
  }

  const value = category.toLowerCase();
  if (value.includes("food") || value.includes("grocer") || value.includes("dining")) {
    return "food";
  }
  if (value.includes("hous") || value.includes("rent")) return "housing";
  if (value.includes("transport") || value.includes("auto") || value.includes("gas")) {
    return "transport";
  }
  if (value.includes("util")) return "utilities";
  if (value.includes("health") || value.includes("medical")) return "health";
  if (value.includes("insur")) return "insurance";
  if (value.includes("subscr")) return "subscriptions";
  if (value.includes("educ") || value.includes("school")) return "education";
  if (value.includes("sav")) return "savings";
  if (value.includes("life") || value.includes("entertain") || value.includes("shop")) {
    return "lifestyle";
  }
  if (value.includes("invest") || value.includes("salary") || value.includes("freelance")) {
    return "investment";
  }
  return "other";
}

export function IosMerchantMark({
  category,
  kind,
}: {
  category: string;
  kind: MerchantKind;
}) {
  const d = PATHS[markName(category, kind)] ?? PATHS.other;

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
