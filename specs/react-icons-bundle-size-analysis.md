# React Icons Bundle Size Analysis: SVG vs Fonts vs SVG Sprite

> Analysis of webpack bundle outputs for `@fluentui/react-icons` comparing three icon delivery approaches.
>
> Generated from `packages/react-icons/dist/bundle-size/*.output.js` using the `compare-bundles` script.
>
> Run `cd packages/react-icons && npm run compare-bundles` to regenerate.

## Summary

| Metric | SVG Inline | Icon Fonts | SVG Sprite |
|---|---|---|---|
| JS bundle (minified) | 35.3 KB | 17.6 KB | 7.2 KB |
| JS bundle (gzipped) | 9.7 KB | 7.1 KB | 3.0 KB |
| External assets (transfer) | none | 4.5 KB (woff2) | 7.4 KB (gz sprites) |
| Extracted CSS (griffel.css) | 150 B | 150 B | 150 B |
| **Est. total transfer (gz)** | **9.8 KB** | **11.7 KB** | **10.6 KB** |

All measurements based on bundling 2 icon groups (Airplane + Agents, ~28 icon variants total).

## JS Bundle Composition

### SVG Inline (`/svg/` imports)

| Region | Size | % |
|---|---|---|
| Griffel core (makeStyles, mergeClasses, hash) | ~3.8 KB | 10.7% |
| Icon definitions (embedded SVG path data) | ~30.2 KB | 85.5% |
| Webpack bootstrap | ~1.3 KB | 3.8% |

- All icon SVG path data is embedded directly in JS as `React.createElement("svg", ...)` calls.
- No external assets — fully self-contained.
- No Stylis, no `insertCSSRules` — `makeStyles` output is extracted to `griffel.css` at build time.
- **Scales linearly** with the number of icons (each icon adds its full SVG path data).

### Icon Fonts (`/fonts/` imports)

| Region | Size | % |
|---|---|---|
| Stylis CSS compiler | ~6.9 KB | 38.4% |
| Griffel DOM renderer (insertCSSRules, createDOMRenderer, style sheet manager) | ~3.0 KB | 16.9% |
| Griffel core (makeStyles, mergeClasses, hash) | ~2.6 KB | 14.2% |
| @font-face template (4 declarations, 12 font file URLs) | ~884 B | 4.9% |
| Font icon factory + icon definitions (codepoint mappings) | ~1.2 KB | 6.4% |
| useInsertionEffect + other React hooks | ~0.5 KB | 2.7% |
| Webpack bootstrap | ~1.8 KB | 10.3% |

- Each icon is just a codepoint string (~100–150 B per icon).
- **Fixed overhead of ~10 KB** from Stylis + Griffel renderer (see [Root Cause](#root-cause-makestaticstyles-not-extracted) below).
- External assets: 12 font files (4 families × 3 formats), but browsers only download woff2 (~4.5 KB total).

### SVG Sprite (`/svg-sprite/` imports)

| Region | Size | % |
|---|---|---|
| Griffel core (makeStyles, mergeClasses, hash) | ~4.1 KB | 56.9% |
| Icon definitions (`<use href>` references) | ~1.3 KB | 17.6% |
| Webpack bootstrap | ~1.8 KB | 25.3% |

- Each icon is a `<use href="sprite.svg#id">` reference (~300–800 B per icon group).
- No Stylis, no `insertCSSRules` — same as SVG Inline.
- External assets: 1 SVG sprite file per icon group (airplane.svg: 8.4 KB, agents.svg: 24.4 KB).

## External Assets Breakdown

### Font files (Icon Fonts approach)

| File | Size |
|---|---|
| FluentSystemIcons-Filled.woff2 | 1.4 KB |
| FluentSystemIcons-Regular.woff2 | 1.9 KB |
| FluentSystemIcons-Light.woff2 | 316 B |
| FluentSystemIcons-Resizable.woff2 | 860 B |
| **Total woff2 (actual transfer)** | **4.5 KB** |

All 12 font files (ttf + woff + woff2): 19.1 KB total, but browsers prefer woff2.

### SVG sprite files (SVG Sprite approach)

| File | Raw | Gzipped |
|---|---|---|
| airplane.svg | 8.4 KB | 3.0 KB |
| agents.svg | 24.4 KB | 4.4 KB |
| **Total** | **32.8 KB** | **7.4 KB** |

## Root Cause: `makeStaticStyles` Not Extracted

### Problem

The `@griffel/babel-preset` (used by `@griffel/webpack-extraction-plugin`) only supports extracting two Griffel APIs:

```ts
// From @griffel/babel-preset/src/transformPlugin.d.ts
type FunctionKinds = 'makeStyles' | 'makeResetStyles';
```

**`makeStaticStyles` is not supported for build-time extraction.**

This matters because `createFluentFontIcon.styles.ts` uses `makeStaticStyles` to define `@font-face` declarations:

```ts
// packages/react-icons/src/utils/fonts/createFluentFontIcon.styles.ts
export const useStaticStyles = makeStaticStyles(`
  @font-face {
    font-family: FluentSystemIconsFilled;
    src: url("FluentSystemIcons-Filled.woff2") format("woff2"), ...;
  }
  // ... 3 more @font-face blocks
`);
```

### Impact

Since `makeStaticStyles` isn't extracted at build time, the **entire Griffel runtime CSS injection pipeline** must be included in the JS bundle:

| Runtime dependency | Size | Purpose |
|---|---|---|
| Stylis CSS compiler | ~6.9 KB | Parses & autoprefixes the `@font-face` CSS string at runtime |
| Griffel DOM renderer | ~3.0 KB | `insertCSSRules`, `createDOMRenderer`, `<style>` element management |
| `useInsertionEffect` hook | ~0.2 KB | React hook for safe CSS injection timing |
| **Total extra overhead** | **~10 KB** | **Not present in SVG Inline or SVG Sprite bundles** |

The SVG Inline and SVG Sprite approaches only use `makeStyles` (which IS extracted → `griffel.css`), so they have **zero references to `insertCSSRules`**, no Stylis, and no runtime CSS injection code.

### Evidence

```
Stylis ("comm" marker):     fonts: ✅  |  sprite: ❌  |  SVG: ❌
@font-face:                 fonts: ✅  |  sprite: ❌  |  SVG: ❌
useInsertionEffect:         fonts: ✅  |  sprite: ❌  |  SVG: ❌
insertCSSRules references:  fonts: 4   |  sprite: 0   |  SVG: 0
```

### Potential Solutions

1. **Upstream fix**: Add `makeStaticStyles` support to `@griffel/babel-preset` so `@font-face` rules get extracted to CSS at build time — eliminates the ~10 KB Stylis + renderer overhead entirely.

2. **Local workaround**: Replace `makeStaticStyles` with a plain CSS file containing the `@font-face` declarations, imported directly via a CSS import. This bypasses Griffel for static CSS that doesn't need runtime processing. The webpack/bundler CSS loader pipeline would handle extraction.

3. **Hybrid approach**: Keep `makeStaticStyles` for runtime flexibility but add a build-time optimization pass that detects static `@font-face` content and pre-extracts it, similar to how `makeStyles` is handled.

## Scaling Characteristics

| Approach | Fixed overhead | Per-icon cost | Per-group external asset |
|---|---|---|---|
| SVG Inline | ~5.1 KB (Griffel + bootstrap) | ~1 KB per icon (full SVG path data) | none |
| Icon Fonts | ~15 KB (Griffel + Stylis + renderer + bootstrap) | ~100–150 B per icon (codepoint) | ~1–2 KB per font family (woff2) |
| SVG Sprite | ~5.9 KB (Griffel + bootstrap) | ~50–100 B per icon (use href ref) | ~3–5 KB per icon group sprite (gzipped) |

**At scale** (hundreds of icons):
- SVG Inline grows fastest (each icon adds ~1 KB of path data to JS).
- Icon Fonts has the highest fixed cost (~10 KB extra), but per-icon cost is tiny. Font files grow with total icon count across the library but are shared/cached.
- SVG Sprite has the lowest JS overhead, but external sprite files can grow large for icon groups with many variants.
