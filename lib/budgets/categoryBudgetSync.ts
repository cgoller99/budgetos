import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

export type SavedCategoryBudget = {
  category: string;
  amount: number;
};

export type CategoryBudgetRecord = {
  category: string;
  amount: number;
  updatedAt: string;
};

export type PendingCategoryBudget = {
  category: string;
  amount: number | null;
  updatedAt: string;
  legacy?: boolean;
};

export type CategoryBudgetSnapshot = {
  records: CategoryBudgetRecord[];
  pending: PendingCategoryBudget[];
};

export type CategoryBudgetSyncStatus = "loading" | "ready" | "offline" | "error";

export type CategoryBudgetSyncState = {
  budgets: SavedCategoryBudget[];
  status: CategoryBudgetSyncStatus;
  message: string | null;
};

export type CategoryBudgetStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type CategoryBudgetRemote = {
  list(): Promise<CategoryBudgetRecord[]>;
  save(record: CategoryBudgetRecord): Promise<void>;
  remove(category: string): Promise<void>;
};

export const CATEGORY_BUDGET_STORAGE_PREFIX = "buxme-category-budgets";

const OFFLINE_MESSAGE =
  "Saved on this device. They'll sync when you're back online.";
const LOAD_ERROR_MESSAGE = "Budgets couldn't be loaded.";
const LOADING_MESSAGE = "Loading budgets...";

export function categoryBudgetStorageKey(userId: string | null | undefined): string {
  return `${CATEGORY_BUDGET_STORAGE_PREFIX}:${userId || "local"}`;
}

export function emptyCategoryBudgetSnapshot(): CategoryBudgetSnapshot {
  return { records: [], pending: [] };
}

function isFiniteAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function normalizeCategory(category: string): string | null {
  const display = getDisplayCategory(category);
  if (!display || display === "Other" && !category.trim()) {
    return null;
  }
  return display;
}

function sortRecords(records: CategoryBudgetRecord[]): CategoryBudgetRecord[] {
  return [...records].sort((left, right) => left.category.localeCompare(right.category));
}

export function visibleCategoryBudgets(
  snapshot: CategoryBudgetSnapshot,
): SavedCategoryBudget[] {
  return sortRecords(snapshot.records).map((record) => ({
    category: record.category,
    amount: record.amount,
  }));
}

function recordFromUnknown(value: unknown): CategoryBudgetRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as { category?: unknown; amount?: unknown; updatedAt?: unknown };
  if (typeof item.category !== "string" || !isFiniteAmount(item.amount)) {
    return null;
  }
  const category = normalizeCategory(item.category);
  if (!category) {
    return null;
  }
  return {
    category,
    amount: normalizeAmount(item.amount),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function pendingFromUnknown(value: unknown): PendingCategoryBudget | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as {
    category?: unknown;
    amount?: unknown;
    updatedAt?: unknown;
    legacy?: unknown;
  };
  if (typeof item.category !== "string") {
    return null;
  }
  const category = normalizeCategory(item.category);
  if (!category) {
    return null;
  }
  const amount = item.amount === null ? null : isFiniteAmount(item.amount) ? normalizeAmount(item.amount) : undefined;
  if (amount === undefined) {
    return null;
  }
  return {
    category,
    amount,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
    legacy: item.legacy === true,
  };
}

export function parseCategoryBudgetCache(raw: string | null): CategoryBudgetSnapshot {
  if (!raw) {
    return emptyCategoryBudgetSnapshot();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyCategoryBudgetSnapshot();
  }

  if (Array.isArray(parsed)) {
    const records: CategoryBudgetRecord[] = [];
    const pending: PendingCategoryBudget[] = [];
    for (const item of parsed) {
      const record = recordFromUnknown(item);
      if (!record) {
        continue;
      }
      records.push(record);
      pending.push({
        category: record.category,
        amount: record.amount,
        updatedAt: "",
        legacy: true,
      });
    }
    return { records: sortRecords(records), pending };
  }

  if (!parsed || typeof parsed !== "object") {
    return emptyCategoryBudgetSnapshot();
  }

  const body = parsed as { version?: unknown; records?: unknown; pending?: unknown };
  if (body.version !== 2 || !Array.isArray(body.records)) {
    return emptyCategoryBudgetSnapshot();
  }

  return {
    records: sortRecords(
      body.records
        .map((item) => recordFromUnknown(item))
        .filter((item): item is CategoryBudgetRecord => item !== null),
    ),
    pending: Array.isArray(body.pending)
      ? body.pending
          .map((item) => pendingFromUnknown(item))
          .filter((item): item is PendingCategoryBudget => item !== null)
      : [],
  };
}

export function serializeCategoryBudgetCache(snapshot: CategoryBudgetSnapshot): string {
  return JSON.stringify({
    version: 2,
    records: snapshot.records,
    pending: snapshot.pending,
  });
}

function describeSyncState(
  snapshot: CategoryBudgetSnapshot,
  status: CategoryBudgetSyncStatus,
): CategoryBudgetSyncState {
  const budgets = visibleCategoryBudgets(snapshot);
  const hasLocal = budgets.length > 0 || snapshot.pending.length > 0;

  if (status === "error" && !hasLocal) {
    return { budgets, status: "error", message: LOAD_ERROR_MESSAGE };
  }

  if (status === "offline" || (status === "error" && hasLocal)) {
    return { budgets, status: "offline", message: OFFLINE_MESSAGE };
  }

  if (status === "loading" && !hasLocal) {
    return { budgets, status: "loading", message: LOADING_MESSAGE };
  }

  return { budgets, status: "ready", message: null };
}

/**
 * Last-write-wins per category.
 * A newer local edit is kept when an older server snapshot arrives.
 * A legacy device-only limit is uploaded only when the server has no row.
 */
export function mergeCategoryBudgetSnapshot(
  local: CategoryBudgetSnapshot,
  remote: CategoryBudgetRecord[],
): CategoryBudgetSnapshot {
  const remoteByCategory = new Map(remote.map((row) => [row.category, row]));
  const localByCategory = new Map(local.records.map((row) => [row.category, row]));
  const pendingByCategory = new Map<string, PendingCategoryBudget>();
  for (const item of local.pending) {
    pendingByCategory.set(item.category, item);
  }

  const categories = new Set<string>([
    ...remoteByCategory.keys(),
    ...localByCategory.keys(),
    ...pendingByCategory.keys(),
  ]);

  const records: CategoryBudgetRecord[] = [];
  const pending: PendingCategoryBudget[] = [];

  for (const category of categories) {
    const remoteRow = remoteByCategory.get(category);
    const localRow = localByCategory.get(category);
    const draft = pendingByCategory.get(category);

    if (draft?.legacy) {
      if (remoteRow) {
        records.push(remoteRow);
        continue;
      }
      if (draft.amount != null) {
        records.push({
          category,
          amount: draft.amount,
          updatedAt: draft.updatedAt,
        });
        pending.push(draft);
      }
      continue;
    }

    const device = draft
      ? {
          amount: draft.amount,
          updatedAt: draft.updatedAt,
        }
      : localRow
        ? { amount: localRow.amount, updatedAt: localRow.updatedAt }
        : null;

    if (device && device.updatedAt && (!remoteRow || device.updatedAt >= remoteRow.updatedAt)) {
      if (device.amount == null) {
        if (remoteRow) {
          pending.push({
            category,
            amount: null,
            updatedAt: device.updatedAt,
          });
        }
        continue;
      }

      records.push({
        category,
        amount: device.amount,
        updatedAt: device.updatedAt,
      });
      const matchesRemote =
        remoteRow != null &&
        remoteRow.amount === device.amount &&
        remoteRow.updatedAt === device.updatedAt;
      if (!matchesRemote) {
        pending.push({
          category,
          amount: device.amount,
          updatedAt: device.updatedAt,
        });
      }
      continue;
    }

    if (remoteRow) {
      records.push(remoteRow);
    }
  }

  return { records: sortRecords(records), pending };
}

export function applyCategoryBudgetEdits(
  snapshot: CategoryBudgetSnapshot,
  next: Array<{ category: string; amount: number }>,
  updatedAt: string,
): CategoryBudgetSnapshot {
  const normalized = new Map<string, number>();
  for (const item of next) {
    if (!isFiniteAmount(item.amount)) {
      continue;
    }
    const category = normalizeCategory(item.category);
    if (!category) {
      continue;
    }
    normalized.set(category, normalizeAmount(item.amount));
  }

  const records = new Map(snapshot.records.map((record) => [record.category, record]));
  const pending = new Map(snapshot.pending.map((item) => [item.category, item]));

  for (const [category, amount] of normalized) {
    const existing = records.get(category);
    if (existing && existing.amount === amount && !pending.get(category)?.legacy) {
      continue;
    }
    records.set(category, { category, amount, updatedAt });
    pending.set(category, { category, amount, updatedAt });
  }

  for (const category of [...records.keys()]) {
    if (normalized.has(category)) {
      continue;
    }
    records.delete(category);
    pending.set(category, { category, amount: null, updatedAt });
  }

  return {
    records: sortRecords([...records.values()]),
    pending: [...pending.values()],
  };
}

function acknowledgePush(
  snapshot: CategoryBudgetSnapshot,
  pushed: PendingCategoryBudget,
): CategoryBudgetSnapshot {
  return {
    records: snapshot.records,
    pending: snapshot.pending.filter(
      (item) =>
        item.category !== pushed.category ||
        item.updatedAt !== pushed.updatedAt ||
        item.amount !== pushed.amount ||
        Boolean(item.legacy) !== Boolean(pushed.legacy),
    ),
  };
}

export class CategoryBudgetSession {
  private snapshot: CategoryBudgetSnapshot;
  private mutationEpoch = 0;
  private mutations: Array<{ epoch: number; category: string }> = [];
  private tail: Promise<void> = Promise.resolve();
  private syncFailed = false;
  private listeners = new Set<(state: CategoryBudgetSyncState) => void>();
  private readonly userId: string;
  private readonly storage: CategoryBudgetStorage;
  private readonly remote: CategoryBudgetRemote | null;
  private readonly now: () => string;

  constructor(
    userId: string,
    storage: CategoryBudgetStorage,
    remote: CategoryBudgetRemote | null,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.userId = userId;
    this.storage = storage;
    this.remote = remote;
    this.now = now;
    this.snapshot = parseCategoryBudgetCache(
      storage.getItem(categoryBudgetStorageKey(userId)),
    );
  }

  subscribe(listener: (state: CategoryBudgetSyncState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  readLocalState(): CategoryBudgetSyncState {
    if (!this.remote) {
      return describeSyncState(this.snapshot, "ready");
    }
    const hasLocal = this.snapshot.records.length > 0 || this.snapshot.pending.length > 0;
    return describeSyncState(this.snapshot, hasLocal ? "ready" : "loading");
  }

  commit(next: Array<{ category: string; amount: number }>): CategoryBudgetSyncState {
    const changed = this.changedCategories(next);
    this.mutationEpoch += 1;
    for (const category of changed) {
      this.mutations.push({ epoch: this.mutationEpoch, category });
    }
    this.mutations = this.mutations.slice(-50);
    this.snapshot = applyCategoryBudgetEdits(this.snapshot, next, this.now());
    this.persist();
    const state = describeSyncState(this.snapshot, "ready");
    this.emit(state);
    if (this.remote) {
      this.enqueueFlush(this.mutationEpoch);
    }
    return state;
  }

  async load(): Promise<CategoryBudgetSyncState> {
    if (!this.remote) {
      const state = describeSyncState(this.snapshot, "ready");
      this.emit(state);
      return state;
    }

    const epochAtStart = this.mutationEpoch;
    let remoteRows: CategoryBudgetRecord[];
    try {
      remoteRows = await this.remote.list();
    } catch {
      const state = describeSyncState(
        this.snapshot,
        this.snapshot.records.length > 0 || this.snapshot.pending.length > 0
          ? "offline"
          : "error",
      );
      this.emit(state);
      return state;
    }

    const mutated = new Set(
      this.mutations.filter((item) => item.epoch > epochAtStart).map((item) => item.category),
    );
    const safeRemote = remoteRows.filter((row) => !mutated.has(row.category));
    this.snapshot = mergeCategoryBudgetSnapshot(this.snapshot, safeRemote);
    this.persist();
    this.enqueueFlush(this.mutationEpoch);
    await this.whenIdle();
    const state = describeSyncState(
      this.snapshot,
      this.syncFailed ? "offline" : "ready",
    );
    this.emit(state);
    return state;
  }

  whenIdle(): Promise<void> {
    return this.tail;
  }

  private changedCategories(next: Array<{ category: string; amount: number }>): string[] {
    const nextCategories = new Map<string, number>();
    for (const item of next) {
      if (!isFiniteAmount(item.amount)) {
        continue;
      }
      const category = normalizeCategory(item.category);
      if (!category) {
        continue;
      }
      nextCategories.set(category, normalizeAmount(item.amount));
    }
    const changed = new Set<string>();
    for (const [category, amount] of nextCategories) {
      const existing = this.snapshot.records.find((record) => record.category === category);
      if (!existing || existing.amount !== amount) {
        changed.add(category);
      }
    }
    for (const record of this.snapshot.records) {
      if (!nextCategories.has(record.category)) {
        changed.add(record.category);
      }
    }
    return [...changed];
  }

  private persist(): void {
    this.storage.setItem(
      categoryBudgetStorageKey(this.userId),
      serializeCategoryBudgetCache(this.snapshot),
    );
  }

  private emit(state: CategoryBudgetSyncState): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private enqueueFlush(epoch: number): void {
    this.tail = this.tail
      .then(() => this.flushPending(epoch))
      .catch(() => undefined);
  }

  private async flushPending(epoch: number): Promise<void> {
    if (!this.remote || epoch !== this.mutationEpoch) {
      return;
    }

    const queue = [...this.snapshot.pending];
    let failed = false;
    this.syncFailed = false;

    for (const item of queue) {
      if (epoch !== this.mutationEpoch) {
        return;
      }

      try {
        if (item.legacy) {
          if (item.amount == null) {
            this.snapshot = acknowledgePush(this.snapshot, item);
            this.persist();
            continue;
          }
          const stamped: PendingCategoryBudget = {
            category: item.category,
            amount: item.amount,
            updatedAt: this.now(),
          };
          this.snapshot = {
            records: sortRecords(
              this.snapshot.records.map((record) =>
                record.category === stamped.category
                  ? {
                      category: stamped.category,
                      amount: stamped.amount ?? record.amount,
                      updatedAt: stamped.updatedAt,
                    }
                  : record,
              ),
            ),
            pending: this.snapshot.pending.map((pending) =>
              pending.category === item.category && pending.legacy ? stamped : pending,
            ),
          };
          await this.remote.save({
            category: stamped.category,
            amount: stamped.amount ?? item.amount,
            updatedAt: stamped.updatedAt,
          });
          if (epoch !== this.mutationEpoch) {
            return;
          }
          this.snapshot = acknowledgePush(this.snapshot, stamped);
          this.persist();
          continue;
        }

        if (item.amount == null) {
          await this.remote.remove(item.category);
        } else {
          await this.remote.save({
            category: item.category,
            amount: item.amount,
            updatedAt: item.updatedAt,
          });
        }
        if (epoch !== this.mutationEpoch) {
          return;
        }
        this.snapshot = acknowledgePush(this.snapshot, item);
        this.persist();
      } catch {
        failed = true;
      }
    }

    this.syncFailed = failed;
    const state = describeSyncState(this.snapshot, failed ? "offline" : "ready");
    this.emit(state);
  }
}
