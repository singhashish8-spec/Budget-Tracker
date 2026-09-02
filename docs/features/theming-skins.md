# Feature: Theming & skins

> Part of `features/`. Status: **built** (started 2026-07-22, PR #8; most
> recent additions 2026-08-01/02, PRs #48–58).

## Summary

Light/dark/system mode, 7 accent colours, and **9 full visual "skins"**
(Paper, Carbon, Glass/Frosted, Neo, Serene, Clay, Soft, Liquid Glass,
Spatial), all driven by CSS custom properties so the ~290+ inline-styled
elements across the app re-theme automatically with no per-component
changes. The four most visually ambitious skins (Liquid Glass, Spatial, and
their shared depth effects) run through a device-capability-tiered "depth
engine" so cost scales with hardware rather than being all-or-nothing.

## Why this exists

Started as light/dark/accent (PR #8) — standard theming. Grew into a full
skin system across two later design pushes (Session 09's five-theme batch,
Session 10's four-skin-plus-depth-engine batch) explicitly because "mode and
accent change colour, not personality" (PR #89e8a31's commit message) — the
goal was giving the app a genuinely different *feel*, not just a different
palette.

## What's built

- **`theme.js`** persists mode/accent/surface/skin choices to the DB **and**
  caches them in `localStorage`, applied via `data-theme`/`data-surface`
  attributes **before first paint** — no flash of the wrong theme.
- **The `data-surface`/`data-skin` architecture** — every skin is CSS custom
  properties only, light + dark variants, no component code changes. New
  skins plug into the existing `SURFACES` picker and `SkinSwatch` preview.
- **The depth engine** (`data-depth`, PR #48) — three tiers:

  | Tier | What runs |
  |---|---|
  | `max` | Card blur, edge refraction, tilt-tracked highlights, 3D scene, animated aurora |
  | `balanced` | Blur confined to chrome/sheets, static highlights, no sensors |
  | `off` | Flat translucency, nothing moves |

  Auto-detected once from `deviceMemory`/`hardwareConcurrency` (≤4GB/≤4-core
  → `balanced`), user-overridable via a Settings → Appearance "Effects"
  control that only appears for skins that actually spend something on
  depth. **No tier is allowed to change any box's size or position** — see
  `roadmap/decisions.md`. Motion setting and OS reduced-motion both
  outrank the tier.
- **Liquid Glass** — real edge refraction via an SVG `feDisplacementMap` on
  a decorative overlay layer (not `backdrop-filter: url()` — unreliable
  Android WebView support, fails invisibly), plus a gyroscope-tracked
  specular highlight, only active at the `max` tier, only while the app is
  foregrounded (a gyroscope streaming behind a locked screen is pure battery
  drain).
- **Spatial** — shared `perspective` context with counter-rotating cards on
  tilt. The projection is applied via the `perspective()` **transform
  function** on individual cards, not the `perspective` **property** on a
  shared ancestor — see the lockout bug below.
- **Frosted/Glass** was later given an iOS-specific pass (Session 09,
  `44a70b5`): correct blur/saturation values, real Apple label/separator
  alpha values, an inset top-edge hairline, iOS corner radii and timing
  curves — with the blur material kept deliberately **opt-in per-surface**
  (tab bar, menu button, two sheet types only), not applied to every card,
  because doing so on Transactions' per-day-group cards "is the standard
  way to make an Android WebView stutter."

## Bugs this feature produced (see `history/findings.md` for full writeups)

- **Spatial's `perspective` property locked users out of the app entirely**
  (PR #51) — `perspective` on `.app-shell` made it a containing block for
  every `position: fixed` descendant, throwing the tab bar and menu button
  off-screen once a page had scrollable content.
- **A CSS specificity tie silently killed the rim-light highlight on Liquid
  Glass and Spatial since launch** (PR #52) — found only by comparing
  `getComputedStyle()` output across all 9 skins.
- **The Liquid Glass specular highlight animated paint properties
  (`box-shadow`/`background-position`) instead of `transform`** (PR #50) —
  a real performance regression from #48, fixed the same session it shipped.

## Open questions

- PR #48's own body: real on-device frame rates at the `max` tier on a
  mid-range Android phone were never verified. If `max` proves too
  ambitious in practice, the stated intent is to lower the auto-detect
  threshold, not to soften the effect for devices that can afford it.
