export function isPlaidClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PLAID_ENABLED === "true";
}
