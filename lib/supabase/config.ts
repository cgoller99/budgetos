export function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = rawUrl
    ? rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")
    : rawUrl;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return { url, anonKey, isConfigured: Boolean(url && anonKey) };
}
