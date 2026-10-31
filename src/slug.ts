/** Lowercase, ASCII, hyphenated DNS label (max 63 chars). */
export function toDnsLabel(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '')
}

export const RESERVED_SLUGS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'mail',
  'cms',
  'status',
  'docs',
  'static',
  'assets',
])

/**
 * Pick a slug that no other owner holds. `taken` maps slug -> owner key (any stable id).
 * Deterministic, so re-imports keep the same slug.
 */
export function uniqueSlug(base: string, owner: string, taken: Map<string, string>): string {
  const candidates = [base, `${base}-${toDnsLabel(owner)}`]
  for (const c of candidates) {
    if (RESERVED_SLUGS.has(c)) continue
    const holder = taken.get(c)
    if (!holder || holder === owner) return c
  }
  let i = 2
  while (taken.has(`${base}-${i}`) && taken.get(`${base}-${i}`) !== owner) i++
  return `${base}-${i}`
}
