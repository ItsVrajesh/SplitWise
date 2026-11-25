import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share as NativeShare,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CarFront,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  Circle,
  CircleArrowRight,
  CircleCheck,
  CirclePlus,
  Copy,
  EllipsisVertical,
  GitCompareArrows,
  House,
  Info,
  Lightbulb,
  Link2,
  LogOut,
  Plane,
  Plus,
  Receipt,
  Share2,
  ShoppingBag,
  Sparkles,
  Sun,
  Ticket,
  UserRoundPlus,
  UsersRound,
  Utensils,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import type { Session } from "@supabase/supabase-js";
import { DashboardHome, DashboardInsights, DashboardGroups, DashboardSettings, type DashboardActions } from "./src/dashboard";

import { palette } from "./src/theme";
import {
  addLocalMember,
  addExpense,
  configured,
  createGroup,
  Group,
  joinGroup,
  LOCAL_USER_ID,
  loadSnapshot,
  recordSettlement,
  Snapshot,
  supabase,
  voidEntry,
} from "./src/data";
import {
  balances,
  calculateShares,
  formatMoney,
  parseMoney,
  simplifyDebts,
  SplitMode,
} from "./src/money";

const C = {
  bg: palette.canvas,
  card: palette.surface,
  card2: palette.surfaceMuted,
  accent: palette.purple,
  negative: palette.red,
  positive: palette.green,
  text: palette.ink,
  muted: palette.muted,
  line: palette.line,
  navy: palette.heroEnd,
};
const categories = [
  "Food",
  "Travel",
  "Stay",
  "Shopping",
  "Bills",
  "Fun",
  "Other",
];
const iconComponents = {
  "restaurant-outline": Utensils,
  "airplane-outline": Plane,
  "bed-outline": BedDouble,
  "bag-outline": ShoppingBag,
  "receipt-outline": Receipt,
  "sparkles-outline": Sparkles,
  "ellipse-outline": Circle,
  "home-outline": House,
  "calendar-outline": CalendarDays,
  "sunny-outline": Sun,
  "car-outline": CarFront,
  "people-outline": UsersRound,
  "arrow-back": ArrowLeft,
  "git-compare-outline": GitCompareArrows,
  "log-out-outline": LogOut,
  "information-circle-outline": Info,
  "analytics-outline": ChartNoAxesCombined,
  "share-outline": Share2,
  "link-outline": Link2,
  "copy-outline": Copy,
  "arrow-forward-circle-outline": CircleArrowRight,
  "checkmark-done-outline": CheckCheck,
  "ellipsis-vertical": EllipsisVertical,
  "ticket-outline": Ticket,
  "bulb-outline": Lightbulb,
  "arrow-forward": ArrowRight,
  "add-circle-outline": CirclePlus,
  add: Plus,
  "checkmark-circle-outline": CircleCheck,
  "person-add-outline": UserRoundPlus,
  checkmark: Check,
} as const;
type IconName = keyof typeof iconComponents;
function Icon({ name, size, color }: { name: IconName; size: number; color: string }) {
  const Glyph = iconComponents[name];
  return <Glyph size={size} color={color} strokeWidth={2} />;
}
const icons: Record<string, IconName> = {
  Food: "restaurant-outline",
  Travel: "airplane-outline",
  Stay: "bed-outline",
  Shopping: "bag-outline",
  Bills: "receipt-outline",
  Fun: "sparkles-outline",
  Other: "ellipse-outline",
};
const groupIcons: Record<string, IconName> = {
  "✈️": "airplane-outline",
  "🏠": "home-outline",
  "🍜": "restaurant-outline",
  "🎉": "calendar-outline",
  "🏖️": "sunny-outline",
  "🚗": "car-outline",
};
function groupIcon(emoji: string): IconName {
  return groupIcons[emoji] || "people-outline";
}
type Screen =
  "home" | "group" | "add" | "create" | "join" | "settle" | "member" | "insights" | "groups" | "settings";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Tap({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      style={[style, motion]}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={() => {
        scale.set(withSpring(0.97, { stiffness: 400, damping: 22 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { stiffness: 400, damping: 22 }));
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420)}>
      {children}
    </Animated.View>
  );
}
function Button({
  title,
  onPress,
  icon,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View style={[s.button, secondary && s.buttonSecondary]}>
        {icon && (
          <Icon name={icon} size={19} color={secondary ? C.accent : "#FFFFFF"} />
        )}
        <Text style={[s.buttonText, secondary && { color: C.accent }]}>
          {title}
        </Text>
      </View>
    </Tap>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secure?: boolean;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9AA6B7"
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={s.input}
        selectionColor={C.accent}
      />
    </View>
  );
}
function Pill({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} style={[s.pill, active && s.pillActive]}>
      <Text style={[s.pillText, active && { color: "#FFFFFF" }]}>{title}</Text>
    </Tap>
  );
}
function Header({
  title,
  eyebrow,
  back,
  right,
}: {
  title: string;
  eyebrow?: string;
  back?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        {back && (
          <Tap onPress={back} style={{ marginRight: 14, padding: 6 }}>
            <Icon name="arrow-back" size={23} color={C.text} />
          </Tap>
        )}
        <View style={{ flex: 1 }}>
          {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
          <Text style={s.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      {right}
    </View>
  );
}
function AuthScreen() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit() {
    if (!email.trim() || password.length < 6 || (signup && !name.trim()))
      return Alert.alert(
        "Check your details",
        "Enter a name, email, and a password with at least 6 characters.",
      );
    setBusy(true);
    try {
      const result = signup
        ? await supabase!.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: name.trim() } },
          })
        : await supabase!.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error) throw result.error;
      if (signup && !result.data.session)
        Alert.alert(
          "Check your email",
          "Confirm your email address, then sign in.",
        );
    } catch (e: any) {
      Alert.alert("Could not continue", e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={s.authScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.brand}>
          <Icon name="git-compare-outline" size={30} color="#FFFFFF" />
        </View>
        <Text style={s.eyebrow}>ORBIT SPLIT</Text>
        <Text style={s.authTitle}>Shared expenses,{"\n"}made simple.</Text>
        <Text style={s.subtitle}>
          Clear balances for trips, homes, and everything in between.
        </Text>
        <View style={s.authCard}>
          <Text style={s.sectionTitle}>
            {signup ? "Create an account" : "Sign in"}
          </Text>
          <View style={{ height: 22 }} />
          {signup && (
            <Field
              label="YOUR NAME"
              value={name}
              onChange={setName}
              placeholder="What should friends call you?"
            />
          )}
          <Field
            label="EMAIL"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Field
            label="PASSWORD"
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
            secure
          />
          <Button
            title={
              busy ? "One moment..." : signup ? "Create account" : "Sign in"
            }
            onPress={submit}
            disabled={busy}
            icon="arrow-forward"
          />
          <Tap
            onPress={() => setSignup(!signup)}
            style={{ marginTop: 22, alignItems: "center" }}
          >
            <Text style={{ color: C.accent, fontWeight: "700" }}>
              {signup
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Text>
          </Tap>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
type AppState = {
  session: Session | null;
  authReady: boolean;
  data: Snapshot;
  loading: boolean;
  go: (screen: Screen, id?: string) => void;
  refresh: () => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
};
const AppContext = createContext<AppState | null>(null);
function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("App provider is missing");
  return value;
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(
      configured ? null : ({ user: { id: LOCAL_USER_ID } } as Session),
    ),
    [authReady, setAuthReady] = useState(!configured);
  const [data, setData] = useState<Snapshot>({
    groups: [],
    expenses: [],
    settlements: [],
  });
  const [loading, setLoading] = useState(false);
  const writing = useRef(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        if (!next) {
          setData({ groups: [], expenses: [], settlements: [] });
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  async function refresh() {
    if (!session) return;
    setLoading(true);
    try {
      setData(await loadSnapshot());
    } catch (e: any) {
      Alert.alert("Sync failed", e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    loadSnapshot()
      .then((snapshot) => {
        if (active) setData(snapshot);
      })
      .catch((error) => Alert.alert("Sync failed", error.message));
    return () => {
      active = false;
    };
  }, [session?.user.id]);
  function go(next: Screen, id?: string) {
    const destination = next === "home" ? "/" : `/${next}`;
    const route = id ? { pathname: destination, params: { id } } : destination;
    router.navigate(route as any);
  }
  async function action(run: () => Promise<any>, after?: () => void) {
    if (writing.current) return;
    writing.current = true;
    try {
      await run();
      await refresh();
      after?.();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch (e: any) {
      Alert.alert("Something went wrong", e.message || "Please try again.");
    } finally {
      writing.current = false;
    }
  }
  return (
    <AppContext.Provider
      value={{ session, authReady, data, loading, go, refresh, action }}
    >
      {children}
    </AppContext.Provider>
  );
}
function Gate() {
  const { authReady, session } = useApp();
  if (!authReady)
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={C.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  if (!session) return <AuthScreen />;
  return null;
}
function Frame({ children }: { children: React.ReactNode }) {
  const { loading } = useApp();
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>{children}</View>
      {loading && (
        <View style={s.syncDot}>
          <ActivityIndicator color={C.bg} size="small" />
        </View>
      )}
    </SafeAreaView>
  );
}
function dashboardActions(go: (s: Screen, id?: string) => void, data: Snapshot): DashboardActions {
  return {
    home: () => go("home"),
    insights: () => go("insights"),
    groups: () => go("groups"),
    settings: () => go("settings"),
    add: () => {
      if (data.groups.length === 0) go("create");
      else if (data.groups.length === 1) go("add", data.groups[0].id);
      else go("groups");
    },
  };
}
function accountAction() {
  return configured
    ? supabase!.auth.signOut()
    : Alert.alert("Local preview", "Saved only on this phone. Add Supabase settings for accounts and friend sync.");
}
export function HomeRoute() {
  const { data, session, authReady, go, refresh } = useApp();
  if (!authReady || !session) return <Gate />;
  return (
    <Frame>
      <DashboardHome
        data={data}
        userId={session.user.id}
        actions={dashboardActions(go, data)}
        openGroup={(id) => go("group", id)}
        refresh={refresh}
        preview={!configured}
      />
    </Frame>
  );
}
export function InsightsRoute() {
  const { data, session, authReady, go } = useApp();
  if (!authReady || !session) return <Gate />;
  return <Frame><DashboardInsights data={data} userId={session.user.id} actions={dashboardActions(go, data)} /></Frame>;
}
export function GroupsRoute() {
  const { data, session, authReady, go } = useApp();
  if (!authReady || !session) return <Gate />;
  return <Frame><DashboardGroups data={data} userId={session.user.id} actions={dashboardActions(go, data)} openGroup={(id) => go("group", id)} createGroup={() => go("create")} joinGroup={() => go("join")} preview={!configured} /></Frame>;
}
export function SettingsRoute() {
  const { data, session, authReady, go, refresh } = useApp();
  if (!authReady || !session) return <Gate />;
  return <Frame><DashboardSettings actions={dashboardActions(go, data)} refresh={refresh} signOut={accountAction} preview={!configured} /></Frame>;
}
export function CreateRoute() {
  const { session, authReady, go, action } = useApp();
  if (!authReady || !session) return <Gate />;
  return (
    <Frame>
      <CreateGroup go={go} action={action} />
    </Frame>
  );
}
export function JoinRoute() {
  const { session, authReady, go, action } = useApp();
  if (!authReady || !session) return <Gate />;
  return (
    <Frame>
      <JoinGroup go={go} action={action} />
    </Frame>
  );
}
function useRouteGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  return { ...app, group: app.data.groups.find((g) => g.id === id) };
}
function MissingGroup() {
  return (
    <Frame>
      <View style={{ padding: 24 }}>
        <Text style={s.quiet}>Loading group, or the group is unavailable.</Text>
      </View>
    </Frame>
  );
}
export function GroupRoute() {
  const { group, data, session, authReady, go, refresh, action } =
    useRouteGroup();
  if (!authReady || !session) return <Gate />;
  return group ? (
    <Frame>
      <GroupDetail
        group={group}
        data={data}
        userId={session.user.id}
        go={go}
        refresh={refresh}
        action={action}
      />
    </Frame>
  ) : (
    <MissingGroup />
  );
}
export function AddRoute() {
  const { group, session, authReady, go, action } = useRouteGroup();
  if (!authReady || !session) return <Gate />;
  return group ? (
    <Frame>
      <AddExpense
        group={group}
        userId={session.user.id}
        go={go}
        action={action}
      />
    </Frame>
  ) : (
    <MissingGroup />
  );
}
export function SettleRoute() {
  const { group, data, session, authReady, go, action } = useRouteGroup();
  if (!authReady || !session) return <Gate />;
  return group ? (
    <Frame>
      <Settle
        group={group}
        data={data}
        userId={session.user.id}
        go={go}
        action={action}
      />
    </Frame>
  ) : (
    <MissingGroup />
  );
}
export function MemberRoute() {
  const { group, session, authReady, go, action } = useRouteGroup();
  if (!authReady || !session) return <Gate />;
  return group ? (
    <Frame>
      <AddMember group={group} go={go} action={action} />
    </Frame>
  ) : (
    <MissingGroup />
  );
}
function GroupDetail({
  group,
  data,
  userId,
  go,
  refresh,
  action,
}: {
  group: Group;
  data: Snapshot;
  userId: string;
  go: (s: Screen, id?: string) => void;
  refresh: () => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
}) {
  const expenses = data.expenses.filter((e) => e.groupId === group.id),
    settlements = data.settlements.filter((t) => t.groupId === group.id);
  const net = balances(
      group.members.map((m) => m.id),
      expenses,
      settlements,
    ),
    transfers = simplifyDebts(net);
  const name = (id: string) =>
    id === userId
      ? "You"
      : group.members.find((m) => m.id === id)?.name || "Friend";
  async function invite() {
    if (!configured) {
      Alert.alert(
        "Local preview",
        "Invite codes work after you connect a shared Supabase project.",
      );
      return;
    }
    await Clipboard.setStringAsync(group.inviteCode);
    await NativeShare.share({
      message: `Join my ${group.name} group on Orbit Split. Invite code: ${group.inviteCode}`,
    });
  }
  const activity = [
    ...expenses.map((e) => ({ ...e, kind: "expense" as const })),
    ...settlements.map((t) => ({ ...t, kind: "settlement" as const })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  function confirmCorrection(item: (typeof activity)[number]) {
    if (item.createdBy !== userId) return;
    Alert.alert(
      `Remove ${item.kind}?`,
      "This corrects the group balance. The original record stays in the database for audit.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove entry",
          style: "destructive",
          onPress: () => action(() => voidEntry(item.kind, item.id)),
        },
      ],
    );
  }
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header
        title="Group details"
        back={() => go("home")}
        right={
          configured ? (
            <Tap onPress={invite} style={s.iconButton}>
              <Icon name="share-outline" size={21} color={C.text} />
            </Tap>
          ) : undefined
        }
      />
      <Reveal>
        <View style={s.groupHero}>
          <View style={s.groupHeroIcon}>
            <Icon name={groupIcon(group.emoji)} size={25} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.groupHeroTitle}>{group.name}</Text>
            <Text style={s.cardSub}>
              {group.members.length} members · {group.currency}
            </Text>
          </View>
          {configured && (
            <Icon name="people-outline" size={22} color={C.muted} />
          )}
        </View>
      </Reveal>
      <Reveal delay={70}>
        <LinearGradient
          colors={[palette.heroStart, palette.heroMiddle, palette.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.balanceCard}
        >

          <Text style={s.heroKicker}>YOUR GROUP BALANCE</Text>
          <Text
            style={s.bigBalance}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatMoney(Math.abs(net[userId] || 0), group.currency)}
          </Text>
          <Text style={s.balanceCaption}>
            {net[userId] > 0
              ? "You are owed"
              : net[userId] < 0
                ? "You need to pay"
                : "All settled up"}
          </Text>
        </LinearGradient>
      </Reveal>
      {configured && (
        <Tap onPress={invite} style={s.invite}>
          <Icon name="link-outline" size={17} color={C.accent} />
          <Text style={s.inviteCode}>Invite code {group.inviteCode}</Text>
          <Icon name="copy-outline" size={17} color={C.accent} />
        </Tap>
      )}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Add expense"
            icon="add"
            onPress={() => go("add", group.id)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Settle up"
            icon="checkmark-circle-outline"
            secondary
            onPress={() => go("settle", group.id)}
          />
        </View>
      </View>
      {!configured && (
        <View style={{ marginTop: 12 }}>
          <Button
            title="Add a friend"
            icon="person-add-outline"
            secondary
            onPress={() => go("member", group.id)}
          />
        </View>
      )}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Balances</Text>
        <Text style={s.count}>{transfers.length} payments</Text>
      </View>
      {transfers.length ? (
        transfers.map((t, i) => (
          <View style={s.transferCard} key={i}>
            <Icon
              name="arrow-forward-circle-outline"
              size={30}
              color={C.accent}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.cardTitle}>
                {name(t.from)} → {name(t.to)}
              </Text>
              <Text style={s.cardSub}>suggested payment</Text>
            </View>
            <Text style={s.balance}>
              {formatMoney(t.cents, group.currency)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={s.quiet}>No payments are needed right now.</Text>
      )}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Recent activity</Text>
        <Text style={s.count}>{activity.length} items</Text>
      </View>
      {activity.map((item) => (
        <Tap
          key={item.id}
          disabled={item.createdBy !== userId}
          onPress={() => confirmCorrection(item)}
        >
          <View style={s.activityCard}>
            <View style={s.activityIcon}>
              <Icon
                name={
                  item.kind === "expense"
                    ? icons[item.category] || "ellipse-outline"
                    : "checkmark-done-outline"
                }
                size={22}
                color={C.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>
                {item.kind === "expense"
                  ? item.title
                  : `${name(item.from)} paid ${name(item.to)}`}
              </Text>
              <Text style={s.cardSub}>
                {item.kind === "expense"
                  ? `${name(item.paidBy)} paid · ${item.category}`
                  : "Settlement"}{" "}
                · {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={s.balance}>
              {formatMoney(item.amountCents, group.currency)}
            </Text>
            {item.createdBy === userId && (
              <Icon name="ellipsis-vertical" size={15} color={C.muted} />
            )}
          </View>
        </Tap>
      ))}
      {activity.length === 0 && (
        <Text style={s.quiet}>
          No activity yet. Add an expense to get started.
        </Text>
      )}
      <Tap onPress={refresh} style={{ alignItems: "center", marginTop: 20 }}>
        <Text style={s.quiet}>Sync latest activity ↻</Text>
      </Tap>
    </ScrollView>
  );
}
function CreateGroup({
  go,
  action,
}: {
  go: (s: Screen, id?: string) => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
}) {
  const [name, setName] = useState(""),
    [emoji, setEmoji] = useState("✈️"),
    [currency, setCurrency] = useState("INR");
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="New group" eyebrow="GROUPS" back={() => go("home")} />
      <Text style={s.formIntro}>Create a shared space</Text>
      <Text style={s.subtitle}>
        Keep expenses and balances together in one group.
      </Text>
      <Field
        label="GROUP NAME"
        value={name}
        onChange={setName}
        placeholder="e.g. Weekend trip"
      />
      <Text style={s.label}>GROUP TYPE</Text>
      <View style={s.pillRow}>
        {[
          ["✈️", "Trip"],
          ["🏠", "Home"],
          ["🍜", "Dining"],
          ["🎉", "Event"],
          ["🏖️", "Holiday"],
          ["🚗", "Travel"],
        ].map(([value, title]) => (
          <Pill
            key={value}
            title={title}
            active={emoji === value}
            onPress={() => setEmoji(value)}
          />
        ))}
      </View>
      <Text style={s.label}>CURRENCY</Text>
      <View style={s.pillRow}>
        {["INR", "USD", "EUR", "GBP"].map((v) => (
          <Pill
            key={v}
            title={v}
            active={currency === v}
            onPress={() => setCurrency(v)}
          />
        ))}
      </View>
      <Button
        title="Create group"
        icon="arrow-forward"
        onPress={() => {
          if (!name.trim()) return Alert.alert("Add a group name");
          action(
            () => createGroup(name, emoji, currency),
            () => go("home"),
          );
        }}
      />
    </ScrollView>
  );
}
function JoinGroup({
  go,
  action,
}: {
  go: (s: Screen, id?: string) => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="Join a group" eyebrow="GROUPS" back={() => go("home")} />
      <View style={s.empty}>
        <Icon name="ticket-outline" size={50} color={C.accent} />
        <Text style={s.emptyTitle}>Enter an invite code</Text>
        <Text style={s.emptyBody}>
          Ask a friend to share their invite code, then add it here.
        </Text>
      </View>
      <Field
        label="INVITE CODE"
        value={code}
        onChange={setCode}
        placeholder="e.g. A1B2C3D4E5"
      />
      <Button
        title="Join group"
        icon="arrow-forward"
        onPress={() => {
          if (!code.trim()) return Alert.alert("Enter a code");
          action(
            () => joinGroup(code),
            () => go("home"),
          );
        }}
      />
    </ScrollView>
  );
}
function AddMember({
  group,
  go,
  action,
}: {
  group: Group;
  go: (s: Screen, id?: string) => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
}) {
  const [name, setName] = useState("");
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.page}>
        <Header
          title="Add a friend"
          eyebrow="LOCAL PREVIEW"
          back={() => go("group", group.id)}
        />
        <Text style={s.formIntro}>Add a member</Text>
        <Text style={s.subtitle}>
          Add a name to try splitting with more people on this phone.
        </Text>
        <Field
          label="FRIEND'S NAME"
          value={name}
          onChange={setName}
          placeholder="Your friend's name"
        />
        <Button
          title="Add friend"
          icon="person-add-outline"
          onPress={() =>
            action(
              () => addLocalMember(group.id, name),
              () => go("group", group.id),
            )
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function AddExpense({
  group,
  userId,
  go,
  action,
}: {
  group: Group;
  userId: string;
  go: (s: Screen, id?: string) => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
}) {
  const [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState("Food"),
    [payer, setPayer] = useState(userId),
    [mode, setMode] = useState<SplitMode>("equal");
  const [selected, setSelected] = useState<string[]>(
      group.members.map((m) => m.id),
    ),
    [values, setValues] = useState<Record<string, string>>({});
  const cents = parseMoney(amount),
    ids = group.members.filter((m) => selected.includes(m.id)).map((m) => m.id);
  function save() {
    if (!title.trim() || !cents)
      return Alert.alert("Check the expense", "Add a title and valid amount.");
    try {
      const shares = calculateShares(
        cents,
        ids,
        mode,
        ids.map((id) => values[id] || ""),
      );
      action(
        () => addExpense(group.id, title, category, cents, payer, mode, shares),
        () => go("group", group.id),
      );
    } catch (e: any) {
      Alert.alert("Check the split", e.message);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 25 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[palette.heroStart, palette.heroMiddle, palette.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addHero}>

          <View style={s.addHeroTop}>
            <Tap onPress={() => go("group", group.id)} style={s.addBack}><Icon name="arrow-back" size={21} color="#FFFFFF" /></Tap>
            <Text style={s.addTopTitle}>Add expense</Text>
            <View style={{ width: 38 }} />
          </View>
          <Text style={s.addAmountLabel}>ENTER AMOUNT</Text>
          <View style={s.addAmountRow}>
            <Text style={s.addAmountSymbol}>{formatMoney(0, group.currency).replace(/[\d.,\s\u00a0]/g, "")}</Text>
            <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#A8BCAF" keyboardType="decimal-pad" selectionColor="#FFFFFF" style={[s.addAmountInput, { width: Math.min(230, Math.max(120, (amount.length || 4) * 23)) }]} accessibilityLabel={`Amount in ${group.currency}`} />
          </View>
          <Text style={s.addGroupName}>{group.name} · {group.currency}</Text>
        </LinearGradient>
        <View style={s.addSheet}>
          <Field label="DESCRIPTION" value={title} onChange={setTitle} placeholder="What was this for?" />
          <Text style={s.addSectionTitle}>Category</Text>
          <View style={s.addCategoryGrid}>
            {categories.map((value) => <Tap key={value} onPress={() => setCategory(value)} style={[s.addCategoryTile, category === value && s.addCategoryActive]}>
              <Icon name={icons[value]} size={21} color={category === value ? C.accent : C.muted} />
              <Text style={[s.addCategoryText, category === value && s.addCategoryTextActive]}>{value}</Text>
            </Tap>)}
          </View>
          <Text style={s.addSectionTitle}>Paid by</Text>
          <View style={s.pillRow}>{group.members.map((member) => <Pill key={member.id} title={member.id === userId ? "You" : member.name} active={payer === member.id} onPress={() => setPayer(member.id)} />)}</View>
          <Text style={s.addSectionTitle}>Split between</Text>
          <View style={s.pillRow}>{group.members.map((member) => <Pill key={member.id} title={member.id === userId ? "You" : member.name} active={selected.includes(member.id)} onPress={() => setSelected(selected.includes(member.id) ? selected.filter((id) => id !== member.id) : [...selected, member.id])} />)}</View>
          <Text style={s.addSectionTitle}>Split method</Text>
          <View style={s.pillRow}>{([ ["equal", "Equally"], ["exact", "Amounts"], ["percent", "Percent"], ["shares", "Shares"] ] as [SplitMode, string][]).map(([value, label]) => <Pill key={value} title={label} active={mode === value} onPress={() => setMode(value)} />)}</View>
          {mode === "equal" ? <View style={s.preview}><Icon name="sparkles-outline" size={20} color={C.accent} /><Text style={s.previewText}>{cents && ids.length ? `Each person pays about ${formatMoney(Math.floor(cents / ids.length), group.currency)}` : "Select people and enter an amount to preview."}</Text></View> : ids.map((id) => <Field key={id} label={`${group.members.find((member) => member.id === id)?.name.toUpperCase()} · ${mode === "exact" ? group.currency : mode === "percent" ? "%" : "SHARES"}`} value={values[id] || ""} onChange={(value) => setValues({ ...values, [id]: value })} placeholder="0" keyboardType="decimal-pad" />)}
          <Text style={s.footer}>Every cent is allocated, even when a split rounds unevenly.</Text>
        </View>
      </ScrollView>
      <View style={s.addSaveBar}><Button title={cents ? `Save expense · ${formatMoney(cents, group.currency)}` : "Save expense"} icon="checkmark" onPress={save} /></View>
    </KeyboardAvoidingView>
  );
}
function Settle({
  group,
  data,
  userId,
  go,
  action,
}: {
  group: Group;
  data: Snapshot;
  userId: string;
  go: (s: Screen, id?: string) => void;
  action: (run: () => Promise<any>, after?: () => void) => void;
}) {
  const net = balances(
    group.members.map((m) => m.id),
    data.expenses.filter((e) => e.groupId === group.id),
    data.settlements.filter((t) => t.groupId === group.id),
  );
  const transfers = simplifyDebts(net),
    [to, setTo] = useState(
      group.members.find((m) => m.id !== userId)?.id || userId,
    ),
    [amount, setAmount] = useState("");
  const suggestion = transfers.find((t) => t.from === userId && t.to === to);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.page}>
        <Header
          title="Settle up"
          eyebrow={group.name.toUpperCase()}
          back={() => go("group", group.id)}
        />
        <Text style={s.formIntro}>Record a payment</Text>
        <Text style={s.subtitle}>Record a payment after you have sent it.</Text>
        <Text style={s.label}>PAID BY</Text>
        <View style={s.pillRow}>
          <Pill title="You" active onPress={() => {}} />
        </View>
        <Text style={s.label}>WHO RECEIVED IT?</Text>
        <View style={s.pillRow}>
          {group.members
            .filter((m) => m.id !== userId)
            .map((m) => (
              <Pill
                key={m.id}
                title={m.name}
                active={to === m.id}
                onPress={() => setTo(m.id)}
              />
            ))}
        </View>
        {suggestion && (
          <Tap
            onPress={() => setAmount((suggestion.cents / 100).toFixed(2))}
            style={s.preview}
          >
            <Icon name="bulb-outline" size={20} color={C.accent} />
            <Text style={s.previewText}>
              Suggested: {formatMoney(suggestion.cents, group.currency)} · tap
              to fill
            </Text>
          </Tap>
        )}
        <Field
          label={`AMOUNT · ${group.currency}`}
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <Button
          title="Record payment"
          icon="checkmark"
          onPress={() => {
            const cents = parseMoney(amount);
            if (!cents || userId === to)
              return Alert.alert(
                "Check the payment",
                "Choose a friend and a valid amount.",
              );
            action(
              () => recordSettlement(group.id, userId, to, cents),
              () => go("group", group.id),
            );
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  page: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 54,
  },
  authScroll: { padding: 26, flexGrow: 1, justifyContent: "center" },
  header: {
    paddingTop: 16,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  eyebrow: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  iconButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.card,
  },
  brand: {
    width: 62,
    height: 62,
    borderRadius: 17,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 27,
  },
  authTitle: {
    color: C.text,
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1.5,
    lineHeight: 45,
  },
  subtitle: {
    color: C.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 28,
  },
  authCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 22,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 9,
  },
  input: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingHorizontal: 16,
    height: 54,
    color: C.text,
    fontSize: 16,
  },
  addHero: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 39, minHeight: 225, overflow: "hidden" },
  addHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF25", alignItems: "center", justifyContent: "center" },
  addTopTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  addAmountLabel: { color: "#C6D9CE", textAlign: "center", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 31 },
  addAmountRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 3 },
  addAmountSymbol: { color: "#FFFFFF", fontSize: 37, fontWeight: "700" },
  addAmountInput: { color: "#FFFFFF", fontSize: 38, fontWeight: "700", textAlign: "left", paddingVertical: 0 },
  addGroupName: { color: "#C6D9CE", textAlign: "center", fontSize: 12, marginTop: 3 },
  addSheet: { backgroundColor: C.bg, borderTopLeftRadius: 25, borderTopRightRadius: 25, marginTop: -24, padding: 20, minHeight: 620 },
  addSectionTitle: { color: C.text, fontSize: 15, fontWeight: "700", marginTop: 4, marginBottom: 14 },
  addCategoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 },
  addCategoryTile: { paddingHorizontal: 12, minHeight: 44, flexDirection: "row", borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", gap: 6 },
  addCategoryActive: { borderColor: C.accent, backgroundColor: C.card2 },
  addCategoryText: { color: C.muted, fontSize: 11, fontWeight: "600" },
  addCategoryTextActive: { color: C.accent, fontWeight: "700" },
  addSaveBar: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 7 },
  button: {
    height: 56,
    borderRadius: 15,
    backgroundColor: palette.purpleDeep,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 13,
  },
  buttonSecondary: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.accent,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  hero: { borderRadius: 22, padding: 23, minHeight: 220, overflow: "hidden" },
  heroKicker: {
    color: "#C6D9CE",
    fontWeight: "700",
    letterSpacing: 1.3,
    fontSize: 10,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroAmount: {
    color: "#FFFFFF",
    fontSize: 37,
    fontWeight: "700",
    marginTop: 28,
    letterSpacing: -1.2,
  },
  heroCaption: { color: "#C6D9CE", fontSize: 13, marginTop: 4 },
  heroDivider: {
    height: 1,
    backgroundColor: "#FFFFFF55",
    marginTop: 22,
    marginBottom: 18,
  },
  heroStats: { flexDirection: "row", gap: 22 },
  heroLabel: {
    color: "#C6D9CE",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroNumber: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 17,
    marginTop: 6,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 29,
    marginBottom: 15,
  },
  count: { color: C.muted, fontSize: 13 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 9,
    gap: 12,
  },
  groupEmoji: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  cardSub: { color: C.muted, fontSize: 12, marginTop: 4 },
  balance: { color: C.text, fontWeight: "700", fontSize: 14 },
  empty: {
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 28,
    marginVertical: 14,
  },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginTop: 14 },
  emptyBody: {
    color: C.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
  },
  footer: { color: C.muted, textAlign: "center", fontSize: 12, marginTop: 25 },
  syncDot: {
    position: "absolute",
    right: 15,
    bottom: 15,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: C.accent,
    justifyContent: "center",
  },
  groupHero: {
    borderRadius: 17,
    padding: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  groupHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  groupHeroTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "700",
  },
  invite: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card2,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  inviteCode: {
    color: C.accent,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.6,
    flex: 1,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 23,
    marginTop: 12,
    overflow: "hidden",
  },
  bigBalance: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 18,
    letterSpacing: -1,
  },
  balanceCaption: { color: "#C6D9CE", fontSize: 13, marginTop: 4 },
  transferCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 9,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 9,
    gap: 11,
  },
  activityIcon: {
    width: 42,
    height: 42,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  quiet: { color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  formIntro: {
    color: C.text,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 12,
    letterSpacing: -0.7,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 23 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  pillActive: { backgroundColor: palette.purpleDeep, borderColor: C.accent },
  pillText: { color: C.text, fontSize: 13, fontWeight: "600" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 16,
  },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  previewText: {
    color: "#D4B8FF",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: "600",
  },
});
