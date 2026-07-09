import { checkAccountManagementMigrationApplied } from "@/lib/supabase/applySqlMigration";
import { verifyAccountPreferencesPersistence } from "@/lib/supabase/accountPreferencesHealth";

const RLS_PROBE_TABLES = [
  "admin_feedback_reports",
  "profiles",
  "accounts",
  "bills",
  "goals",
  "transactions",
  "households",
  "household_members",
] as const;

export type RlsTableProbe = {
  anonWriteBlocked: boolean;
  anonReadEmptyOrBlocked: boolean;
};

export type SupabaseRlsHealth = {
  configured: boolean;
  configurationError: string | null;
  tablesChecked: number;
  tablesBlockingAnonWrites: number;
  adminFeedbackRlsEnabled: boolean;
  allRequiredTablesProtected: boolean;
  accountManagementMigrationApplied: boolean;
  accountPreferencesPersistenceVerified: boolean;
  accountPreferencesPersistenceError: string | null;
  probes: Record<string, RlsTableProbe>;
};

function normalizeSupabaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export async function checkSupabaseRlsHealth(): Promise<SupabaseRlsHealth> {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return {
      configured: false,
      configurationError: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
      tablesChecked: 0,
      tablesBlockingAnonWrites: 0,
      adminFeedbackRlsEnabled: false,
      allRequiredTablesProtected: false,
      accountManagementMigrationApplied: false,
      accountPreferencesPersistenceVerified: false,
      accountPreferencesPersistenceError: null,
      probes: {},
    };
  }

  const restBase = `${url}/rest/v1`;
  const restHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  const probes: Record<string, RlsTableProbe> = {};
  let tablesBlockingAnonWrites = 0;

  for (const table of RLS_PROBE_TABLES) {
    const writeResponse = await fetch(`${restBase}/${table}`, {
      method: "POST",
      headers: {
        ...restHeaders,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({}),
    });

    const readResponse = await fetch(`${restBase}/${table}?select=id&limit=1`, {
      method: "GET",
      headers: restHeaders,
    });

    const readBody = readResponse.ok ? await readResponse.text() : "";
    const anonWriteBlocked =
      writeResponse.status === 401 || writeResponse.status === 403;
    const anonReadEmptyOrBlocked =
      readResponse.status === 401 ||
      readResponse.status === 403 ||
      (readResponse.ok && readBody.includes("[]"));

    if (anonWriteBlocked) {
      tablesBlockingAnonWrites += 1;
    }

    probes[table] = {
      anonWriteBlocked,
      anonReadEmptyOrBlocked,
    };
  }

  const adminFeedbackRlsEnabled =
    probes.admin_feedback_reports?.anonWriteBlocked === true;
  const allRequiredTablesProtected =
    tablesBlockingAnonWrites === RLS_PROBE_TABLES.length;
  const accountManagementMigrationApplied =
    await checkAccountManagementMigrationApplied();
  const persistence =
    accountManagementMigrationApplied
      ? await verifyAccountPreferencesPersistence()
      : {
          checked: false,
          passed: false,
          error: "Migration not applied.",
        };

  return {
    configured: true,
    configurationError: null,
    tablesChecked: RLS_PROBE_TABLES.length,
    tablesBlockingAnonWrites,
    adminFeedbackRlsEnabled,
    allRequiredTablesProtected,
    accountManagementMigrationApplied,
    accountPreferencesPersistenceVerified: persistence.passed,
    accountPreferencesPersistenceError: persistence.error,
    probes,
  };
}
