import pg from "pg";

export function getProjectRef(supabaseUrl: string | undefined): string | null {
  const match = supabaseUrl
    ?.replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "")
    .match(/https:\/\/([^.]+)\.supabase\.co/);

  return match?.[1] ?? null;
}

export function resolveDatabaseUrl(): string | null {
  const direct =
    process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (direct) {
    return direct;
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const projectRef = getProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (password && projectRef) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  return null;
}

export async function applySqlViaManagementApi(
  sql: string,
  options?: { token?: string; projectRef?: string },
): Promise<void> {
  const token = options?.token ?? process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef =
    options?.projectRef ?? getProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!token || !projectRef) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN or project ref.");
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Management API failed (${response.status}): ${body}`);
  }
}

export async function applySqlViaPostgres(sql: string, databaseUrl?: string): Promise<void> {
  const connectionString = databaseUrl ?? resolveDatabaseUrl();

  if (!connectionString) {
    throw new Error("Missing database connection string.");
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(sql);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function applySqlMigration(sql: string): Promise<"management-api" | "postgres"> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = getProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (token && projectRef) {
    try {
      await applySqlViaManagementApi(sql, { token, projectRef });
      return "management-api";
    } catch {
      // Fall through to Postgres connection.
    }
  }

  await applySqlViaPostgres(sql);
  return "postgres";
}

export async function checkAccountManagementMigrationApplied(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return false;
  }

  const response = await fetch(
    `${url}/rest/v1/accounts?select=nickname,include_in_net_worth&limit=0`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );

  return response.ok;
}
