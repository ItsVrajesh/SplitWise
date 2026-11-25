import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMoney,
  calculateShares,
  balances,
  simplifyDebts,
} from "../src/money.ts";

test("money input rejects fractions of a cent and invalid values", () => {
  assert.equal(parseMoney("1,234.56"), 123456);
  assert.equal(parseMoney("0.01"), 1);
  assert.equal(parseMoney("0.001"), null);
  assert.equal(parseMoney("-2"), null);
  assert.equal(parseMoney("0"), null);
});
test("equal split keeps every cent with deterministic tie breaking", () => {
  assert.deepEqual(calculateShares(100, ["c", "b", "a"], "equal"), [
    { userId: "c", cents: 33 },
    { userId: "b", cents: 33 },
    { userId: "a", cents: 34 },
  ]);
});
test("exact, percentage, and weighted shares sum to the original total", () => {
  assert.deepEqual(
    calculateShares(101, ["a", "b"], "exact", ["1.00", "0.01"]).map(
      (s) => s.cents,
    ),
    [100, 1],
  );
  assert.deepEqual(
    calculateShares(101, ["a", "b"], "percent", ["50", "50"]).map(
      (s) => s.cents,
    ),
    [51, 50],
  );
  assert.deepEqual(
    calculateShares(101, ["a", "b"], "shares", ["1", "2"]).map((s) => s.cents),
    [34, 67],
  );
  assert.throws(() =>
    calculateShares(100, ["a", "b"], "exact", ["0.20", "0.20"]),
  );
  assert.throws(() =>
    calculateShares(100, ["a", "b"], "percent", ["20", "20"]),
  );
});
test("balances and settlements preserve zero sum", () => {
  const expenses = [
    {
      paidBy: "a",
      amountCents: 1200,
      shares: calculateShares(1200, ["a", "b", "c"], "equal"),
    },
  ];
  const before = balances(["a", "b", "c"], expenses, []);
  assert.deepEqual(before, { a: 800, b: -400, c: -400 });
  assert.deepEqual(simplifyDebts(before), [
    { from: "b", to: "a", cents: 400 },
    { from: "c", to: "a", cents: 400 },
  ]);
  assert.deepEqual(
    balances(["a", "b", "c"], expenses, [
      { from: "b", to: "a", amountCents: 400 },
    ]),
    { a: 400, b: 0, c: -400 },
  );
});

test("many uneven splits and suggested payments settle exactly", () => {
  const ids = ["a", "b", "c", "d", "e"];
  for (let total = 1; total <= 250; total++) {
    const shares = calculateShares(total, ids, "shares", [
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    assert.equal(
      shares.reduce((sum, share) => sum + share.cents, 0),
      total,
    );
    const net = balances(
      ids,
      [{ paidBy: "c", amountCents: total, shares }],
      [],
    );
    const transfers = simplifyDebts(net);
    const settled = balances(
      ids,
      [{ paidBy: "c", amountCents: total, shares }],
      transfers.map((t) => ({ from: t.from, to: t.to, amountCents: t.cents })),
    );
    assert.deepEqual(Object.values(settled), [0, 0, 0, 0, 0]);
  }
});
