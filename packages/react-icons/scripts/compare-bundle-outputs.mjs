#!/usr/bin/env node
// @ts-check

/**
 * Compares the 3 webpack bundle outputs (SVG inline, Fonts, SVG Sprite)
 * produced by monosize, breaking down shared runtime vs icon-specific code
 * and identifying external assets.
 *
 * Usage: node packages/react-icons/scripts/compare-bundle-outputs.mjs
 */

import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST_DIR = resolve(import.meta.dirname, '..', 'dist', 'bundle-size');

// ─── Bundle definitions ────────────────────────────────────────────────────────

const BUNDLES = [
  {
    label: 'SVG Inline',
    shortLabel: 'SVG',
    file: 'atomic-import.output.js',
  },
  {
    label: 'Icon Fonts',
    shortLabel: 'Fonts',
    file: 'atomic-import.fonts.output.js',
  },
  {
    label: 'SVG Sprite',
    shortLabel: 'Sprite',
    file: 'atomic-import.svg-sprite.output.js',
  },
];

// ─── Analysis helpers ──────────────────────────────────────────────────────────

/**
 * @param {string} content
 * @returns {{ minified: number, gzipped: number }}
 */
function measureSize(content) {
  const buf = Buffer.from(content, 'utf-8');
  return {
    minified: buf.length,
    gzipped: gzipSync(buf).length,
  };
}

/**
 * Detect external asset references in a webpack bundle output.
 * Webpack encodes asset URLs via `__webpack_require__.p + "filename"` patterns.
 * @param {string} content
 * @returns {{ fonts: string[], svgs: string[] }}
 */
function detectExternalAssets(content) {
  const fonts = /** @type {string[]} */ ([]);
  const svgs = /** @type {string[]} */ ([]);

  // Match font file references (ttf, woff, woff2)
  const fontPattern = /["']([^"']*\.(?:ttf|woff2?))["']/g;
  let m;
  while ((m = fontPattern.exec(content)) !== null) {
    const name = m[1].replace(/^.*\//, '');
    if (!fonts.includes(name)) fonts.push(name);
  }

  // Match SVG file references (sprite files emitted as assets)
  const svgPattern = /["']([^"']*\.svg)["']/g;
  while ((m = svgPattern.exec(content)) !== null) {
    const name = m[1].replace(/^.*\//, '');
    if (!svgs.includes(name)) svgs.push(name);
  }

  return { fonts, svgs };
}

/**
 * Measure actual file sizes of external assets on disk.
 * Browsers only download one format per @font-face (woff2 preferred),
 * so we report woff2-only totals for a realistic transfer estimate.
 *
 * @param {{ fonts: string[], svgs: string[] }} assets
 * @param {string} baseDir
 * @returns {{ fontSizeRaw: number, fontSizeGz: number, fontWoff2SizeRaw: number, fontWoff2SizeGz: number, svgSizeRaw: number, svgSizeGz: number, fontDetails: Array<{name: string, size: number}>, svgDetails: Array<{name: string, size: number, gzipped: number}> }}
 */
function measureExternalAssets(assets, baseDir) {
  let fontSizeRaw = 0;
  let fontSizeGz = 0;
  let fontWoff2SizeRaw = 0;
  let fontWoff2SizeGz = 0;
  let svgSizeRaw = 0;
  let svgSizeGz = 0;
  /** @type {Array<{name: string, size: number}>} */
  const fontDetails = [];
  /** @type {Array<{name: string, size: number, gzipped: number}>} */
  const svgDetails = [];

  for (const name of assets.fonts) {
    const filePath = join(baseDir, name);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      const size = buf.length;
      const gz = gzipSync(buf).length;
      fontSizeRaw += size;
      fontSizeGz += gz;
      fontDetails.push({ name, size });
      if (name.endsWith('.woff2')) {
        fontWoff2SizeRaw += size;
        fontWoff2SizeGz += gz;
      }
    }
  }

  for (const name of assets.svgs) {
    const filePath = join(baseDir, name);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      const size = buf.length;
      const gz = gzipSync(buf).length;
      svgSizeRaw += size;
      svgSizeGz += gz;
      svgDetails.push({ name, size, gzipped: gz });
    }
  }

  return { fontSizeRaw, fontSizeGz, fontWoff2SizeRaw, fontWoff2SizeGz, svgSizeRaw, svgSizeGz, fontDetails, svgDetails };
}

/**
 * Estimate code region sizes within a bundle.
 *
 * Strategy: Use structural markers in the minified webpack output:
 * - Icon names like "AirplaneFilled" mark the start of icon definition code
 * - `console.log(` marks the end of the fixture's user code (after all icon defs)
 * - Everything after console.log is webpack bootstrap/runtime
 * - Everything before the first icon definition is shared runtime (Griffel + approach infra)
 *
 * @param {string} content
 * @returns {{ sharedRuntime: number, iconDefinitions: number, webpackBootstrap: number }}
 */
function estimateCodeRegions(content) {
  // Find start of icon definitions: first named icon reference
  const iconNamePattern = /"Airplane(?:Filled|Regular)"/;
  const iconNameMatch = iconNamePattern.exec(content);

  // Walk backwards from the icon name match to find the start of the icon factory block
  let firstIconDef = iconNameMatch ? iconNameMatch.index : content.length;
  if (iconNameMatch) {
    // Look for the nearest `displayName=` or factory function call before this point
    const precedingBlock = content.substring(Math.max(0, firstIconDef - 500), firstIconDef);
    const factoryIdx = precedingBlock.lastIndexOf('displayName=');
    const createElementIdx = precedingBlock.lastIndexOf('createElement(');
    // Use whichever is closest before the icon name
    const candidates = [factoryIdx, createElementIdx].filter((i) => i !== -1);
    if (candidates.length > 0) {
      firstIconDef = Math.max(0, firstIconDef - 500) + Math.min(...candidates);
    }
  }

  // Find end of user code: the fixture's console.log() call.
  // Use lastIndexOf because implementation code (e.g., font icon factory) may
  // contain its own console.log calls before the fixture's final one.
  const consoleLogIdx = content.lastIndexOf('console.log(');
  const userCodeEnd = consoleLogIdx !== -1 ? consoleLogIdx : content.length;

  // Webpack bootstrap: everything after the module's closing (after console.log block)
  // Find the closing `}` of the module function, then remaining is webpack runtime
  let bootstrapStart = content.length;
  if (consoleLogIdx !== -1) {
    // After console.log(...), skip to the closing of the module, then bootstrap begins
    // Typically: console.log(o,e)}}  ,t={}; ...webpack runtime...
    const afterConsole = content.indexOf('}},', consoleLogIdx);
    if (afterConsole !== -1) {
      bootstrapStart = afterConsole + 3; // skip `}},'
    }
  }

  const sharedRuntime = Math.max(0, firstIconDef);
  const iconDefinitions = Math.max(0, userCodeEnd - firstIconDef);
  const webpackBootstrap = Math.max(0, content.length - bootstrapStart);

  return { sharedRuntime, iconDefinitions, webpackBootstrap };
}

/**
 * Detect font-specific overhead: @font-face declarations and codepoint data.
 * @param {string} content
 * @returns {{ hasFontFace: boolean, fontFaceSize: number }}
 */
function detectFontOverhead(content) {
  const fontFaceMatch = content.match(/@font-face/g);
  if (!fontFaceMatch) return { hasFontFace: false, fontFaceSize: 0 };

  // Estimate @font-face block size by finding the template literal containing them
  const ffStart = content.indexOf('@font-face');
  // Find the closing of the template string (look for backtick or closing quote)
  let ffEnd = ffStart;
  let depth = 0;
  for (let i = ffStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      // After all @font-face blocks close, look for the end
      if (depth < 0) {
        ffEnd = i;
        break;
      }
    }
    // Also break on the template literal end pattern
    if (content[i] === '`' && i > ffStart + 10) {
      ffEnd = i;
      break;
    }
  }

  return {
    hasFontFace: true,
    fontFaceSize: ffEnd - ffStart,
  };
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytesShort(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * @param {number} part
 * @param {number} total
 * @returns {string}
 */
function pct(part, total) {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

/**
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function padEnd(str, width) {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

/**
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function padStart(str, width) {
  return ' '.repeat(Math.max(0, width - str.length)) + str;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(DIST_DIR)) {
    console.error(
      `❌ Bundle output directory not found: ${DIST_DIR}\n` +
        `   Run "npx nx run react-icons:bundle-size" first to generate outputs.`,
    );
    process.exit(1);
  }

  const cssFile = join(DIST_DIR, 'griffel.css');
  const cssSize = existsSync(cssFile) ? statSync(cssFile).size : 0;
  const cssGzipped = cssSize > 0 ? gzipSync(readFileSync(cssFile)).length : 0;

  /** @type {Array<{ label: string, shortLabel: string, file: string, content: string, size: { minified: number, gzipped: number }, regions: ReturnType<typeof estimateCodeRegions>, assets: ReturnType<typeof detectExternalAssets>, assetSizes: ReturnType<typeof measureExternalAssets>, fontOverhead: ReturnType<typeof detectFontOverhead> }>} */
  const results = [];

  for (const bundle of BUNDLES) {
    const filePath = join(DIST_DIR, bundle.file);
    if (!existsSync(filePath)) {
      console.error(`⚠️  Missing: ${bundle.file}`);
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const size = measureSize(content);
    const regions = estimateCodeRegions(content);
    const assets = detectExternalAssets(content);
    const assetSizes = measureExternalAssets(assets, DIST_DIR);
    const fontOverhead = detectFontOverhead(content);

    results.push({
      ...bundle,
      content,
      size,
      regions,
      assets,
      assetSizes,
      fontOverhead,
    });
  }

  if (results.length === 0) {
    console.error('❌ No bundle outputs found.');
    process.exit(1);
  }

  // ─── Print comparison table ──────────────────────────────────────────────

  const COL1 = 32; // metric name column
  const COLN = 24; // data columns (wider for asset size details)

  const hr = '─'.repeat(COL1 + COLN * results.length + results.length + 1);
  const hrBold = '═'.repeat(COL1 + COLN * results.length + results.length + 1);

  console.log();
  console.log(`  ${'╔' + hrBold + '╗'}`);
  console.log(
    `  ║${padEnd('  Webpack Bundle Output Comparison', COL1 + COLN * results.length + results.length)}║`,
  );
  console.log(`  ${'╠' + hrBold + '╣'}`);

  // Header row
  let header = `  ║ ${padEnd('Metric', COL1 - 2)}`;
  for (const r of results) {
    header += `│${padStart(r.shortLabel + ' ', COLN)}`;
  }
  header += '║';
  console.log(header);
  console.log(`  ${'╠' + hr + '╣'}`);

  /**
   * @param {string} metric
   * @param {(r: typeof results[0]) => string} valueFn
   */
  function row(metric, valueFn) {
    let line = `  ║ ${padEnd(metric, COL1 - 2)}`;
    for (const r of results) {
      line += `│${padStart(valueFn(r) + ' ', COLN)}`;
    }
    line += '║';
    console.log(line);
  }

  function separator() {
    console.log(`  ${'╟' + '─'.repeat(COL1 + COLN * results.length + results.length) + '╢'}`);
  }

  // Size section
  row('JS bundle (minified)', (r) => formatBytes(r.size.minified));
  row('JS bundle (gzipped)', (r) => formatBytes(r.size.gzipped));
  separator();

  // Code regions
  row('Shared runtime (est.)', (r) => `${formatBytesShort(r.regions.sharedRuntime)} (${pct(r.regions.sharedRuntime, r.size.minified)})`);
  row('Icon definitions (est.)', (r) => `${formatBytesShort(r.regions.iconDefinitions)} (${pct(r.regions.iconDefinitions, r.size.minified)})`);
  row('Webpack bootstrap', (r) => `${formatBytesShort(r.regions.webpackBootstrap)} (${pct(r.regions.webpackBootstrap, r.size.minified)})`);
  separator();

  // Font overhead
  row('@font-face declarations', (r) => (r.fontOverhead.hasFontFace ? `${formatBytesShort(r.fontOverhead.fontFaceSize)}` : 'none'));
  separator();

  // External assets — with actual sizes
  row('External font files', (r) => {
    if (r.assets.fonts.length === 0) return 'none';
    return `${r.assets.fonts.length} files (${formatBytesShort(r.assetSizes.fontSizeRaw)})`;
  });
  row('  └ woff2 only (transfer)', (r) => {
    if (r.assetSizes.fontWoff2SizeRaw === 0) return '—';
    return `${formatBytesShort(r.assetSizes.fontWoff2SizeRaw)}`;
  });
  row('External SVG sprites', (r) => {
    if (r.assets.svgs.length === 0) return 'none';
    return `${r.assets.svgs.length} files (${formatBytesShort(r.assetSizes.svgSizeRaw)})`;
  });
  row('  └ gzipped (transfer)', (r) => {
    if (r.assetSizes.svgSizeGz === 0) return '—';
    return `${formatBytesShort(r.assetSizes.svgSizeGz)}`;
  });
  row('Extracted CSS', () => (cssSize > 0 ? formatBytes(cssSize) : 'none'));
  separator();

  // Total transfer estimate (JS gzipped + CSS gzipped + best-case assets)
  // Fonts: browsers download woff2 only; fonts are already compressed, not gzippable further
  // SVG sprites: gzipped for transfer
  row('Est. total transfer (gz)', (r) => {
    let total = r.size.gzipped;
    if (cssSize > 0) total += cssGzipped;
    // woff2 is already compressed, use raw woff2 size as transfer cost
    total += r.assetSizes.fontWoff2SizeRaw;
    total += r.assetSizes.svgSizeGz;
    return formatBytes(total);
  });

  console.log(`  ${'╚' + hrBold + '╝'}`);

  // ─── External assets detail ──────────────────────────────────────────────

  console.log();
  console.log('  External assets breakdown:');
  for (const r of results) {
    console.log(`    ${r.label}:`);
    if (r.assetSizes.fontDetails.length > 0) {
      const woff2Files = r.assetSizes.fontDetails.filter((f) => f.name.endsWith('.woff2'));
      console.log(
        `      Fonts (all ${r.assets.fonts.length} files): ${formatBytes(r.assetSizes.fontSizeRaw)}`,
      );
      console.log(
        `      Fonts (woff2 only — actual transfer): ${woff2Files.map((f) => `${f.name} (${formatBytesShort(f.size)})`).join(', ')}`,
      );
    }
    if (r.assetSizes.svgDetails.length > 0) {
      console.log(
        `      SVG sprites: ${r.assetSizes.svgDetails.map((f) => `${f.name} (${formatBytesShort(f.size)}, gz: ${formatBytesShort(f.gzipped)})`).join(', ')}`,
      );
    }
    if (r.assetSizes.fontDetails.length === 0 && r.assetSizes.svgDetails.length === 0) {
      console.log(`      none — all icon data embedded in JS`);
    }
  }

  // ─── Key insights ────────────────────────────────────────────────────────

  console.log();
  console.log('  Key insights:');

  const svgResult = results.find((r) => r.shortLabel === 'SVG');
  const fontResult = results.find((r) => r.shortLabel === 'Fonts');
  const spriteResult = results.find((r) => r.shortLabel === 'Sprite');

  if (svgResult && spriteResult) {
    const ratio = (svgResult.size.minified / spriteResult.size.minified).toFixed(1);
    console.log(`    • SVG Inline is ${ratio}x larger than SVG Sprite (minified JS)`);
  }
  if (svgResult && fontResult) {
    const ratio = (svgResult.size.minified / fontResult.size.minified).toFixed(1);
    console.log(`    • SVG Inline is ${ratio}x larger than Fonts (minified JS)`);
  }
  if (fontResult && spriteResult) {
    console.log(
      `    • Fonts include ${fontResult.assets.fonts.length} external font files (loaded on-demand)`,
    );
    console.log(
      `    • SVG Sprite includes ${spriteResult.assets.svgs.length} external SVG files (loaded via <use href>)`,
    );
  }
  if (svgResult) {
    console.log(`    • SVG Inline embeds all icon path data directly in JS — no external assets`);
  }

  console.log();
}

main();
