import fs from "node:fs";
import path from "node:path";

export const ENV_PATH = path.resolve(import.meta.dirname, "../..", ".env.local");

export const PLACEHOLDER_PATTERNS = [/^your-/i, /^YOUR-/i, /xxxx/i, /^change-me$/i, /^re_$/i, /^sk_live_$/i, /^pk_live_$/i, /^whsec_$/i, /^price_$/i];

/** Every variable Buxme production expects, grouped by service. */
export const ENV_CATALOG = [
  {
    group: "Supabase",
    vars: [
      {
        name: "NEXT_PUBLIC_SUPABASE_URL",
        required: true,
        source: "Supabase Dashboard → Project Settings → API → Project URL",
        example: "https://YOUR-PROJECT.supabase.co",
      },
      {
        name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        required: true,
        source: "Supabase Dashboard → Project Settings → API → anon public key",
      },
      {
        name: "SUPABASE_SERVICE_ROLE_KEY",
        required: true,
        secret: true,
        source: "Supabase Dashboard → Project Settings → API → service_role key (never expose client-side)",
      },
    ],
  },
  {
    group: "Plaid",
    vars: [
      {
        name: "PLAID_CLIENT_ID",
        required: true,
        secret: true,
        source: "Plaid Dashboard → Team Settings → Keys → Production client_id",
      },
      {
        name: "PLAID_SECRET",
        required: true,
        secret: true,
        source: "Plaid Dashboard → Team Settings → Keys → Production secret",
      },
      {
        name: "PLAID_ENV",
        required: true,
        source: "Set to production for buxme.co",
        example: "production",
      },
      {
        name: "PLAID_TOKEN_ENCRYPTION_KEY",
        required: true,
        secret: true,
        source: "Generate locally: openssl rand -hex 32 (store same value in Vercel Production)",
      },
      {
        name: "PLAID_WEBHOOK_URL",
        required: true,
        source: "App constant for production",
        example: "https://buxme.co/api/plaid/webhook",
      },
      {
        name: "NEXT_PUBLIC_PLAID_ENABLED",
        required: true,
        source: "Vercel Production env",
        example: "true",
      },
    ],
  },
  {
    group: "Stripe",
    vars: [
      {
        name: "STRIPE_SECRET_KEY",
        required: true,
        secret: true,
        source: "Stripe Dashboard → Developers → API keys → Secret key (live mode)",
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        required: true,
        secret: true,
        source: "Stripe Dashboard → Developers → Webhooks → signing secret for buxme.co endpoint",
      },
      {
        name: "STRIPE_PRO_PRICE_ID",
        required: true,
        source: "Stripe Dashboard → Products → Pro plan → Price ID (price_...)",
      },
      {
        name: "STRIPE_PRO_PLUS_PRICE_ID",
        required: true,
        source: "Stripe Dashboard → Products → Pro+ plan → Price ID (price_...)",
      },
      {
        name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        required: true,
        source: "Stripe Dashboard → Developers → API keys → Publishable key (live mode)",
      },
      {
        name: "NEXT_PUBLIC_STRIPE_ENABLED",
        required: true,
        source: "Vercel Production env",
        example: "true",
      },
      {
        name: "NEXT_PUBLIC_STRIPE_PRO_PRICE",
        required: false,
        source: "Display label only",
        example: "$7.99",
      },
      {
        name: "NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE",
        required: false,
        source: "Display label only",
        example: "$14.99",
      },
      {
        name: "STRIPE_PRO_PRODUCT_ID",
        required: false,
        source: "Stripe Dashboard → optional fallback if price IDs rotate",
      },
      {
        name: "STRIPE_PRO_PLUS_PRODUCT_ID",
        required: false,
        source: "Stripe Dashboard → optional fallback if price IDs rotate",
      },
    ],
  },
  {
    group: "Resend",
    vars: [
      {
        name: "RESEND_API_KEY",
        required: true,
        secret: true,
        source: "Resend Dashboard → API Keys → Create API Key",
      },
      {
        name: "RESEND_FROM_EMAIL",
        required: true,
        source: "Resend Dashboard → Domains → verified sender (e.g. noreply@buxme.co)",
        example: "noreply@buxme.co",
      },
      {
        name: "RESEND_FROM_NAME",
        required: true,
        source: "Vercel Production env or app default",
        example: "Buxme",
      },
      {
        name: "RESEND_SANDBOX_ACCOUNT_EMAIL",
        required: false,
        source: "Local dev only — Resend sandbox testing",
      },
    ],
  },
  {
    group: "PostHog",
    vars: [
      {
        name: "NEXT_PUBLIC_POSTHOG_KEY",
        required: true,
        source: "PostHog → Project Settings → Project API Key (phc_...)",
      },
      {
        name: "NEXT_PUBLIC_POSTHOG_HOST",
        required: false,
        source: "PostHog region host",
        example: "https://us.i.posthog.com",
      },
    ],
  },
  {
    group: "App Configuration",
    vars: [
      {
        name: "NEXT_PUBLIC_SITE_URL",
        required: true,
        source: "Vercel Production env",
        example: "https://buxme.co",
      },
      {
        name: "CRON_SECRET",
        required: true,
        secret: true,
        source: "Generate: openssl rand -hex 32 (same value in Vercel Production + .env.local)",
      },
      {
        name: "ADMIN_EMAILS",
        required: true,
        source: "Comma-separated admin emails (Vercel Production)",
      },
      {
        name: "FOUNDER_EMAILS",
        required: true,
        source: "Comma-separated founder emails (Vercel Production)",
      },
      {
        name: "NEXT_PUBLIC_APP_VERSION",
        required: false,
        source: "Optional build metadata",
      },
      {
        name: "SUPABASE_ACCESS_TOKEN",
        required: false,
        secret: true,
        source: "Supabase Dashboard → Account → Access Tokens (migrations CLI only)",
      },
      {
        name: "SUPABASE_DB_PASSWORD",
        required: false,
        secret: true,
        source: "Supabase Dashboard → Project Settings → Database → password (migrations only)",
      },
    ],
  },
];

export function getRequiredVarNames() {
  return ENV_CATALOG.flatMap(({ vars }) => vars.filter((v) => v.required).map((v) => v.name));
}

export function getSecretVarNames() {
  return ENV_CATALOG.flatMap(({ vars }) =>
    vars.filter((v) => v.required && v.secret).map((v) => v.name),
  );
}

export function isSecretVar(name) {
  return getSecretVarNames().includes(name);
}

export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function unquoteEnvValue(raw) {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value.replace(/\r$/, "");
}

/**
 * Parses .env files including Vercel CLI output (quoted values, CRLF, optional "export " prefix).
 * Returns Map preserving keys even when values are empty strings.
 */
export function parseEnvFile(filePath = ENV_PATH) {
  const map = new Map();

  if (!fs.existsSync(filePath)) {
    return map;
  }

  const content = stripBom(fs.readFileSync(filePath, "utf8"));

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const index = normalized.indexOf("=");
    if (index === -1) continue;

    const key = normalized.slice(0, index).trim();
    const value = unquoteEnvValue(normalized.slice(index + 1));
    map.set(key, value);
  }

  return map;
}

export function loadEnvObject(filePath = ENV_PATH) {
  return Object.fromEntries(parseEnvFile(filePath));
}

export function hydrateProcessEnvFromFile(filePath = ENV_PATH, { overwrite = false } = {}) {
  for (const [key, value] of parseEnvFile(filePath)) {
    if (overwrite || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getEnv(name, filePath = ENV_PATH) {
  const map = parseEnvFile(filePath);
  if (map.has(name)) {
    return map.get(name).trim();
  }
  return process.env[name]?.trim() ?? "";
}

export function isPlaceholder(value) {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

export function classifyEnvValue(value) {
  if (value === undefined) return "absent";
  if (value.trim() === "") return "empty";
  if (isPlaceholder(value)) return "placeholder";
  return "ok";
}

export function writeEnvFile(map, filePath = ENV_PATH, { header = "# Buxme local environment — never commit\n" } = {}) {
  const orderedKeys = [
    "# Supabase",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
    "# Site",
    "NEXT_PUBLIC_SITE_URL",
    "",
    "# Plaid Production",
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "PLAID_ENV",
    "PLAID_TOKEN_ENCRYPTION_KEY",
    "PLAID_WEBHOOK_URL",
    "NEXT_PUBLIC_PLAID_ENABLED",
    "",
    "# Stripe Live Mode",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_PRO_PLUS_PRICE_ID",
    "STRIPE_PRO_PRODUCT_ID",
    "STRIPE_PRO_PLUS_PRODUCT_ID",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_STRIPE_ENABLED",
    "NEXT_PUBLIC_STRIPE_PRO_PRICE",
    "NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE",
    "",
    "# Email",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_FROM_NAME",
    "RESEND_SANDBOX_ACCOUNT_EMAIL",
    "",
    "# Analytics",
    "NEXT_PUBLIC_POSTHOG_KEY",
    "NEXT_PUBLIC_POSTHOG_HOST",
    "",
    "# Security & access",
    "CRON_SECRET",
    "ADMIN_EMAILS",
    "FOUNDER_EMAILS",
    "",
    "# Optional dev tooling",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
  ];

  const written = new Set();
  const output = [header.trimEnd(), ""];

  for (const entry of orderedKeys) {
    if (entry.startsWith("#") || entry === "") {
      output.push(entry);
      continue;
    }

    written.add(entry);

    if (map.has(entry)) {
      output.push(`${entry}=${map.get(entry)}`);
      continue;
    }

    output.push(`# ${entry}=`);
  }

  for (const [key, value] of map.entries()) {
    if (!written.has(key)) {
      output.push(`${key}=${value}`);
    }
  }

  output.push("");
  fs.writeFileSync(filePath, output.join("\n"));
}

/**
 * Merge public defaults without clobbering non-empty secrets from Vercel pull.
 */
export function mergeEnvMaps(base, patch, { fillEmpty = true } = {}) {
  const merged = new Map(base);

  for (const [key, value] of patch) {
    if (!merged.has(key)) {
      merged.set(key, value);
      continue;
    }

    const existing = merged.get(key);
    if (fillEmpty && existing === "" && value !== "") {
      merged.set(key, value);
    }
  }

  return merged;
}
