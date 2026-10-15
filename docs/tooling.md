# Tooling

## TypeScript
- Base config in `tsconfig.base.json`.
- The portal has its own `tsconfig.json`.


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
If tests are added, ensure Jest config is wired up.
