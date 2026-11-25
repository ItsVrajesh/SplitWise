# Product research and reconstruction boundary

The URL supplied for “reverse-engineer-anything” is a [GitHub topic page](https://github.com/topics/reverse-engineer-anything), which lists several unrelated repositories rather than one installable skill. The [REA skill](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md) emphasizes evidence for claims about shipped applications and separating observed behavior from reconstruction choices. No Splitwise app package, authenticated session, or REA analysis server was supplied here. This project uses publicly visible product information, not decompiled code or private API behavior.

## Publicly observed Splitwise features

The [Splitwise product page](https://www.splitwise.com/) describes groups and friends, shared expenses and balances, equal and unequal splits, percentages and shares, settling up, and simplified debts. It also lists recurring expenses, offline mode, cloud sync, categories, currencies, and Pro features. The public page does not specify the exact rounding order, database model, or settlement algorithm.

## Orbit Split choices

- Original light neutral and navy visual language, custom icon, animations, and haptics.
- Exact integer cent accounting; equal and weighted splits use largest remainder allocation, with a stable user ID tie breaker.
- Net group balances and a greedy settlement suggestion algorithm. Suggested transfers are mathematically valid but are not guaranteed to use the fewest possible payments in every case.
- Supabase Auth, row level security, and transactional database functions for groups, expense creation, and settlements.
- Invite codes and manual refresh for simple friend sharing.

These are Orbit Split implementation choices. They are not claims about Splitwise's internal algorithms or architecture.

## Animation references

The suggested [animate-ui](https://github.com/imskyleen/animate-ui) and [cult-ui](https://github.com/nolly-studio/cult-ui) libraries target web React with Tailwind, Motion, and shadcn components. [Motion UI's JavaScript guide](https://github.com/foundation/motion-ui/blob/develop/docs/src/javascript.md) operates on DOM elements and CSS classes. Their transition ideas informed Orbit Split's soft reveals and tactile controls; the mobile implementation uses Reanimated and Expo haptics so it runs on iOS and Android.
