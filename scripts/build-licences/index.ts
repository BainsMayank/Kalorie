/**
 * Builds src/features/licences/licences.json: every open-source package that ships inside the
 * app, with its licence text, for the Open-source licences screen (Profile → About).
 *
 * MIT, BSD and Apache licences ask that their notice travels with every copy of the software,
 * and an app on a phone is a copy. Run after adding, removing or updating a library:
 *
 *     npm run build:licences
 *
 * "Ships inside the app" means:
 *  - JavaScript: every package Metro puts into the Android and iOS bundles (read from the
 *    bundles' source maps), so build tools like Babel and the Expo CLI are left out;
 *  - native code: every installed runtime package with its own Android or iOS code (expo-*
 *    modules, react-native-svg…), which autolinking compiles into the app.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'src/features/licences/licences.json');

type LockPackage = { version?: string; license?: unknown; dev?: boolean };

/** "node_modules/a/node_modules/@b/c" → "@b/c" */
function packageName(lockPath: string): string {
  return lockPath.slice(lockPath.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

/** Package names found in a source map's file list. */
function packagesInSourceMap(file: string): Set<string> {
  const map = JSON.parse(readFileSync(file, 'utf8')) as { sources: string[] };
  const names = new Set<string>();
  for (const source of map.sources) {
    const i = source.lastIndexOf('node_modules/');
    if (i < 0) continue;
    const parts = source.slice(i + 'node_modules/'.length).split('/');
    names.add(parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
  }
  return names;
}

function bundledPackages(): Set<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'kalorie-licences-'));
  const names = new Set<string>();
  try {
    for (const platform of ['android', 'ios']) {
      const out = path.join(dir, platform);
      console.log(`Exporting the ${platform} bundle…`);
      execFileSync(
        path.join(ROOT, 'node_modules/.bin/expo'),
        ['export', '--platform', platform, '--source-maps', '--output-dir', out],
        { cwd: ROOT, stdio: 'ignore' },
      );
      const jsDir = path.join(out, '_expo/static/js', platform);
      for (const file of readdirSync(jsDir).filter((f) => f.endsWith('.map'))) {
        for (const name of packagesInSourceMap(path.join(jsDir, file))) names.add(name);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return names;
}

function hasNativeCode(dir: string): boolean {
  if (existsSync(path.join(dir, 'expo-module.config.json'))) return true;
  if (existsSync(path.join(dir, 'android/build.gradle'))) return true;
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith('.podspec'));
}

function licenceName(value: unknown): string {
  if (typeof value === 'string') return value;
  return 'See licence text';
}

function licenceText(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
  return file ? readFileSync(path.join(dir, file), 'utf8').trim() : null;
}

function main() {
  const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockPackage>;
  };
  const bundled = bundledPackages();

  // One entry per package name: the top-level copy, which is the one Metro and autolinking use.
  const byName = new Map<string, { lockPath: string; info: LockPackage }>();
  for (const [lockPath, info] of Object.entries(lock.packages)) {
    if (lockPath === '' || info.dev) continue;
    const name = packageName(lockPath);
    const existing = byName.get(name);
    if (!existing || lockPath.length < existing.lockPath.length)
      byName.set(name, { lockPath, info });
  }

  const texts: string[] = [];
  const textIndex = new Map<string, number>();
  const packages: { name: string; version: string; license: string; text: number | null }[] = [];

  for (const [name, { lockPath, info }] of byName) {
    const dir = path.join(ROOT, lockPath);
    if (!bundled.has(name) && !hasNativeCode(dir)) continue;
    const text = licenceText(dir);
    let index: number | null = null;
    if (text !== null) {
      index = textIndex.get(text) ?? texts.length;
      if (index === texts.length) {
        texts.push(text);
        textIndex.set(text, index);
      }
    }
    packages.push({
      name,
      version: info.version ?? '',
      license: licenceName(info.license),
      text: index,
    });
  }
  packages.sort((a, b) => a.name.localeCompare(b.name));

  const missing = [...bundled].filter((name) => !byName.has(name));
  if (missing.length > 0) console.warn(`Not found in package-lock.json: ${missing.join(', ')}`);

  writeFileSync(OUT, `${JSON.stringify({ packages, texts })}\n`);
  const withoutText = packages.filter((p) => p.text === null).map((p) => p.name);
  console.log(
    `${packages.length} packages, ${texts.length} different licence texts → ${path.relative(ROOT, OUT)}`,
  );
  if (withoutText.length > 0) {
    console.log(`No licence file (the screen links to npm instead): ${withoutText.join(', ')}`);
  }
}

main();
