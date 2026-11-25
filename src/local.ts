import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Snapshot } from "./data";
import type { Share, SplitMode } from "./money";
import { calculateShares } from "./money";

export const LOCAL_USER_ID = "local-you";
const KEY = "orbit-split-local-preview-v1";
type Store = Snapshot & { voidedIds: string[] };

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function seed(): Store {
  const groupId = "preview-weekend";
  const members = [
    { id: LOCAL_USER_ID, name: "You" },
    { id: "preview-ava", name: "Ava" },
    { id: "preview-sam", name: "Sam" },
  ];
  return {
    groups: [
      {
        id: groupId,
        name: "Weekend crew",
        emoji: "🌴",
        currency: "INR",
        inviteCode: "PREVIEW ONLY",
        members,
      },
    ],
    expenses: [
      {
        id: "preview-dinner",
        groupId,
        title: "Dinner by the beach",
        category: "Food",
        amountCents: 168000,
        paidBy: LOCAL_USER_ID,
        splitMode: "equal",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        createdBy: LOCAL_USER_ID,
        shares: calculateShares(
          168000,
          members.map((m) => m.id),
          "equal",
        ),
      },
      {
        id: "preview-cab",
        groupId,
        title: "Cab to the coast",
        category: "Travel",
        amountCents: 45000,
        paidBy: "preview-ava",
        splitMode: "equal",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        createdBy: LOCAL_USER_ID,
        shares: calculateShares(
          45000,
          members.map((m) => m.id),
          "equal",
        ),
      },
    ],
    settlements: [],
    voidedIds: [],
  };
}
async function read(): Promise<Store> {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved) return JSON.parse(saved) as Store;
  const initial = seed();
  await AsyncStorage.setItem(KEY, JSON.stringify(initial));
  return initial;
}
async function update(change: (store: Store) => void) {
  const store = await read();
  change(store);
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}
export async function localSnapshot(): Promise<Snapshot> {
  const store = await read();
  return {
    groups: store.groups,
    expenses: store.expenses.filter((e) => !store.voidedIds.includes(e.id)),
    settlements: store.settlements.filter(
      (s) => !store.voidedIds.includes(s.id),
    ),
  };
}
export async function localCreateGroup(
  name: string,
  emoji: string,
  currency: string,
) {
  const groupId = id();
  await update((store) =>
    store.groups.push({
      id: groupId,
      name: name.trim(),
      emoji,
      currency,
      inviteCode: "PREVIEW ONLY",
      members: [{ id: LOCAL_USER_ID, name: "You" }],
    }),
  );
  return groupId;
}
export async function localAddMember(groupId: string, name: string) {
  if (!name.trim() || name.trim().length > 60)
    throw new Error("Enter a name up to 60 characters.");
  await update((store) => {
    const group = store.groups.find((g) => g.id === groupId);
    if (!group) throw new Error("Group not found.");
    group.members.push({ id: id(), name: name.trim() });
  });
}
export async function localAddExpense(
  groupId: string,
  title: string,
  category: string,
  amountCents: number,
  paidBy: string,
  splitMode: SplitMode,
  shares: Share[],
) {
  await update((store) => {
    const group = store.groups.find((g) => g.id === groupId);
    if (!group) throw new Error("Group not found.");
    const memberIds = new Set(group.members.map((m) => m.id));
    if (
      !title.trim() ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      !memberIds.has(paidBy) ||
      shares.length === 0 ||
      new Set(shares.map((s) => s.userId)).size !== shares.length ||
      shares.some((s) => !memberIds.has(s.userId) || s.cents < 0) ||
      shares.reduce((sum, s) => sum + s.cents, 0) !== amountCents
    )
      throw new Error("Check the amount and split.");
    store.expenses.push({
      id: id(),
      groupId,
      title: title.trim(),
      category,
      amountCents,
      paidBy,
      splitMode,
      shares,
      createdAt: new Date().toISOString(),
      createdBy: LOCAL_USER_ID,
    });
  });
}
export async function localRecordSettlement(
  groupId: string,
  from: string,
  to: string,
  amountCents: number,
) {
  await update((store) => {
    const group = store.groups.find((g) => g.id === groupId);
    const memberIds = new Set(group?.members.map((m) => m.id) || []);
    if (
      from !== LOCAL_USER_ID ||
      from === to ||
      !memberIds.has(to) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0
    )
      throw new Error("Check the payment.");
    store.settlements.push({
      id: id(),
      groupId,
      from,
      to,
      amountCents,
      createdAt: new Date().toISOString(),
      createdBy: LOCAL_USER_ID,
    });
  });
}
export async function localVoidEntry(
  kind: "expense" | "settlement",
  entryId: string,
) {
  await update((store) => {
    const item =
      kind === "expense"
        ? store.expenses.find((e) => e.id === entryId)
        : store.settlements.find((s) => s.id === entryId);
    if (
      !item ||
      item.createdBy !== LOCAL_USER_ID ||
      store.voidedIds.includes(entryId)
    )
      throw new Error("Entry cannot be removed.");
    store.voidedIds.push(entryId);
  });
}
