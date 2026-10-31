/**
 * Search and sharing metadata for tenant sites. Pure functions only: no DB, no Next.
 *
 * Every URL a search engine or social card sees is built here, from the tenant's public
 * origin: its primary custom domain. Demos without one use <slug>.<root>; live tenants never
 * do. Language alternates (hreflang) slot in through `PageUrlOptions.languages`.
 */
import { bareDomain, primaryDomain } from './domains'
import { type HoursRow, WEEKDAYS } from './hours'
import { normalisePath } from './markdown'

export { customDomains, isPlatformDomain, primaryDomain } from './domains'

export interface SeoTenant {
  name: string
  slug: string
  status: 'draft' | 'demo' | 'live'
  /** Custom domains in CMS order. The first custom one is the primary (canonical) domain. */
  domains: string[]
  siteDisabled?: boolean
  /** When the platform owner confirmed the primary domain points at us. Null: not verified. */
  domainVerifiedAt?: string | null
}

export type LiveIssue = 'no-custom-domain' | 'domain-not-verified'

/**
 * What stops a tenant being served as live, or null when nothing does. A live tenant
 * needs a custom domain that is not a platform domain, and that domain must be verified.
 */
export function liveIssue(
  tenant: Pick<SeoTenant, 'domains' | 'domainVerifiedAt'>,
  platformDomains: readonly string[],
): LiveIssue | null {
  if (!primaryDomain(tenant, platformDomains)) return 'no-custom-domain'
  if (!tenant.domainVerifiedAt) return 'domain-not-verified'
  return null
}

/** Live, with a verified custom domain. Only these tenants are redirected to and indexed. */
export function isLiveReady(
  tenant: Pick<SeoTenant, 'status' | 'domains' | 'domainVerifiedAt'>,
  platformDomains: readonly string[],
): boolean {
  return tenant.status === 'live' && liveIssue(tenant, platformDomains) === null
}

/**
 * "https://<host>" every canonical, share and sitemap URL uses, or null when there is none.
 * - Any tenant with a custom domain: that domain.
 * - Demos and drafts without one: <slug>.<previewRoot> (they are never indexed).
 * - A live tenant without one: null. A live tenant never gets a platform-domain URL.
 */
export function publicOrigin(
  tenant: Pick<SeoTenant, 'slug' | 'status' | 'domains'>,
  platformDomains: readonly string[],
  previewRoot: string,
): string | null {
  const primary = primaryDomain(tenant, platformDomains)
  if (primary) return `https://${primary}`
  if (tenant.status === 'live') return null
  return `https://${tenant.slug}.${bareDomain(previewRoot)}`
}

/** The host a request arrived on, as the proxy rewrote it. */
export type RequestHost = { slug: string } | { domain: string }

/**
 * Where a request for a live tenant must go instead, or null to serve it here. Preview
 * subdomains and secondary domains of a live-ready tenant 308 to the primary domain, keeping
 * the path. The query string is dropped except the keys listed in `keepQuery` (search `q`).
 */
export function canonicalRedirect(
  tenant: Pick<SeoTenant, 'status' | 'domains' | 'domainVerifiedAt'>,
  host: RequestHost,
  platformDomains: readonly string[],
  path: string,
  query: URLSearchParams | Record<string, string | string[] | undefined> = {},
  keepQuery: readonly string[] = [],
): string | null {
  if (!isLiveReady(tenant, platformDomains)) return null
  const primary = primaryDomain(tenant, platformDomains)
  if (!primary) return null
  if ('domain' in host && bareDomain(host.domain) === primary) return null
  const params = query instanceof URLSearchParams ? query : toSearchParams(query)
  const kept = new URLSearchParams()
  for (const key of keepQuery) for (const v of params.getAll(key)) kept.append(key, v)
  const qs = kept.toString()
  return `${canonicalUrl(`https://${primary}`, path)}${qs ? `?${qs}` : ''}`
}

function toSearchParams(query: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    for (const item of Array.isArray(v) ? v : v === undefined ? [] : [v]) out.append(k, item)
  }
  return out
}

/**
 * Canonical path: lower case, no query string or fragment, no trailing slash (except "/"),
 * no duplicate slashes. Same rules as page lookup, so the canonical is the page that renders.
 */
export function canonicalPath(path: string): string {
  return normalisePath(path)
}

/** Absolute canonical URL for a path on this origin. */
export function canonicalUrl(origin: string, path: string): string {
  const p = canonicalPath(path)
  return p === '/' ? `${origin}/` : `${origin}${p}`
}

export interface PageUrlOptions {
  /**
   * hreflang alternates, e.g. { 'en-GB': '/about', cy: '/cy/about' }. Empty until i18n (#6)
   * lands; then the locale router passes every published language here plus 'x-default'.
   */
  languages?: Record<string, string>
}

export interface PageUrls {
  canonical: string
  languages?: Record<string, string>
}

/** Canonical plus alternates for one page, ready for Next's `metadata.alternates`. */
export function pageUrls(origin: string, path: string, options: PageUrlOptions = {}): PageUrls {
  const out: PageUrls = { canonical: canonicalUrl(origin, path) }
  const langs = Object.entries(options.languages ?? {})
  if (langs.length) {
    out.languages = Object.fromEntries(langs.map(([lang, p]) => [lang, canonicalUrl(origin, p)]))
  }
  return out
}

/**
 * Only live tenants with a verified custom domain, not behind the kill switch, are ever
 * indexed. A live tenant still on a platform address is served but kept out of search.
 */
export function isIndexable(
  tenant: Pick<SeoTenant, 'status' | 'siteDisabled' | 'domains' | 'domainVerifiedAt'>,
  platformDomains: readonly string[],
): boolean {
  return isLiveReady(tenant, platformDomains) && tenant.siteDisabled !== true
}

// ---------------------------------------------------------------- descriptions

export const DESCRIPTION_MAX = 160

/** Markdown (or plain text) to one line of readable text. */
export function plainText(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?[-:| ]+\|?\s*$/gm, ' ')
    .replace(/[|*_`~]+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cut on a word boundary and add an ellipsis. Never longer than `max` characters. */
export function capLength(text: string, max = DESCRIPTION_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  const base = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '')
  return `${base}…`
}

/**
 * The first sentences of a page body that read as prose, skipping headings that repeat the
 * page title and very short fragments ("Home", "Menu").
 */
export function summarise(body: string, title?: string): string | null {
  const lines = body
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .split(/\n{1,}/)
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l))
    .map(plainText)
    .filter((l) => l.length >= 40 && l.toLowerCase() !== title?.toLowerCase())
  const text = lines.slice(0, 3).join(' ')
  return text ? capLength(text) : null
}

// ---------------------------------------------------------------- robots and sitemap

/** robots.txt for the CMS and bare root hosts: nothing there is for search engines. */
export const PLATFORM_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

export interface SitemapEntry {
  path: string
  lastModified?: string | null
}

const xmlEscape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function sitemapXml(origin: string, entries: SitemapEntry[]): string {
  const urls = entries.map((e) => {
    const lastmod = isoDate(e.lastModified)
    return `  <url><loc>${xmlEscape(canonicalUrl(origin, e.path))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------- schema.org

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b\s*$/i

/** "1 High Street, Anytown, AB1 2CD" -> PostalAddress. The postcode is split out. */
export function postalAddress(address: string): Record<string, string> {
  const flat = address
    .replace(/\s*\n\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .trim()
    .replace(/,$/, '')
  const m = UK_POSTCODE.exec(flat)
  const street = (m ? flat.slice(0, m.index) : flat).replace(/[\s,]+$/, '')
  return {
    '@type': 'PostalAddress',
    ...(street ? { streetAddress: street } : {}),
    ...(m?.[1] ? { postalCode: m[1].toUpperCase().replace(/\s*(\d[A-Z]{2})$/, ' $1') } : {}),
    addressCountry: 'GB',
  }
}

/** "8am", "6:30pm", "08:00", "12 noon", "midday" -> "HH:MM", or null. */
export function to24h(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\./g, ':')
  if (/^(12\s*)?(noon|midday)$/.test(t)) return '12:00'
  if (t === 'midnight') return '00:00'
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (!m[3] && !m[2]) return null // a bare "8" is ambiguous
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * One published hours row -> OpeningHoursSpecification entries. "Closed" days are left out
 * (schema.org reads a missing day as closed). Anything we cannot read exactly is skipped,
 * never guessed: the opening hours page still shows the tenant's own words.
 */
export function openingHoursSpecification(rows: HoursRow[]): Record<string, string>[] {
  const out: Record<string, string>[] = []
  for (const row of rows) {
    if (!WEEKDAYS.includes(row.day)) continue
    const ranges = row.times.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean)
    for (const range of ranges) {
      const m = /^(.+?)\s*(?:to|until|till|-|–|—)\s*(.+)$/i.exec(range.trim())
      if (!m?.[1] || !m[2]) continue
      const opens = to24h(m[1])
      const closes = to24h(m[2])
      if (!opens || !closes || opens >= closes) continue
      out.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${row.day}`,
        opens,
        closes,
      })
    }
  }
  return out
}

/** Home > page. The home page itself gets no breadcrumb. */
export function breadcrumbList(
  origin: string,
  trail: { name: string; path: string }[],
): Record<string, unknown> | null {
  if (trail.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: canonicalUrl(origin, t.path),
    })),
  }
}

/** Safe to inline in <script type="application/ld+json">: no "</script>" breakout. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
