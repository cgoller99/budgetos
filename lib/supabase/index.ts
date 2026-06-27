export {
  ensureAuthenticatedUser,
  ensureProfile,
  getAuthenticatedUserId,
  getAuthErrorMessage,
  requireAuthenticatedUser,
  AuthError,
} from "./auth";
export {
  createSupabaseClient,
  getSupabaseClient,
  getSupabaseConfig,
  isSupabaseConfigured,
  resetSupabaseClient,
} from "./client";
export {
  createSupabaseBrowserClient,
  getSupabaseBrowserClient,
  resetSupabaseBrowserClient,
} from "./browser";
export { getErrorMessage } from "./errors";
export type {
  AccountRow,
  BillRow,
  Database,
  GoalRow,
  InvestmentRow,
  NotificationRow,
  ProfileRow,
  RecurringItemRow,
  TransactionRow,
} from "./database.types";
export {
  FinanceService,
  FinanceRepository,
  emptyFinanceData,
} from "./services/financeService";
export { HouseholdService } from "./services/householdService";
export { mapFinanceData } from "./mappers";
export { seedFinanceData, seedFinanceDataIfEmpty } from "./seed";
export { ProfilesRepository } from "./repositories/profilesRepository";
export { NotificationsRepository } from "./repositories/notificationsRepository";
export { RecurringItemsRepository } from "./repositories/recurringItemsRepository";
