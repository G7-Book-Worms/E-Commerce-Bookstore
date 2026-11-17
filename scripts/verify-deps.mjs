// Supply-chain check (run in CI and before adding a package): docs/supply-chain.md.
//
// For every package in pnpm-lock.yaml:
//   - the sha512 hash in our lockfile must match the npm registry's hash for that exact version
//     (nothing was swapped between the registry and us), and
//   - the version must carry npm's registry signature.
// For every package listed in package.json (the ones we chose), it also looks for the signs of
// a slopsquat or typosquat: a package that is brand new or that almost nobody uses. Anything
// unusual fails the check until a person reviews it and adds it to scripts/deps-reviewed.json.
//
//   node scripts/verify-deps.mjs
import { readFileSync, existsSync } from 'node:fs';

const MIN_WEEKLY_DOWNLOADS = 10_000;
const MIN_AGE_DAYS = 90;

const lock = readFileSync('pnpm-lock.yaml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const reviewed = existsSync('scripts/deps-reviewed.json') ? JSON.parse(readFileSync('scripts/deps-reviewed.json', 'utf8')) : {};

const entries = [];
const re = /^ {2}'?((?:@[^@/\s]+\/)?[^@\s']+)@([^:'\s(]+)[^:]*'?:\n {4}resolution: \{integrity: ([^,}]+)/gm;
for (let m; (m = re.exec(lock)); ) entries.push({ name: m[1], version: m[2], integrity: m[3] });
const unique = [...new Map(entries.map((e) => [`${e.name}@${e.version}`, e])).values()];
if (unique.length < 50) throw new Error(`Only ${unique.length} lockfile entries parsed: has the lockfile format changed?`);

const docs = new Map();
const packument = (name) => {
  if (!docs.has(name)) {
    docs.set(name, fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)));
  }
  return docs.get(name);
};

const problems = [];
let i = 0;
await Promise.all(Array.from({ length: 16 }, async () => {
  while (i < unique.length) {
    const e = unique[i++];
    const v = (await packument(e.name))?.versions?.[e.version];
    if (!v) problems.push(`${e.name}@${e.version}: not on the npm registry`);
    else if (v.dist.integrity !== e.integrity) problems.push(`${e.name}@${e.version}: lockfile hash does not match the registry`);
    else if (!v.dist.signatures?.length) problems.push(`${e.name}@${e.version}: no npm registry signature`);
  }
}));

const direct = { ...pkg.dependencies, ...pkg.devDependencies };
for (const name of Object.keys(direct)) {
  if (reviewed[name]) continue;
  const doc = await packument(name);
  if (!doc) { problems.push(`${name}: not found on the registry`); continue; }
  const ageDays = (Date.now() - new Date(doc.time?.created ?? 0).getTime()) / 86_400_000;
  const dl = await fetch(`https://api.npmjs.org/downloads/point/last-week/${name}`).then((r) => r.json()).catch(() => ({}));
  if (ageDays < MIN_AGE_DAYS) problems.push(`${name}: package created ${Math.round(ageDays)} days ago (review it, then add it to scripts/deps-reviewed.json)`);
  if (typeof dl.downloads === 'number' && dl.downloads < MIN_WEEKLY_DOWNLOADS) problems.push(`${name}: only ${dl.downloads} downloads last week (review it, then add it to scripts/deps-reviewed.json)`);
  const lockedVersions = unique.filter((e) => e.name === name).map((e) => doc.versions?.[e.version]);
  const hasRepo = [doc, doc.versions?.[doc['dist-tags']?.latest], ...lockedVersions].some((d) => d?.repository);
  if (!hasRepo) problems.push(`${name}: no source repository listed (review it, then add it to scripts/deps-reviewed.json)`);
}

console.log(`Checked ${unique.length} locked packages and ${Object.keys(direct).length} direct dependencies.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('All hashes match the registry, all are signed, and no direct dependency looks like a slopsquat.');
