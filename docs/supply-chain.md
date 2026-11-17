# Supply-chain security (dependencies)

**Slopsquatting** is when someone publishes a malicious npm package under a name an AI
assistant (or a person) is likely to invent or mistype, hoping it gets installed. Related
attacks: typosquats (`expresss`), hijacked maintainer accounts publishing a bad release, and
install scripts that run code on your machine the moment a package is installed.

This project defends in layers. The first two run automatically; the rest is how we work.

## 1. pnpm blocks risky installs (`pnpm-workspace.yaml`)

| Setting | What it stops |
|---|---|
| `minimumReleaseAge: 4320` | Any version less than 3 days old. Most malicious releases are found and pulled within hours. |
| `trustPolicy: no-downgrade` | A release published less trustworthily than earlier ones (e.g. by hand after CI-with-provenance), a sign of a hijacked account. Reviewed exceptions are in `trustPolicyExclude`, exact versions only, each with a note. |
| `blockExoticSubdeps: true` | Dependencies of dependencies from git repos or tarball URLs instead of the npm registry. |
| `strictDepBuilds: true` + `allowBuilds` | Install scripts from any package not on the reviewed list: the install fails instead of running them. |

## 2. CI checks every pull request (`.github/workflows/ci.yml`)

- `pnpm install --frozen-lockfile`: installs exactly what the lockfile says, with the rules above.
- `node scripts/verify-deps.mjs`:
  - every locked package's sha512 hash must equal the npm registry's for that version;
  - every version must carry npm's registry signature;
  - every package we depend on directly must be at least 90 days old, have 10,000+ weekly
    downloads and list a source repository, unless a person reviewed it and recorded why in
    `scripts/deps-reviewed.json`.
- `pnpm audit --prod --audit-level critical`: no known critical vulnerability in what the site runs.

## 3. Before adding or changing a package (people and AI assistants alike)

1. **Confirm the name from the official source**: the library's own docs or GitHub README, not
   from memory or an AI's suggestion. Check the exact spelling and scope (`@scope/name`).
2. **Check it on npmjs.com**: publisher and maintainers match the project's real maintainers;
   the repository link goes to the real project; weekly downloads and age make sense; no
   unexpected `postinstall` script. Prefer versions with **provenance** (npm shows "Built and
   signed on GitHub Actions"), which proves which repo and workflow built it.
3. **Add it with pnpm** (`pnpm add name@version`), then run `node scripts/verify-deps.mjs`.
   If it flags the package, review it and record the reason in `scripts/deps-reviewed.json`.
4. **Commit `package.json` and `pnpm-lock.yaml` together**, and look at the lockfile diff in the
   pull request: a small change should add a few entries, not hundreds.
5. **Never** bypass the protections to make an install pass (no `dangerouslyAllowAllBuilds`, no
   lowering `minimumReleaseAge`, no new `trustPolicyExclude` without a written review).

## Status

- 11/16/2026: all 826 locked packages verified against the registry (hashes, signatures,
  publishers, provenance); no slopsquats or typosquats.
- Known vulnerabilities, none critical: mostly inside the shadcn CLI's own dependencies.
  Planned after the demo: move `shadcn` to devDependencies and upgrade `nodemailer` (8.x) and
  `zod` (4.x).
