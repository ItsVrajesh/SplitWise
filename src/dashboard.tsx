import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  CirclePlus,
  House,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  UsersRound,
  Utensils,
  Plane,
  BedDouble,
  ShoppingBag,
  Receipt,
  Sparkles,
  Circle,
} from "lucide-react-native";
import type { Snapshot, Expense, Group } from "./data";
import { balances, formatMoney } from "./money";
import { palette as T, categoryColors } from "./theme";

const categoryGlyphs = {
  Food: Utensils,
  Travel: Plane,
  Stay: BedDouble,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Fun: Sparkles,
  Other: Circle,
} as const;
type Tab = "home" | "insights" | "groups" | "settings";
export type DashboardActions = {
  home: () => void;
  insights: () => void;
  groups: () => void;
  settings: () => void;
  add: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedPath = Animated.createAnimatedComponent(Path);
function BalanceSummary({ amount, currency }: { amount: number; currency: string }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    progress.set(reducedMotion ? 1 : 0);
    if (!reducedMotion) progress.set(withTiming(1, { duration: 650 }));
  }, [progress, reducedMotion, amount]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * 9 }] }));
  return <Animated.View style={[d.balanceSummary, motion]} accessibilityLabel={`Overall balance ${formatMoney(Math.abs(amount), currency)}`}>
    <Text style={d.balanceEyebrow}>YOUR OVERALL BALANCE</Text>
    <Text style={d.balanceNumber} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(Math.abs(amount), currency)}</Text>
    <Text style={d.balanceMeaning}>{amount > 0 ? "You are owed overall" : amount < 0 ? "You owe overall" : "All settled up"}</Text>
  </Animated.View>;
}
function Touch({ children, onPress, style, label }: { children: React.ReactNode; onPress: () => void; style?: any; label: string }) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={() => scale.set(withSpring(0.97, { stiffness: 420, damping: 24 }))}
      onPressOut={() => scale.set(withSpring(1, { stiffness: 420, damping: 24 }))}
      style={[style, motion]}
    >
      {children}
    </AnimatedPressable>
  );
}
function Enter({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  if (Platform.OS === "web") return <View>{children}</View>;
  return <Animated.View entering={FadeInDown.delay(delay).duration(420)}>{children}</Animated.View>;
}
export function DashboardNav({ selected, actions }: { selected: Tab; actions: DashboardActions }) {
  const tabs = [
    { id: "home" as const, label: "Home", Icon: House, onPress: actions.home },
    { id: "insights" as const, label: "Insight", Icon: ChartNoAxesCombined, onPress: actions.insights },
    { id: "groups" as const, label: "Groups", Icon: UsersRound, onPress: actions.groups },
    { id: "settings" as const, label: "Settings", Icon: Settings2, onPress: actions.settings },
  ];
  return (
    <View style={d.navWrap}>
      <View style={d.nav}>
        {tabs.map((tab, index) => (
          <React.Fragment key={tab.id}>
            {index === 2 && <View style={d.navGap} />}
            <Touch label={`${tab.label} tab`} onPress={tab.onPress} style={d.navItem}>
              <tab.Icon size={20} strokeWidth={selected === tab.id ? 2.4 : 1.8} color={selected === tab.id ? T.purple : T.muted} />
              <Text style={[d.navLabel, selected === tab.id && d.navLabelActive]}>{tab.label}</Text>
            </Touch>
          </React.Fragment>
        ))}
      </View>
      <Touch label="Add expense" onPress={actions.add} style={d.fab}>
        <Plus color="#FFFFFF" size={26} strokeWidth={1.8} />
      </Touch>
    </View>
  );
}

function currencyFor(data: Snapshot) { return data.groups[0]?.currency || "INR"; }
function groupFor(data: Snapshot, expense: Expense) { return data.groups.find((g) => g.id === expense.groupId); }
function myShare(expense: Expense, userId: string) { return expense.shares.find((s) => s.userId === userId)?.cents || 0; }
function usableExpenses(data: Snapshot, currency: string) {
  return data.expenses.filter((e) => groupFor(data, e)?.currency === currency);
}
function monthName(date: Date) { return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function currentMonth(dateString: string, now = new Date()) {
  const date = new Date(dateString);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
function dailySeries(expenses: Expense[], userId: string, monthOnly: boolean) {
  const now = new Date();
  const days = monthOnly ? now.getDate() : 30;
  const values = Array.from({ length: Math.max(2, days) }, () => 0);
  for (const expense of expenses) {
    const date = new Date(expense.createdAt);
    if (monthOnly) {
      if (currentMonth(expense.createdAt)) values[date.getDate() - 1] += myShare(expense, userId);
    } else {
      const index = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
      if (index >= 0 && index < 30) values[29 - index] += myShare(expense, userId);
    }
  }
  return values;
}
function TrendChart({ values }: { values: number[] }) {
  const reducedMotion = useReducedMotion();
  const draw = useSharedValue(700);
  const signature = values.join(",");
  useEffect(() => {
    draw.set(reducedMotion ? 0 : 700);
    if (!reducedMotion) draw.set(withTiming(0, { duration: 1150 }));
  }, [draw, reducedMotion, signature]);
  const animatedLine = useAnimatedProps(() => ({ strokeDashoffset: draw.get() }));
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => ({ x: 4 + i * (292 / Math.max(1, values.length - 1)), y: 89 - (v / max) * 69 }));
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L296 94 L4 94 Z`;
  return (
    <View accessibilityLabel="Spending trend chart" style={d.chart}>
      <Svg width="100%" height="112" viewBox="0 0 300 100" preserveAspectRatio="none">
        <Defs><SvgGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={T.purple} stopOpacity="0.3" /><Stop offset="1" stopColor={T.purple} stopOpacity="0" /></SvgGradient></Defs>
        <Path d="M4 94 H296" stroke="#334039" strokeWidth="1" />
        <Path d="M4 56 H296" stroke="#29342E" strokeWidth="1" />
        <Path d={area} fill="url(#trendFill)" />
        <Path d={line} fill="none" stroke={T.purple} strokeWidth="12" opacity="0.08" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={line} fill="none" stroke={T.purple} strokeWidth="6" opacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
        <AnimatedPath d={line} fill="none" stroke="#72D8AE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="700" animatedProps={animatedLine} />
      </Svg>
      <View style={d.chartLabels}><Text style={d.chartAxis}>Start</Text><Text style={d.chartAxis}>Mid</Text><Text style={d.chartAxis}>Today</Text></View>
    </View>
  );
}
function SectionHeading({ title, detail, onPress }: { title: string; detail?: string; onPress?: () => void }) {
  return <View style={d.sectionHead}><Text style={d.sectionTitle}>{title}</Text>{detail && (onPress ? <Touch label={detail} onPress={onPress}><Text style={d.sectionLink}>{detail}</Text></Touch> : <Text style={d.sectionDetail}>{detail}</Text>)}</View>;
}
function PeriodSwitch({ period, onChange }: { period: "month" | "all"; onChange: (period: "month" | "all") => void }) {
  const [width, setWidth] = useState(0);
  const position = useSharedValue(0);
  useEffect(() => {
    position.set(withSpring(period === "month" ? 0 : 1, { stiffness: 360, damping: 30 }));
  }, [period, position]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * Math.max(0, (width - 8) / 2) }] }));
  return <View style={d.segment} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <Animated.View pointerEvents="none" style={[d.segmentThumb, { width: Math.max(0, (width - 8) / 2) }, motion]} />
    <Touch label="This month" onPress={() => onChange("month")} style={d.segmentItem}><Text style={[d.segmentText, period === "month" && d.segmentTextActive]}>Month</Text></Touch>
    <Touch label="All time" onPress={() => onChange("all")} style={d.segmentItem}><Text style={[d.segmentText, period === "all" && d.segmentTextActive]}>All time</Text></Touch>
  </View>;
}
function ActivityRow({ expense, group, userId, onPress }: { expense: Expense; group?: Group; userId: string; onPress: () => void }) {
  const Icon = categoryGlyphs[expense.category as keyof typeof categoryGlyphs] || Circle;
  const color = categoryColors[expense.category] || categoryColors.Other;
  return (
    <Touch label={`Open ${expense.title}`} onPress={onPress} style={d.activityRow}>
      <View style={[d.activityIcon, { backgroundColor: `${color}15` }]}><Icon size={20} color={color} /></View>
      <View style={{ flex: 1 }}><Text style={d.rowTitle} numberOfLines={1}>{expense.title}</Text><Text style={d.rowMeta}>{group?.name || "Group"} · {new Date(expense.createdAt).toLocaleDateString()}</Text></View>
      <View style={{ alignItems: "flex-end" }}><Text style={d.rowAmount}>{formatMoney(myShare(expense, userId), group?.currency || "INR")}</Text><Text style={d.rowMeta}>your share</Text></View>
    </Touch>
  );
}

export function DashboardHome({ data, userId, actions, openGroup, refresh, preview }: { data: Snapshot; userId: string; actions: DashboardActions; openGroup: (id: string) => void; refresh: () => void; preview: boolean }) {
  const currency = currencyFor(data);
  const mixedCurrencies = new Set(data.groups.map((group) => group.currency)).size > 1;
  const expenses = usableExpenses(data, currency);
  const monthly = expenses.filter((e) => currentMonth(e.createdAt));
  const spent = monthly.reduce((sum, e) => sum + myShare(e, userId), 0);
  const rows = data.groups.map((group) => ({ group, net: balances(group.members.map((m) => m.id), data.expenses.filter((e) => e.groupId === group.id), data.settlements.filter((t) => t.groupId === group.id))[userId] || 0 }));
  const receive = rows.filter((r) => r.group.currency === currency).reduce((sum, r) => sum + Math.max(0, r.net), 0);
  const pay = rows.filter((r) => r.group.currency === currency).reduce((sum, r) => sum + Math.max(0, -r.net), 0);
  const recent = [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  return <View style={d.screen}>
    <ScrollView contentContainerStyle={d.scroll} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[T.heroStart, T.heroMiddle, T.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={d.homeHero}>
        <View style={d.heroHeader}>
          <View style={d.avatar}><Text style={d.avatarText}>O</Text></View>
          <Text style={d.heroBrand}>Orbit Split</Text>
          <Touch label="Refresh expenses" onPress={refresh} style={d.heroIconButton}><RefreshCw size={18} color="#FFFFFF" /></Touch>
        </View>
        <BalanceSummary amount={receive - pay} currency={currency} />
        {mixedCurrencies && <Text style={d.balanceMeaning}>{currency} groups only</Text>}
        <View style={d.heroStats}>
          <View style={d.heroStat}><Text style={d.heroStatLabel}>TO RECEIVE</Text><Text style={d.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(receive, currency)}</Text></View>
          <View style={d.heroStatRule} />
          <View style={d.heroStat}><Text style={d.heroStatLabel}>TO PAY</Text><Text style={d.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(pay, currency)}</Text></View>
          <View style={d.heroStatRule} />
          <View style={d.heroStat}><Text style={d.heroStatLabel}>THIS MONTH</Text><Text style={d.heroStatValue}>{formatMoney(spent, currency)}</Text></View>
        </View>
      </LinearGradient>
      <View style={d.sheet}>
        {preview && <View style={d.previewBanner}><View style={d.previewDot} /><Text style={d.previewText}>Preview mode · saved on this phone</Text></View>}
        <Enter delay={40}><SectionHeading title="Your groups" detail="View all" onPress={actions.groups} />{rows.slice(0, 4).map(({ group, net }) => <Touch key={group.id} label={`Open ${group.name}`} onPress={() => openGroup(group.id)} style={d.groupRow}><View style={d.groupIcon}><UsersRound size={19} color={T.purple} /></View><View style={{ flex: 1 }}><Text style={d.rowTitle}>{group.name}</Text><Text style={d.rowMeta}>{group.members.length} members</Text></View><View style={{ alignItems: "flex-end" }}><Text style={[d.rowAmount, { color: net >= 0 ? T.green : T.red }]}>{formatMoney(Math.abs(net), group.currency)}</Text><Text style={d.rowMeta}>{net > 0 ? "you are owed" : net < 0 ? "you owe" : "settled"}</Text></View></Touch>)}{rows.length === 0 && <Touch label="Create a group" onPress={actions.groups} style={d.emptyAction}><CirclePlus size={20} color={T.purple} /><Text style={d.emptyActionText}>Create your first group</Text></Touch>}</Enter>
        <Enter delay={190}><SectionHeading title="Recent expenses" />{recent.map((expense) => <ActivityRow key={expense.id} expense={expense} group={groupFor(data, expense)} userId={userId} onPress={() => openGroup(expense.groupId)} />)}{recent.length === 0 && <Text style={d.emptyText}>Expenses you add with friends will appear here.</Text>}</Enter>
      </View>
    </ScrollView>
    <DashboardNav selected="home" actions={actions} />
  </View>;
}

export function DashboardInsights({ data, userId, actions }: { data: Snapshot; userId: string; actions: DashboardActions }) {
  const [period, setPeriod] = useState<"month" | "all">("month");
  const currency = currencyFor(data);
  const mixedCurrencies = new Set(data.groups.map((group) => group.currency)).size > 1;
  const base = usableExpenses(data, currency);
  const expenses = period === "month" ? base.filter((e) => currentMonth(e.createdAt)) : base;
  const spent = expenses.reduce((sum, e) => sum + myShare(e, userId), 0);
  const categoryTotals = Object.entries(categoryColors).map(([category, color]) => ({ category, color, cents: expenses.filter((e) => e.category === category).reduce((sum, e) => sum + myShare(e, userId), 0) })).filter((x) => x.cents > 0).sort((a, b) => b.cents - a.cents);
  return <View style={d.screen}>
    <ScrollView contentContainerStyle={[d.scroll, { paddingBottom: 108 }]} showsVerticalScrollIndicator={false}>
      <View style={d.insightHead}><View><Text style={d.micro}>YOUR SPENDING</Text><Text style={d.pageTitle}>Insight</Text></View><View style={d.insightIcon}><ChartNoAxesCombined size={21} color={T.purple} /></View></View>
      <PeriodSwitch period={period} onChange={setPeriod} />
      <Enter><View style={d.insightCard}><Text style={d.insightLabel}>{period === "month" ? monthName(new Date()) : "All recorded expenses"}</Text><Text style={d.insightValue}>{formatMoney(spent, currency)}</Text><Text style={d.insightCaption}>Your share across {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</Text><TrendChart values={dailySeries(expenses, userId, period === "month")} /></View></Enter>
      <Enter delay={80}><View style={d.breakdownCard}><SectionHeading title="Category breakdown" />{categoryTotals.length ? categoryTotals.map((item) => { const Icon = categoryGlyphs[item.category as keyof typeof categoryGlyphs] || Circle; return <View key={item.category} style={d.breakdownRow}><View style={[d.breakdownIcon, { backgroundColor: `${item.color}15` }]}><Icon size={17} color={item.color} /></View><Text style={d.breakdownName}>{item.category}</Text><View style={d.breakdownTrack}><View style={[d.breakdownFill, { backgroundColor: item.color, width: `${Math.max(4, item.cents / spent * 100)}%` }]} /></View><Text style={d.breakdownAmount}>{formatMoney(item.cents, currency)}</Text></View>; }) : <Text style={d.emptyText}>Add an expense to see your category breakdown.</Text>}</View></Enter>
      <Enter delay={130}><View style={d.noteCard}><View style={d.noteIcon}><Check size={18} color={T.purple} /></View><Text style={d.noteText}>Insights use your share of each expense{mixedCurrencies ? ` in ${currency} groups` : ""}, so the totals match your actual split.</Text></View></Enter>
    </ScrollView>
    <DashboardNav selected="insights" actions={actions} />
  </View>;
}

export function DashboardGroups({ data, userId, actions, openGroup, createGroup, joinGroup, preview }: { data: Snapshot; userId: string; actions: DashboardActions; openGroup: (id: string) => void; createGroup: () => void; joinGroup: () => void; preview: boolean }) {
  return <View style={d.screen}><ScrollView contentContainerStyle={[d.scroll, { paddingBottom: 112 }]} showsVerticalScrollIndicator={false}>
    <View style={d.insightHead}><View><Text style={d.micro}>SHARED SPACES</Text><Text style={d.pageTitle}>Groups</Text></View><View style={d.insightIcon}><UsersRound size={21} color={T.purple} /></View></View>
    <Text style={d.pageLead}>All your shared expenses, together.</Text>
    <Enter><Touch label="Create group" onPress={createGroup} style={d.primaryAction}><CirclePlus size={20} color="#FFFFFF" /><Text style={d.primaryActionText}>Create a group</Text><ArrowRight size={18} color="#FFFFFF" /></Touch></Enter>
    {!preview && <Touch label="Join group" onPress={joinGroup} style={d.secondaryAction}><UsersRound size={19} color={T.purple} /><Text style={d.secondaryActionText}>Join with an invite code</Text></Touch>}
    <SectionHeading title="Your groups" detail={`${data.groups.length} total`} />
    {data.groups.map((group, index) => { const net = balances(group.members.map((m) => m.id), data.expenses.filter((e) => e.groupId === group.id), data.settlements.filter((t) => t.groupId === group.id))[userId] || 0; return <Enter delay={Math.min(index, 4) * 40} key={group.id}><Touch label={`Open ${group.name}`} onPress={() => openGroup(group.id)} style={d.groupLarge}><View style={d.groupLargeIcon}><UsersRound size={23} color={T.purple} /></View><View style={{ flex: 1 }}><Text style={d.groupLargeTitle}>{group.name}</Text><Text style={d.rowMeta}>{group.members.length} members · {group.currency}</Text><Text style={[d.groupLargeBalance, { color: net >= 0 ? T.green : T.red }]}>{net === 0 ? "All settled" : `${formatMoney(Math.abs(net), group.currency)} ${net > 0 ? "to receive" : "to pay"}`}</Text></View><ArrowRight size={17} color={T.muted} /></Touch></Enter>; })}
    {data.groups.length === 0 && <Text style={d.emptyText}>Create a group to start splitting expenses.</Text>}
  </ScrollView><DashboardNav selected="groups" actions={actions} /></View>;
}

export function DashboardSettings({ actions, refresh, signOut, preview }: { actions: DashboardActions; refresh: () => void; signOut: () => void; preview: boolean }) {
  return <View style={d.screen}><ScrollView contentContainerStyle={[d.scroll, { paddingBottom: 112 }]}><View style={d.insightHead}><View><Text style={d.micro}>ORBIT SPLIT</Text><Text style={d.pageTitle}>Settings</Text></View><View style={d.insightIcon}><Settings2 size={21} color={T.purple} /></View></View>
    <View style={d.settingsCard}><Text style={d.settingsTitle}>{preview ? "Local preview" : "Shared account"}</Text><Text style={d.settingsBody}>{preview ? "Your preview data stays on this phone. Connect Supabase to share a live group with friends." : "Your groups sync through your shared account. Refresh to see the latest changes."}</Text></View>
    <SectionHeading title="Actions" />
    <Touch label="Sync latest activity" onPress={refresh} style={d.settingsRow}><RefreshCw size={19} color={T.purple} /><Text style={d.settingsRowText}>Sync latest activity</Text><ArrowRight size={17} color={T.muted} /></Touch>
    <Touch label="Create a group" onPress={actions.groups} style={d.settingsRow}><UsersRound size={19} color={T.purple} /><Text style={d.settingsRowText}>Manage groups</Text><ArrowRight size={17} color={T.muted} /></Touch>
    <Touch label={preview ? "About preview mode" : "Sign out"} onPress={signOut} style={d.settingsRow}><MoreHorizontal size={19} color={T.purple} /><Text style={d.settingsRowText}>{preview ? "About preview mode" : "Sign out"}</Text><ArrowRight size={17} color={T.muted} /></Touch>
    <Text style={d.settingsFoot}>Orbit Split · Every cent accounted for.</Text>
  </ScrollView><DashboardNav selected="settings" actions={actions} /></View>;
}

const d = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.canvas },
  scroll: { width: "100%", maxWidth: 560, alignSelf: "center", paddingBottom: 100 },
  homeHero: { minHeight: 225, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 49, overflow: "hidden" },
  balanceSummary: { paddingTop: 24 },
  balanceEyebrow: { color: "#B3CDBE", fontSize: 11, letterSpacing: 1.2, fontWeight: "600" },
  balanceNumber: { color: T.ink, fontSize: 40, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: -1.2 },
  balanceMeaning: { color: "#CFDFD4", fontSize: 14 },
  heroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  avatarText: { color: T.purple, fontSize: 20, fontWeight: "800" },
  heroBrand: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 0.1 },
  heroIconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF2B", alignItems: "center", justifyContent: "center" },
  monthPill: { alignSelf: "center", marginTop: 10, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFFFF29" },
  monthPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  heroCaption: { textAlign: "center", color: "#BDA6DE", fontSize: 11, marginTop: 0 },
  heroValue: { color: "#FFFFFF", textAlign: "center", fontSize: 29, fontWeight: "700", letterSpacing: -1.1, marginTop: 3 },
  heroSub: { color: "#BDA6DE", textAlign: "center", fontSize: 10, marginTop: 3 },
  heroStats: { backgroundColor: "#B2DBC00D", borderRadius: 17, borderWidth: 1, borderColor: "#73948255", marginTop: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center" },
  heroStat: { flex: 1, paddingHorizontal: 10 },
  heroStatRule: { width: 1, height: 34, backgroundColor: "#FFFFFF27" },
  heroStatLabel: { color: "#C7DCD1", fontSize: 8, letterSpacing: 0.6, fontWeight: "700" },
  heroStatValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginTop: 5 },
  sheet: { backgroundColor: T.canvas, borderTopLeftRadius: 25, borderTopRightRadius: 25, marginTop: -26, paddingHorizontal: 20, paddingTop: 21, paddingBottom: 26, minHeight: 300 },
  previewBanner: { backgroundColor: T.pale, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 18 },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.purple },
  previewText: { fontSize: 11, color: "#B6DFCB", fontWeight: "600" },
  trendCard: { backgroundColor: T.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: T.line, marginBottom: 20 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13, marginTop: 4 },
  sectionTitle: { color: T.ink, fontSize: 16, fontWeight: "700", letterSpacing: -0.35 },
  sectionDetail: { color: T.muted, fontSize: 11 },
  sectionLink: { color: T.purple, fontSize: 11, fontWeight: "700" },
  chart: { marginTop: 3 },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: -1 },
  chartAxis: { color: T.muted, fontSize: 9 },
  categoryGrid: { flexDirection: "row", gap: 10, marginBottom: 24 },
  categoryCard: { flex: 1, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, borderRadius: 16, padding: 13, minHeight: 126 },
  categoryTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  categoryMiniIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  categoryName: { color: T.ink, fontSize: 12, fontWeight: "600" },
  categoryAmount: { color: T.ink, fontSize: 19, fontWeight: "700", letterSpacing: -0.5, marginTop: 14 },
  barTrack: { height: 4, backgroundColor: "#334039", borderRadius: 2, marginTop: 9, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  categoryFoot: { color: T.muted, fontSize: 10, marginTop: 8 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, borderRadius: 15, padding: 11, marginBottom: 8 },
  groupIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: T.pale, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: T.ink, fontSize: 13, fontWeight: "700" },
  rowMeta: { color: T.muted, fontSize: 12, marginTop: 4 },
  rowAmount: { color: T.ink, fontSize: 12, fontWeight: "700" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: T.line, paddingVertical: 11 },
  activityIcon: { width: 39, height: 39, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  emptyAction: { flexDirection: "row", gap: 8, padding: 18, borderRadius: 15, borderWidth: 1, borderColor: T.line, alignItems: "center" },
  emptyActionText: { color: T.purple, fontWeight: "700", fontSize: 13 },
  emptyText: { color: T.muted, fontSize: 13, lineHeight: 20, paddingVertical: 15 },
  navWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 10, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line, elevation: 10, shadowColor: T.purple, shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.12, shadowRadius: 18 },
  nav: { height: 60, width: "100%", maxWidth: 560, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 55 },
  navGap: { width: 58 },
  navLabel: { color: T.muted, fontSize: 10, fontWeight: "500" },
  navLabelActive: { color: T.purple, fontWeight: "700" },
  fab: { position: "absolute", top: -19, alignSelf: "center", width: 52, height: 52, borderRadius: 26, backgroundColor: T.purpleDeep, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: T.canvas, elevation: 8, shadowColor: T.purple, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 5 } },
  insightHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 20, marginTop: 20, marginBottom: 13 },
  micro: { color: T.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.6 },
  pageTitle: { color: T.ink, fontSize: 29, fontWeight: "700", letterSpacing: -0.9, marginTop: 3 },
  insightIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: T.pale, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: T.surfaceMuted, marginHorizontal: 20, borderRadius: 16, padding: 4, marginBottom: 15 },
  segmentItem: { flex: 1, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segmentThumb: { position: "absolute", top: 4, left: 4, height: 34, borderRadius: 12, backgroundColor: T.surface, elevation: 1, shadowColor: "#232333", shadowOpacity: 0.07, shadowRadius: 4 },
  segmentText: { color: T.muted, fontSize: 12, fontWeight: "600" },
  segmentTextActive: { color: T.ink },
  insightCard: { backgroundColor: T.surface, borderRadius: 20, marginHorizontal: 20, padding: 19, marginBottom: 12 },
  insightLabel: { color: T.muted, fontSize: 12 },
  insightValue: { color: T.ink, fontSize: 31, fontWeight: "700", letterSpacing: -1, marginTop: 4 },
  insightCaption: { color: T.muted, fontSize: 11, marginTop: 2, marginBottom: 13 },
  breakdownCard: { backgroundColor: T.surface, borderRadius: 20, marginHorizontal: 20, padding: 18, marginBottom: 12 },
  breakdownRow: { flexDirection: "row", alignItems: "center", marginTop: 13, gap: 8 },
  breakdownIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  breakdownName: { width: 58, color: T.ink, fontSize: 11 },
  breakdownTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "#334039", overflow: "hidden" },
  breakdownFill: { height: 5, borderRadius: 3 },
  breakdownAmount: { width: 74, textAlign: "right", color: T.ink, fontSize: 11, fontWeight: "700" },
  noteCard: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: T.pale, borderRadius: 16, marginHorizontal: 20, padding: 15 },
  noteIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.surface, alignItems: "center", justifyContent: "center" },
  noteText: { flex: 1, color: "#B6DFCB", fontSize: 11, lineHeight: 17 },
  pageLead: { color: T.muted, fontSize: 13, marginHorizontal: 20, marginBottom: 20 },
  primaryAction: { marginHorizontal: 20, backgroundColor: T.purpleDeep, borderRadius: 15, height: 54, flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 16, marginBottom: 10 },
  primaryActionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", flex: 1 },
  secondaryAction: { marginHorizontal: 20, backgroundColor: T.surface, borderRadius: 15, height: 52, flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 16, marginBottom: 15 },
  secondaryActionText: { color: T.purple, fontSize: 13, fontWeight: "700" },
  groupLarge: { marginHorizontal: 20, marginBottom: 10, backgroundColor: T.surface, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  groupLargeIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: T.pale, alignItems: "center", justifyContent: "center" },
  groupLargeTitle: { color: T.ink, fontSize: 15, fontWeight: "700" },
  groupLargeBalance: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  settingsCard: { backgroundColor: T.surface, borderRadius: 20, padding: 20, margin: 20 },
  settingsTitle: { color: T.ink, fontSize: 17, fontWeight: "700" },
  settingsBody: { color: T.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  settingsRow: { marginHorizontal: 20, marginBottom: 9, backgroundColor: T.surface, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  settingsRowText: { color: T.ink, fontSize: 13, fontWeight: "600", flex: 1 },
  settingsFoot: { color: T.muted, fontSize: 11, textAlign: "center", marginTop: 30 },
});
