# Orbit Split design

The first reference guides the amount header, category tiles, chart, and floating add action. The newer dark reference guides the near-black canvas, violet line work, glowing charts, and quiet motion. Orbit Split shows real group data and split amounts in these surfaces.

[Cult UI](https://github.com/nolly-studio/cult-ui) supplies the component and motion direction. Its registry components target browser React, Tailwind, and Motion, so native equivalents are implemented in [src/dashboard.tsx](../src/dashboard.tsx) with React Native, Reanimated, and SVG. The [components-build skill](https://github.com/nolly-studio/cult-ui/blob/main/.agents/skills/components-build/SKILL.md) guides reusable controls, semantic actions, and accessibility labels.

| Direction | Native implementation |
| --- | --- |
| Cult UI Dock | `DashboardNav` with a centered floating add action and spring press feedback |
| Cult UI direction-aware tabs | `PeriodSwitch` with a spring driven selection thumb |
| Cult UI soft sheets and pill actions | Dark rounded cards, quiet borders, and compact actions |
| Reference spending chart | Animated SVG line and glow based on the signed-in person's expense shares |
| Reference circular display | Animated orbit around a labeled net balance; the ring is decorative and does not imply a percentage |
| Reference contour artwork | Animated decorative contour lines behind group and expense headers |

Theme and category colors live in [src/theme.ts](../src/theme.ts). The orbit, chart, and contour animations use Reanimated and honor the device's reduced motion setting. Home and Insight totals are computed from integer-cent shares. For groups in different currencies, those screens display only groups matching the first group's currency; each group's own balance remains separate.
