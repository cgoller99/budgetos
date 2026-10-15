#!/usr/bin/env node
/**
 * Category budgets: net spending, confirmed limits, and owner-only privacy.
 *
 * Usage: npm run test:category-budgets
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import {
  buildCategoryBudgetViews,
  netCategorySpending,
  suggestCategoryBudgetLimits,
} from "../lib/budgets/categoryBudgets.ts";
import {
  readSavedCategoryBudgets,
  writeSavedCategoryBudgets,
} from "../lib/automation/savedBudgets.ts";
import { createSupabaseCategoryBudgetRemote } from "../lib/budgets/categoryBudgetRemote.ts";
import { CategoryBudgetSession } from "../lib/budgets/categoryBudgetSync.ts";

const root = path.resolve(import.meta.dirname, "..");
const reference = new Date("2026-10-15T12:00:00");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function transaction(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: partial.type ?? "expense",
    category: partial.category ?? "Groceries",
    accountId: partial.accountId ?? "acct",
    transferAccountId: null,
    date: partial.date,
    notes: partial.notes ?? "",
    billId: null,
    goalId: partial.goalId ?? null,
    ownerUserId: partial.ownerUserId ?? null,
  };
}

function finance(partial) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "acct",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 1000,
        monthlyChange: 0,
      },
    ],
    viewerUserId: "user-a",
    ...partial,
  };
}

function spent(data, month, category) {
  return netCategorySpending(data, month).get(category) ?? 0;
}

const refunded = finance({
  transactions: [
    transaction({ id: "g1", amount: 80, date: "2026-10-02", category: "Groceries" }),
    transaction({
      id: "g2",
      amount: -20,
      date: "2026-10-05",
      category: "Groceries",
      notes: "Store refund",
    }),
    transaction({
      id: "g3",
      amount: 25,
      type: "income",
      date: "2026-10-06",
      category: "GENERAL MERCHANDISE",
      notes: "Amazon refund",
    }),
    transaction({
      id: "g4",
      amount: 40,
      type: "income",
      date: "2026-10-07",
      category: "Refund",
      notes: "refund",
    }),
    transaction({
      id: "tax",
      amount: 300,
      type: "income",
      date: "2026-10-08",
      category: "Income",
      notes: "Tax refund",
    }),
  ],
});

assert.equal(spent(refunded, "2026-10", "Groceries"), 60);
assert.equal(spent(refunded, "2026-10", "Shopping"), -25);
assert.equal(netCategorySpending(refunded, "2026-10").has("Refund"), false);
assert.equal(netCategorySpending(refunded, "2026-10").has("Income"), false);

const transfers = finance({
  transactions: [
    transaction({
      id: "t1",
      amount: 500,
      date: "2026-10-02",
      category: "TRANSFER OUT SAVINGS",
      notes: "Online transfer to savings",
    }),
    transaction({
      id: "t2",
      amount: 200,
      type: "transfer",
      date: "2026-10-03",
      category: "Groceries",
      notes: "Account transfer",
    }),
    transaction({
      id: "cc",
      amount: 300,
      date: "2026-10-04",
      category: "LOAN PAYMENTS CREDIT CARD PAYMENT",
    }),
    transaction({
      id: "goal",
      amount: 50,
      date: "2026-10-04",
      category: "Groceries",
      goalId: "goal-1",
    }),
    transaction({ id: "g", amount: 40, date: "2026-10-05", category: "Groceries" }),
  ],
});

assert.equal(spent(transfers, "2026-10", "Groceries"), 40);
assert.equal(netCategorySpending(transfers, "2026-10").has("Transfers"), false);
assert.equal(netCategorySpending(transfers, "2026-10").has("Credit Card Payment"), false);

const household = finance({
  transactions: [
    transaction({
      id: "mine",
      amount: 30,
      date: "2026-10-02",
      category: "Groceries",
      ownerUserId: "user-a",
    }),
    transaction({
      id: "theirs",
      amount: 200,
      date: "2026-10-03",
      category: "Groceries",
      ownerUserId: "user-b",
    }),
    transaction({
      id: "legacy",
      amount: 15,
      date: "2026-10-04",
      category: "Restaurants",
      ownerUserId: null,
    }),
    transaction({
      id: "their-refund",
      amount: 10,
      type: "income",
      date: "2026-10-05",
      category: "Groceries",
      notes: "refund",
      ownerUserId: "user-b",
    }),
  ],
});

assert.equal(spent(household, "2026-10", "Groceries"), 30);
assert.equal(spent(household, "2026-10", "Restaurants"), 15);

const history = finance({
  transactions: [
    transaction({
      id: "aug",
      amount: 100,
      date: "2026-08-04",
      category: "FOOD AND DRINK GROCERIES",
    }),
    transaction({ id: "sep", amount: 140, date: "2026-09-04", category: "Groceries" }),
    transaction({
      id: "sep-refund",
      amount: -20,
      date: "2026-09-10",
      category: "Groceries",
      notes: "refund",
    }),
    transaction({ id: "oct", amount: 900, date: "2026-10-02", category: "Groceries" }),
    transaction({ id: "aug-dine", amount: 80, date: "2026-08-08", category: "Restaurants" }),
    transaction({ id: "sep-dine", amount: 40, date: "2026-09-08", category: "Restaurants" }),
    transaction({ id: "only", amount: 75, date: "2026-08-12", category: "Gas" }),
  ],
});

const suggestions = suggestCategoryBudgetLimits(history, reference);
assert.deepEqual(
  suggestions.map((item) => item.category),
  ["Groceries", "Restaurants"],
);
assert.equal(suggestions[0].suggestedLimit, 110);
assert.equal(suggestions[0].months, 2);
assert.equal(suggestions[1].suggestedLimit, 60);
assert.ok(suggestions.every((item) => item.category !== "Gas"));

const oneMonth = finance({
  transactions: [
    transaction({ id: "once", amount: 100, date: "2026-09-04", category: "Groceries" }),
    transaction({ id: "now", amount: 400, date: "2026-10-04", category: "Groceries" }),
  ],
});
assert.equal(suggestCategoryBudgetLimits(oneMonth, reference).length, 0);

const active = buildCategoryBudgetViews(
  [
    { category: "Groceries", amount: 100 },
    { category: "Restaurants", amount: 50 },
  ],
  history,
  reference,
);
const groceryView = active.find((item) => item.category === "Groceries");
const diningView = active.find((item) => item.category === "Restaurants");
assert.equal(groceryView.spent, 900);
assert.equal(groceryView.remaining, -800);
assert.equal(groceryView.progress, 900);
assert.equal(groceryView.overspent, true);
assert.equal(groceryView.alert, "Over budget");
assert.equal(diningView.spent, 0);
assert.equal(diningView.remaining, 50);
assert.equal(diningView.progress, 0);
assert.equal(diningView.alert, null);
assert.equal(active[0].category, "Groceries");

const synced = finance({
  transactions: [
    transaction({
      id: "sync-1",
      amount: 42,
      date: "2026-10-03",
      category: "FOOD AND DRINK GROCERIES",
      notes: "Kroger",
    }),
  ],
});
const beforeSync = buildCategoryBudgetViews(
  [{ category: "Groceries", amount: 200 }],
  synced,
  reference,
);
const afterSync = buildCategoryBudgetViews(
  [{ category: "Groceries", amount: 200 }],
  finance({
    transactions: [
      ...synced.transactions,
      transaction({
        id: "sync-2",
        amount: 18,
        date: "2026-10-09",
        category: "FOOD AND DRINK GROCERIES",
        notes: "Kroger",
      }),
    ],
  }),
  reference,
);
assert.equal(beforeSync[0].spent, 42);
assert.equal(beforeSync[0].remaining, 158);
assert.equal(beforeSync[0].limit, 200);
assert.equal(afterSync[0].spent, 60);
assert.equal(afterSync[0].remaining, 140);
assert.equal(afterSync[0].limit, 200);

const collapsed = buildCategoryBudgetViews(
  [
    { category: "FOOD AND DRINK GROCERIES", amount: 80 },
    { category: "Groceries", amount: 125 },
  ],
  synced,
  reference,
);
assert.equal(collapsed.length, 1);
assert.equal(collapsed[0].category, "Groceries");
assert.equal(collapsed[0].limit, 125);
assert.equal(collapsed[0].spent, 42);

const confirmed = suggestions.map((item) => ({
  category: item.category,
  amount: item.suggestedLimit,
}));
assert.equal(buildCategoryBudgetViews(confirmed, history, reference).length, 2);
assert.equal(buildCategoryBudgetViews(suggestions, history, reference).length, 0);
assert.equal(buildCategoryBudgetViews([], history, reference).length, 0);

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};

writeSavedCategoryBudgets("user-a", [{ category: "Groceries", amount: 100 }]);
writeSavedCategoryBudgets("user-b", [{ category: "Restaurants", amount: 40 }]);
assert.deepEqual(readSavedCategoryBudgets("user-a"), [
  { category: "Groceries", amount: 100 },
]);
assert.deepEqual(readSavedCategoryBudgets("user-b"), [
  { category: "Restaurants", amount: 40 },
]);
assert.deepEqual(readSavedCategoryBudgets("user-c"), []);
assert.ok([...store.keys()].every((key) => key.includes("buxme-category-budgets:")));
assert.notEqual(
  [...store.keys()].find((key) => key.endsWith(":user-a")),
  [...store.keys()].find((key) => key.endsWith(":user-b")),
);

store.set("buxme-category-budgets:user-d", "not-json");
assert.deepEqual(readSavedCategoryBudgets("user-d"), []);
store.set(
  "buxme-category-budgets:user-e",
  JSON.stringify([{ category: "Groceries", amount: -5 }, { category: "", amount: 10 }]),
);
assert.deepEqual(readSavedCategoryBudgets("user-e"), []);

const migration = read("supabase/migrations/20261012_category_budgets_owner_only.sql");
assert.match(migration, /enable row level security/i);
assert.match(migration, /Category budgets manageable by owner/);
assert.match(migration, /for all/i);
assert.match(migration, /using \(auth\.uid\(\) = user_id\)/);
assert.match(migration, /with check \(auth\.uid\(\) = user_id\)/);
assert.match(migration, /revoke all on table public\.category_budgets from anon/i);
assert.doesNotMatch(migration, /household_id/);
assert.doesNotMatch(migration, /user_household_ids/);
assert.match(migration, /unique \(user_id, category\)/);

function sourceFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const tableReaders = sourceFiles(root).filter((filePath) => {
  if (filePath.endsWith(`${path.sep}scripts${path.sep}test-category-budgets.mjs`)) {
    return false;
  }
  const source = fs.readFileSync(filePath, "utf8");
  return source.includes('from("category_budgets")') || source.includes("from('category_budgets')");
});
assert.deepEqual(
  tableReaders.map((filePath) => path.relative(root, filePath)),
  ["lib/budgets/categoryBudgetRemote.ts"],
);

const remoteSource = read("lib/budgets/categoryBudgetRemote.ts");
assert.match(remoteSource, /from\("category_budgets"\)/);
assert.match(remoteSource, /\.eq\("user_id", userId\)/);
assert.match(remoteSource, /onConflict: "user_id,category"/);
assert.doesNotMatch(remoteSource, /service_role|serviceRole|createAdmin/);

const hook = read("components/budgets/useCategoryBudgets.ts");
const effect = hook.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[userId\]\);/);
assert.ok(effect);
assert.match(effect[0], /session\.load\(\)/);
assert.doesNotMatch(effect[0], /writeSavedCategoryBudgets|suggestCategoryBudgetLimits/);
assert.match(hook, /!saved\.some/);
assert.match(hook, /getDisplayCategory/);
assert.match(hook, /buildCategoryBudgetViews\(saved, finance/);
assert.match(hook, /Loading budgets/);
assert.doesNotMatch(read("lib/automation/savedBudgets.ts"), /spent/);
assert.match(read("components/budgets/CategoryBudgetStatus.tsx"), /Try again/);
assert.match(read("components/budgets/CategoryBudgetStatus.tsx"), /role="status"/);
assert.match(read("app/(authenticated)/layout.tsx"), /CategoryBudgetSync/);

for (const relativePath of [
  "components/native/ios/IosBudgetsSection.tsx",
  "components/budgets/CategoryBudgetsCard.tsx",
]) {
  const source = read(relativePath);
  assert.match(source, /Use this limit/);
  assert.match(source, /Nothing is active until you confirm/);
  assert.match(source, /Remove/);
  assert.match(source, /Save budget/);
  assert.match(source, /Over budget|view\.alert/);
}

const home = read("components/native/ios/IosHomeScreen.tsx");
const reports = read("components/native/ios/IosReportsScreen.tsx");
const webReports = read("components/reports/ReportsContent.tsx");
const dashboard = read("components/DashboardContent.tsx");
assert.match(home, /<IosBudgetsSection \/>/);
assert.match(reports, /<IosBudgetsSection \/>/);
assert.match(webReports, /<CategoryBudgetsCard \/>/);
assert.match(dashboard, /<CategoryBudgetsCard \/>/);

function memoryStorage(initial = new Map()) {
  return {
    getItem: (key) => (initial.has(key) ? initial.get(key) : null),
    setItem: (key, value) => initial.set(key, String(value)),
  };
}

function memoryServer() {
  const rows = [];
  return {
    rows,
    remote(userId) {
      return {
        async list() {
          return rows
            .filter((row) => row.user_id === userId)
            .map((row) => ({
              category: row.category,
              amount: row.amount,
              updatedAt: row.updated_at,
            }));
        },
        async save(record) {
          const index = rows.findIndex(
            (row) => row.user_id === userId && row.category === record.category,
          );
          const next = {
            user_id: userId,
            category: record.category,
            amount: record.amount,
            updated_at: record.updatedAt,
          };
          if (index === -1) {
            rows.push(next);
          } else {
            rows[index] = next;
          }
        },
        async remove(category) {
          const index = rows.findIndex(
            (row) => row.user_id === userId && row.category === category,
          );
          if (index !== -1) {
            rows.splice(index, 1);
          }
        },
      };
    },
  };
}

function createStubClient(tableRows, actor) {
  return {
    from(table) {
      if (table !== "category_budgets") {
        throw new Error(`Unexpected table ${table}`);
      }
      const filters = [];
      let mode = "select";
      const query = {
        select() {
          mode = "select";
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        delete() {
          mode = "delete";
          return query;
        },
        upsert(body) {
          if (body.user_id !== actor) {
            return Promise.resolve({
              error: { message: "new row violates row-level security" },
            });
          }
          const index = tableRows.findIndex(
            (row) => row.user_id === body.user_id && row.category === body.category,
          );
          if (index === -1) {
            tableRows.push({ ...body });
          } else {
            tableRows[index] = { ...tableRows[index], ...body };
          }
          return Promise.resolve({ error: null });
        },
        then(onFulfilled, onRejected) {
          try {
            if (mode === "delete") {
              for (let index = tableRows.length - 1; index >= 0; index -= 1) {
                const row = tableRows[index];
                const matches =
                  row.user_id === actor &&
                  filters.every(([column, value]) => row[column] === value);
                if (matches) {
                  tableRows.splice(index, 1);
                }
              }
              onFulfilled({ error: null });
              return;
            }
            const data = tableRows.filter(
              (row) =>
                row.user_id === actor &&
                filters.every(([column, value]) => row[column] === value),
            );
            onFulfilled({ data, error: null });
          } catch (error) {
            onRejected?.(error);
          }
        },
      };
      return query;
    },
  };
}

const account = memoryServer();
const phoneStorage = new Map();
let clock = "2026-10-12T01:00:00.000Z";
const phone = new CategoryBudgetSession(
  "user-a",
  memoryStorage(phoneStorage),
  account.remote("user-a"),
  () => clock,
);
phone.commit([
  { category: "Groceries", amount: 80 },
  { category: "Gas", amount: 40 },
]);
await phone.whenIdle();
assert.equal(account.rows.filter((row) => row.user_id === "user-a").length, 2);

const afterLogin = new CategoryBudgetSession(
  "user-a",
  memoryStorage(phoneStorage),
  account.remote("user-a"),
  () => clock,
);
const relogin = await afterLogin.load();
assert.deepEqual(relogin.budgets, [
  { category: "Gas", amount: 40 },
  { category: "Groceries", amount: 80 },
]);

const reinstall = new CategoryBudgetSession(
  "user-a",
  memoryStorage(new Map()),
  account.remote("user-a"),
  () => clock,
);
const restored = await reinstall.load();
assert.deepEqual(restored.budgets, relogin.budgets);
assert.equal(restored.message, null);

clock = "2026-10-12T02:00:00.000Z";
const tablet = new CategoryBudgetSession(
  "user-a",
  memoryStorage(new Map()),
  account.remote("user-a"),
  () => clock,
);
const tabletLoaded = await tablet.load();
assert.equal(tabletLoaded.budgets.find((item) => item.category === "Groceries").amount, 80);
tablet.commit([
  { category: "Gas", amount: 40 },
  { category: "Groceries", amount: 95 },
]);
await tablet.whenIdle();
const phoneRefresh = await phone.load();
assert.equal(
  phoneRefresh.budgets.find((item) => item.category === "Groceries").amount,
  95,
);

const otherUser = new CategoryBudgetSession(
  "user-b",
  memoryStorage(new Map()),
  account.remote("user-b"),
  () => clock,
);
assert.deepEqual((await otherUser.load()).budgets, []);

let online = false;
const offlineServer = memoryServer();
const offlineStorage = new Map();
const offlineRemote = {
  async list() {
    if (!online) {
      throw new Error("offline");
    }
    return offlineServer.remote("user-a").list();
  },
  async save(record) {
    if (!online) {
      throw new Error("offline");
    }
    return offlineServer.remote("user-a").save(record);
  },
  async remove(category) {
    if (!online) {
      throw new Error("offline");
    }
    return offlineServer.remote("user-a").remove(category);
  },
};
const offlineSession = new CategoryBudgetSession(
  "user-a",
  memoryStorage(offlineStorage),
  offlineRemote,
  () => "2026-10-12T03:00:00.000Z",
);
let offlineState = null;
offlineSession.subscribe((state) => {
  offlineState = state;
});
const offlineCommit = offlineSession.commit([{ category: "Groceries", amount: 55 }]);
assert.equal(offlineCommit.budgets[0].amount, 55);
await offlineSession.whenIdle();
assert.equal(offlineState.status, "offline");
assert.match(offlineState.message, /Saved on this device/);
assert.equal(offlineServer.rows.length, 0);
const offlineReload = new CategoryBudgetSession(
  "user-a",
  memoryStorage(offlineStorage),
  offlineRemote,
  () => "2026-10-12T03:00:00.000Z",
);
const offlineCached = await offlineReload.load();
assert.equal(offlineCached.status, "offline");
assert.equal(offlineCached.budgets[0].amount, 55);
online = true;
const onlineAgain = await offlineReload.load();
assert.equal(onlineAgain.status, "ready");
assert.equal(onlineAgain.message, null);
assert.equal(offlineServer.rows[0].amount, 55);

const staleServer = memoryServer();
let resolveList = null;
const staleRemote = {
  list() {
    return new Promise((resolve) => {
      resolveList = resolve;
    });
  },
  save: (record) => staleServer.remote("user-a").save(record),
  remove: (category) => staleServer.remote("user-a").remove(category),
};
const staleSession = new CategoryBudgetSession(
  "user-a",
  memoryStorage(new Map()),
  staleRemote,
  () => "2026-10-12T04:00:00.000Z",
);
const staleLoad = staleSession.load();
staleSession.commit([{ category: "Groceries", amount: 70 }]);
resolveList([
  { category: "Groceries", amount: 10, updatedAt: "2026-10-01T00:00:00.000Z" },
  { category: "Rent", amount: 400, updatedAt: "2026-10-11T00:00:00.000Z" },
]);
const staleResult = await staleLoad;
assert.equal(staleResult.budgets.find((item) => item.category === "Groceries").amount, 70);
assert.equal(staleResult.budgets.find((item) => item.category === "Rent").amount, 400);
await staleSession.whenIdle();
assert.equal(staleServer.rows.find((row) => row.category === "Groceries").amount, 70);

const legacyStorage = new Map();
legacyStorage.set(
  "buxme-category-budgets:user-a",
  JSON.stringify([{ category: "Groceries", amount: 33 }]),
);
const legacyServer = memoryServer();
legacyServer.rows.push({
  user_id: "user-a",
  category: "Restaurants",
  amount: 20,
  updated_at: "2026-10-01T00:00:00.000Z",
});
const legacySession = new CategoryBudgetSession(
  "user-a",
  memoryStorage(legacyStorage),
  legacyServer.remote("user-a"),
  () => "2026-10-12T05:00:00.000Z",
);
const legacyLoaded = await legacySession.load();
assert.equal(legacyLoaded.budgets.find((item) => item.category === "Groceries").amount, 33);
assert.equal(legacyLoaded.budgets.find((item) => item.category === "Restaurants").amount, 20);
assert.equal(legacyServer.rows.find((row) => row.category === "Groceries").amount, 33);

const legacyConflictStorage = new Map();
legacyConflictStorage.set(
  "buxme-category-budgets:user-c",
  JSON.stringify([{ category: "Groceries", amount: 33 }]),
);
const legacyConflictServer = memoryServer();
legacyConflictServer.rows.push({
  user_id: "user-c",
  category: "Groceries",
  amount: 50,
  updated_at: "2026-10-02T00:00:00.000Z",
});
const legacyConflict = await new CategoryBudgetSession(
  "user-c",
  memoryStorage(legacyConflictStorage),
  legacyConflictServer.remote("user-c"),
  () => "2026-10-12T05:00:00.000Z",
).load();
assert.equal(legacyConflict.budgets[0].amount, 50);
assert.equal(legacyConflictServer.rows[0].amount, 50);

const ownedRows = [
  {
    user_id: "user-a",
    category: "Groceries",
    amount: 80,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    user_id: "user-b",
    category: "Rent",
    amount: 900,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
];
const ownerRemote = createSupabaseCategoryBudgetRemote(
  createStubClient(ownedRows, "user-a"),
  "user-a",
);
assert.deepEqual(await ownerRemote.list(), [
  {
    category: "Groceries",
    amount: 80,
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
]);
await ownerRemote.save({
  category: "Groceries",
  amount: 120,
  updatedAt: "2026-10-02T00:00:00.000Z",
});
assert.equal(ownedRows.find((row) => row.user_id === "user-a").amount, 120);
assert.equal(ownedRows.find((row) => row.user_id === "user-b").amount, 900);
const hostile = createSupabaseCategoryBudgetRemote(
  createStubClient(ownedRows, "user-b"),
  "user-a",
);
await assert.rejects(() =>
  hostile.save({
    category: "Groceries",
    amount: 1,
    updatedAt: "2026-10-03T00:00:00.000Z",
  }),
);

const emptyLoad = await new CategoryBudgetSession(
  "user-z",
  memoryStorage(new Map()),
  {
    async list() {
      throw new Error("offline");
    },
    async save() {
      throw new Error("offline");
    },
    async remove() {
      throw new Error("offline");
    },
  },
).load();
assert.equal(emptyLoad.status, "error");
assert.match(emptyLoad.message, /couldn't be loaded/);

console.log("Category budget, refund, transfer, and privacy checks passed.");
