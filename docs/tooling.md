# Tooling

## TypeScript
- Base config in `tsconfig.base.json`.
- Apps/libs typically have their own `tsconfig.json`.
- Output goes to `dist/`.

## Linting
Root script:
```
pnpm lint
```
If you add or change lint rules, ensure a root ESLint config exists.

## Formatting
Root script:
```
pnpm format
```
If you add or change formatting rules, ensure a root Prettier config exists.

## Tests
Root script:
```
pnpm test
```
If tests are added inside apps/libs, ensure Jest config is wired up.
