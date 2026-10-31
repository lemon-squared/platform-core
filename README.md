# @lemon-squared/platform

The generic multi-tenant site layer shared by Lemon Squared's products. It holds only
product-neutral code:

| Module                                             | What it does                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `hosts`                                            | Resolve a request host to tenant / admin / root / custom domain (`resolveHost`, `normaliseHost`) |
| `domains` (also `@lemon-squared/platform/domains`) | Platform vs custom domains, primary domain, site origin and URLs                                 |
| `health`                                           | Liveness/readiness probes with timeouts (`readiness`, `runCheck`, `NO_STORE_HEADERS`)            |
| `seo`                                              | Canonical URLs and redirects, robots, sitemap XML, JSON-LD helpers, meta description capping     |
| `phone`                                            | UK phone normalising, display grouping and `tel:` links                                          |
| `hours`                                            | Weekday rows and schema.org opening hours helpers                                                |
| `slug`                                             | DNS-safe slugs and reserved names                                                                |
| `markdown`                                         | Markdown clean-up helpers (front matter, pipe tables, heading gaps, path prefixes)               |

## The boundary

Nothing product-specific belongs here. Two checks enforce it, and both run in CI:

- Biome `noRestrictedImports` fails on any import of a product package (`@gp/*`) under `src/`.
- `test/boundary.test.ts` fails on product-specific wording or fields in `src/`, and on any
  product-package dependency.

Product code lives in each product's own repo and imports from here.

## Installing

The repo is public, so no token is needed. Depend on a release tag:

```json
"@lemon-squared/platform": "github:lemon-squared/platform-core#v0.1.0"
```

`bun install` (or npm / pnpm) fetches it anonymously and pins the exact commit in the lockfile.

The package ships TypeScript source (no build step), so a Next.js consumer must list it in
`transpilePackages`:

```ts
// next.config.ts
transpilePackages: ['@lemon-squared/platform']
```

## Development

```sh
bun install
bun run check      # biome ci + typecheck + tests
```

Toolchain: Bun 1.4.2, TypeScript 5.7.3, Biome 2.6.4.

## Releasing (semver with Changesets)

1. In each PR with a consumer-visible change: `bun run changeset`, choose patch / minor / major,
   describe the change, commit the generated `.changeset/*.md`.
2. To cut a release: `bun run version` (bumps `package.json`, writes `CHANGELOG.md`), open a PR,
   merge it, then tag the merge commit `vX.Y.Z` and push the tag.
3. Consumers move to the new release by changing the `#vX.Y.Z` in their dependency.

There is also a manual **Publish** workflow (Actions → Publish, dry run by default) that can push
the package to GitHub Packages. It is optional and unused: GitHub Packages needs a token even to
read, so consumers install from the git tag instead.

## License

No license has been granted yet: all rights reserved.
