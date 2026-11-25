export type SplitMode = "equal" | "exact" | "percent" | "shares";
export type Share = { userId: string; cents: number };
export type LedgerExpense = {
  paidBy: string;
  shares: Share[];
  amountCents: number;
};
export type LedgerSettlement = {
  from: string;
  to: string;
  amountCents: number;
};
export type Transfer = { from: string; to: string; cents: number };

export function parseMoney(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "");
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatMoney(cents: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function apportion(total: number, weights: number[], ids: string[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.some((w) => !Number.isFinite(w) || w < 0))
    throw new Error("Enter valid split values.");
  const raw = weights.map((w) => (total * w) / sum);
  const amounts = raw.map(Math.floor);
  let remainder = total - amounts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({
      index,
      fraction: value - amounts[index],
      id: ids[index],
    }))
    .sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id));
  for (let i = 0; i < remainder; i++) amounts[order[i].index]++;
  return amounts;
}

export function calculateShares(
  total: number,
  ids: string[],
  mode: SplitMode,
  values: string[] = [],
): Share[] {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    ids.length === 0 ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("Enter a valid amount and select at least one person.");
  }
  if (mode === "equal") {
    const amounts = apportion(
      total,
      ids.map(() => 1),
      ids,
    );
    return ids.map((userId, i) => ({ userId, cents: amounts[i] }));
  }
  if (values.length !== ids.length)
    throw new Error("Complete every split value.");
  if (mode === "exact") {
    const amounts = values.map((value) =>
      /^0(?:\.0{1,2})?$/.test(value.trim()) ? 0 : parseMoney(value),
    );
    if (
      amounts.some((value) => value === null) ||
      amounts.reduce<number>((a, b) => a + (b ?? 0), 0) !== total
    ) {
      throw new Error("Exact amounts must add up to the total.");
    }
    return ids.map((userId, i) => ({ userId, cents: amounts[i]! }));
  }
  const weights = values.map((value) => Number(value));
  if (
    weights.some(
      (w, i) =>
        !/^(?:\d+)(?:\.\d{1,2})?$/.test(values[i].trim()) ||
        !Number.isFinite(w) ||
        w < 0 ||
        w > 100000,
    )
  ) {
    throw new Error("Enter valid split values.");
  }
  if (
    mode === "percent" &&
    Math.round(weights.reduce((a, b) => a + b, 0) * 100) !== 10000
  ) {
    throw new Error("Percentages must add up to 100%.");
  }
  return ids.map((userId, i) => ({
    userId,
    cents: apportion(total, weights, ids)[i],
  }));
}

export function balances(
  ids: string[],
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
): Record<string, number> {
  const result = Object.fromEntries(ids.map((id) => [id, 0])) as Record<
    string,
    number
  >;
  for (const expense of expenses) {
    if (!(expense.paidBy in result)) throw new Error("Unknown payer.");
    if (
      expense.shares.reduce((sum, share) => sum + share.cents, 0) !==
      expense.amountCents
    )
      throw new Error("Expense does not balance.");
    result[expense.paidBy] += expense.amountCents;
    for (const share of expense.shares) {
      if (!(share.userId in result)) throw new Error("Unknown participant.");
      result[share.userId] -= share.cents;
    }
  }
  for (const settlement of settlements) {
    if (!(settlement.from in result) || !(settlement.to in result))
      throw new Error("Unknown settlement member.");
    result[settlement.from] += settlement.amountCents;
    result[settlement.to] -= settlement.amountCents;
  }
  if (Object.values(result).reduce((a, b) => a + b, 0) !== 0)
    throw new Error("Ledger does not balance.");
  return result;
}

export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net)
    .filter(([, cents]) => cents < 0)
    .map(([id, cents]) => ({ id, cents: -cents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = Object.entries(net)
    .filter(([, cents]) => cents > 0)
    .map(([id, cents]) => ({ id, cents }))
    .sort((a, b) => b.cents - a.cents);
  const transfers: Transfer[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].cents, creditors[j].cents);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, cents });
    debtors[i].cents -= cents;
    creditors[j].cents -= cents;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return transfers;
}
