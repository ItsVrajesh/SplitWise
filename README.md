# Orbit Split

A shared expense app for React Native, Expo Router, and Supabase. Friends use separate accounts, join a group with an invite code, and see the same ledger. The interface and icon are original to Orbit Split.

Without Supabase settings, Expo Go opens a **local preview** with a sample group. You can add manual friends, expenses, groups, and payments. Preview data stays on that phone; invite codes do not sync between phones. Adding Supabase settings switches to the shared cloud mode.

## What works

- Email account creation and sign in
- Groups with a fixed currency and shareable invite code
- Expense entry with one payer and selected participants
- Equal, exact amount, percentage, and weighted share splits
- Balances, simplified suggested payments, and recorded settlements
- Entry correction by the person who created it, with voided records retained for audit
- Home and Insight dashboards showing your own share of expenses, category totals, and trends
- Dark violet visual system with an animated balance orbit, neon trend chart, contour artwork, spring press feedback, haptics, and a custom app icon
- Row level security for group data and atomic database functions for writes

Money is stored as integer cents. Remainders are assigned using the largest remainder method, with user ID as the deterministic tie breaker. A group's ledger must sum to zero. Payments are records of money already sent; this app does not transfer funds.

## Set up shared sync

1. Create a [Supabase project](https://supabase.com/dashboard).
2. Open its SQL Editor and run [supabase/schema.sql](supabase/schema.sql). This creates tables, access policies, and write functions.
3. Copy `.env.example` to `.env`. Fill in your project URL and **publishable** key from the Supabase project Connect panel. Never put a service role or secret key in the app.
4. In Supabase Authentication settings, enable email signups. If email confirmation is on, each friend must confirm before signing in.
5. Run:

   ```powershell
   npm install
   npm run start
   ```

6. Open the QR code in Expo Go on a phone, create an account, and make a group. A friend signs up with a different account and enters the group's invite code. Use the sync control to fetch their latest activity.

The `.env` file is ignored by Git. The local preview and shared cloud mode use separate data; preview entries are not uploaded automatically.

## Share an installable Android app

Configure the same `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in your Expo EAS build environment, then run:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile produces an APK for direct installation. Share the build URL with your friends. They each create their own account and join the same group. iPhone distribution requires Apple's device registration and signing process.

For development, Expo Go can open the project via the QR code while the development server is running. See [Expo's device guide](https://docs.expo.dev/get-started/start-developing/) and [APK guide](https://docs.expo.dev/build-reference/apk/).

## Commands

```powershell
npm test
npx tsc --noEmit
npx expo lint
```

## Design and limits

The [research notes](docs/research.md) distinguish Splitwise's published features from Orbit Split's own design. The [design notes](docs/design.md) map the supplied screenshot and Cult UI patterns to native components. Theme colors are in [src/theme.ts](src/theme.ts). This version supports one payer per expense, four common currencies, manual sync, and online use. It has no receipt scanning, recurring bills, exchange rate conversion, notifications, payment integration, or offline write queue. Cross currency totals are intentionally kept separate; Home and Insight display the currency of the first group and say when other currencies are excluded.

The SQL schema has not been exercised against a live Supabase project in this workspace. Before relying on it with friends, run it in your project and try a two account flow: create group, join, add an uneven expense, refresh both phones, and record a payment.
