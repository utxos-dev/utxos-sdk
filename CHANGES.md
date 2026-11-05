# Changes (2026-02-28)

## What changed
- **Publish configs**: Added `src/configs/**` to `package.json:files` so ESLint/TS/Prettier presets ship with the package.
- **Security cleanup**: Replaced transitive `npm` CLI dependency (brought in by `@cardano-sdk/*`) with a minimal stub under `stubs/npm`, declared via `package.json` overrides. This removes the vulnerable minimatch/tar chain reported by `npm audit`.

## Files touched
- `package.json` -- publish files, overrides pointing `npm` to `stubs/npm`.
- `package-lock.json` -- refreshed after overrides.
- `stubs/npm/package.json`, `stubs/npm/index.js` -- safe stub that exports `{}`.

## Commands run
- `npm install` (before/after overrides)
- `npm run build:sdk`
- `npm audit`, `npm audit --production`
- `npm pack --dry-run`

## Current status
- `npm audit` reports **0 vulnerabilities**.
- `npm run build:sdk` succeeds; dist artifacts generated.

## Rationale / caveats
- `@cardano-sdk/*` list `npm` as a dependency but do not require it at runtime; the stub keeps runtime behavior intact while eliminating vulnerable bundled deps.
- If a future task needs the real npm CLI from those packages (unlikely), remove the `npm` override and reinstall; expect audit warnings to return.

## Next steps
- If you plan to publish: `npm run build:sdk` then `npm pack --dry-run` to confirm contents include `dist/` and `src/configs/**`.
