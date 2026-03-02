// @ts-check
/**
 * Refreshes all @griffel/* packages in the root package.json.
 *
 * Steps:
 *  1. Read root package.json and extract all @griffel/* entries from devDependencies.
 *  2. Remove them from package.json and run `npm i` (cleans up node_modules / lockfile).
 *  3. Restore the @griffel/* entries to package.json and run `npm i` again (re-installs them).
 *
 * Flags:
 *  --latest   Resolve the latest published npm version (via `npm view`) and use that
 *             instead of restoring the original file: paths.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Package needed for testing:

    "@griffel/babel-preset": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-babel-preset-1.8.0.tgz",
    "@griffel/core": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-core-1.20.0.tgz",
    "@griffel/eslint-plugin": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-eslint-plugin-2.0.1.tgz",
    "@griffel/react": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-react-1.6.0.tgz",
    "@griffel/webpack-extraction-plugin": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-webpack-extraction-plugin-0.5.13.tgz",
    "@griffel/webpack-loader": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-webpack-loader-2.2.21.tgz",
    "@griffel/webpack-plugin": "file:/Users/martinhochel/Projects/msft/griffel/dist/pack/griffel-webpack-plugin-1.0.0.tgz",

*/

// Support both `npm run update-griffel -- --latest` and `npm run update-griffel --latest`
const useLatest = process.argv.includes('--latest') || process.env.npm_config_latest === 'true';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const pkgPath = resolve(rootDir, 'package.json');

function readPkg() {
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

function writePkg(pkg) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

const pkg = readPkg();

const devDeps = pkg.devDependencies ?? {};
const griffelEntries = Object.entries(devDeps).filter(([name]) => name.startsWith('@griffel/'));

if (griffelEntries.length === 0) {
  console.log('No @griffel/* packages found in devDependencies. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${griffelEntries.length} @griffel/* package(s):`);
griffelEntries.forEach(([name, version]) => console.log(`  ${name}: ${version}`));

if (useLatest) {
  console.log('\nMode: --latest (will resolve latest published npm versions via npm view).');
}

// Step 1 – remove griffel packages and install
console.log('\n--- Step 1: removing @griffel/* from package.json and running npm i ---');
for (const [name] of griffelEntries) {
  delete pkg.devDependencies[name];
}
writePkg(pkg);

run('npm i');

// Step 2 – restore griffel packages and install
console.log('\n--- Step 2: restoring @griffel/* to package.json and running npm i ---');

/** @type {[string, string][]} */
let entriesToRestore;

if (useLatest) {
  console.log('Resolving latest published npm versions...');
  entriesToRestore = griffelEntries.flatMap(([name]) => {
    try {
      const version = execSync(`npm view ${name} version`, { cwd: rootDir, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
      console.log(`  ${name} → ${version}`);
      return [[name, version]];
    } catch {
      console.warn(`  ${name} → not found on npm, skipping`);
      return [];
    }
  });
} else {
  entriesToRestore = griffelEntries;
}

const restored = readPkg();
restored.devDependencies = restored.devDependencies ?? {};
for (const [name, version] of entriesToRestore) {
  restored.devDependencies[name] = version;
}

// Keep devDependencies sorted by key for a clean diff
restored.devDependencies = Object.fromEntries(Object.entries(restored.devDependencies).sort(([a], [b]) => a.localeCompare(b)));

writePkg(restored);

run('npm i');

console.log('\nDone! @griffel/* packages have been refreshed.');
