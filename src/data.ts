import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import type {
  LedgerExpense,
  LedgerSettlement,
  Share,
  SplitMode,
} from "./money";
import {
  localAddExpense,
  localAddMember,
  localCreateGroup,
  localRecordSettlement,
  localSnapshot,
  localVoidEntry,
} from "./local";
export { LOCAL_USER_ID } from "./local";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Person = { id: string; name: string };
export type Group = {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  inviteCode: string;
  members: Person[];
};
export type Expense = LedgerExpense & {
  id: string;
  groupId: string;
  title: string;
  category: string;
  splitMode: SplitMode;
  createdAt: string;
  createdBy: string;
};
export type Settlement = LedgerSettlement & {
  id: string;
  groupId: string;
  createdAt: string;
  createdBy: string;
};
export type Snapshot = {
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
};

function check<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

async function fetchAll(
  makePage: (from: number, to: number) => PromiseLike<any>,
): Promise<any[]> {
  const rows: any[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const page = check(await makePage(offset, offset + size - 1)) as any[];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

async function fetchInBatches(
  values: string[],
  makePage: (batch: string[], from: number, to: number) => PromiseLike<any>,
): Promise<any[]> {
  const chunks: Promise<any[]>[] = [];
  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100);
    chunks.push(fetchAll((from, to) => makePage(batch, from, to)));
  }
  return (await Promise.all(chunks)).flat();
}

export async function loadSnapshot(): Promise<Snapshot> {
  if (!supabase) return localSnapshot();
  const membership = (await fetchAll((from, to) =>
    supabase
      .from("group_members")
      .select("group_id,user_id")
      .order("group_id")
      .order("user_id")
      .range(from, to),
  )) as { group_id: string; user_id: string }[];
  const ids = [...new Set(membership.map((m) => m.group_id))];
  if (ids.length === 0) return { groups: [], expenses: [], settlements: [] };
  const [rawGroups, rawExpenses, rawSettlements] = await Promise.all([
    fetchInBatches(ids, (batch, from, to) =>
      supabase!
        .from("groups")
        .select("id,name,emoji,currency,invite_code")
        .in("id", batch)
        .order("id")
        .range(from, to),
    ),
    fetchInBatches(ids, (batch, from, to) =>
      supabase!
        .from("expenses")
        .select(
          "id,group_id,title,category,amount_cents,paid_by,split_mode,created_at,created_by",
        )
        .in("group_id", batch)
        .is("voided_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    fetchInBatches(ids, (batch, from, to) =>
      supabase!
        .from("settlements")
        .select(
          "id,group_id,from_user,to_user,amount_cents,created_at,created_by",
        )
        .in("group_id", batch)
        .is("voided_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
  ]);
  const rawMembers = membership;
  const peopleIds = [...new Set(rawMembers.map((m) => m.user_id))];
  const profiles = await fetchInBatches(peopleIds, (batch, from, to) =>
    supabase!
      .from("profiles")
      .select("id,display_name")
      .in("id", batch)
      .order("id")
      .range(from, to),
  );
  const names = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));
  const expenseIds = rawExpenses.map((e) => e.id);
  const shares = await fetchInBatches(expenseIds, (batch, from, to) =>
    supabase!
      .from("expense_shares")
      .select("expense_id,user_id,amount_cents")
      .in("expense_id", batch)
      .order("expense_id")
      .order("user_id")
      .range(from, to),
  );
  const membersByGroup = new Map<string, Person[]>();
  for (const member of rawMembers) {
    const list = membersByGroup.get(member.group_id) || [];
    list.push({ id: member.user_id, name: names[member.user_id] || "Friend" });
    membersByGroup.set(member.group_id, list);
  }
  const sharesByExpense = new Map<string, Share[]>();
  for (const share of shares) {
    const list = sharesByExpense.get(share.expense_id) || [];
    list.push({ userId: share.user_id, cents: Number(share.amount_cents) });
    sharesByExpense.set(share.expense_id, list);
  }
  return {
    groups: rawGroups.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      currency: g.currency,
      inviteCode: g.invite_code,
      members: membersByGroup.get(g.id) || [],
    })),
    expenses: rawExpenses.map((e) => ({
      id: e.id,
      groupId: e.group_id,
      title: e.title,
      category: e.category,
      amountCents: Number(e.amount_cents),
      paidBy: e.paid_by,
      splitMode: e.split_mode,
      createdAt: e.created_at,
      createdBy: e.created_by,
      shares: sharesByExpense.get(e.id) || [],
    })),
    settlements: rawSettlements.map((s) => ({
      id: s.id,
      groupId: s.group_id,
      from: s.from_user,
      to: s.to_user,
      amountCents: Number(s.amount_cents),
      createdAt: s.created_at,
      createdBy: s.created_by,
    })),
  };
}

export async function createGroup(
  name: string,
  emoji: string,
  currency: string,
) {
  if (!supabase) return localCreateGroup(name, emoji, currency);
  return check(
    await supabase.rpc("create_group", {
      p_name: name,
      p_emoji: emoji,
      p_currency: currency,
    }),
  );
}
export async function joinGroup(code: string) {
  if (!supabase)
    throw new Error(
      "Invite codes need shared cloud sync. Configure Supabase to join friends on other phones.",
    );
  return check(await supabase.rpc("join_group", { p_code: code }));
}
export async function addExpense(
  groupId: string,
  title: string,
  category: string,
  amountCents: number,
  paidBy: string,
  splitMode: SplitMode,
  shares: Share[],
) {
  if (!supabase)
    return localAddExpense(
      groupId,
      title,
      category,
      amountCents,
      paidBy,
      splitMode,
      shares,
    );
  return check(
    await supabase.rpc("add_expense", {
      p_group_id: groupId,
      p_title: title,
      p_category: category,
      p_amount_cents: amountCents,
      p_paid_by: paidBy,
      p_split_mode: splitMode,
      p_shares: shares.map((s) => ({ userId: s.userId, cents: s.cents })),
    }),
  );
}
export async function recordSettlement(
  groupId: string,
  from: string,
  to: string,
  amountCents: number,
) {
  if (!supabase) return localRecordSettlement(groupId, from, to, amountCents);
  return check(
    await supabase.rpc("record_settlement", {
      p_group_id: groupId,
      p_from: from,
      p_to: to,
      p_amount_cents: amountCents,
    }),
  );
}

export async function voidEntry(kind: "expense" | "settlement", id: string) {
  if (!supabase) return localVoidEntry(kind, id);
  return check(
    await supabase.rpc(
      kind === "expense" ? "void_expense" : "void_settlement",
      {
        [kind === "expense" ? "p_expense_id" : "p_settlement_id"]: id,
      },
    ),
  );
}

export async function addLocalMember(groupId: string, name: string) {
  if (supabase)
    throw new Error("Friends join cloud groups with an invite code.");
  return localAddMember(groupId, name);
}
