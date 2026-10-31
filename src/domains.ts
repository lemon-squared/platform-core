/**
 * Domain helpers with no dependencies, so browser code (the CMS "Download my website" button)
 * can import them through `@lemon-squared/platform/domains` without pulling in the rest of the package.
 * `./seo` re-exports these, so `@lemon-squared/platform` still has them too.
 */

/** Lower case, no trailing dot, no leading www. */
export function bareDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '')
}

/**
 * True for the platform's own preview domains (e.g. example.test and the local roots) and any subdomain of
 * them. Those addresses are for demos and previews only, never for a live tenant.
 */
export function isPlatformDomain(domain: string, platformDomains: readonly string[]): boolean {
  const d = bareDomain(domain)
  return platformDomains.some((root) => {
    const r = bareDomain(root)
    return Boolean(r) && (d === r || d.endsWith(`.${r}`))
  })
}

/** The tenant's own domains, normalised (lower case, no www), platform domains removed. */
export function customDomains(domains: readonly string[], platformDomains: readonly string[]) {
  const out: string[] = []
  for (const raw of domains) {
    const d = bareDomain(raw)
    if (d && !isPlatformDomain(d, platformDomains) && !out.includes(d)) out.push(d)
  }
  return out
}

/** The first custom domain: the one search engines and shared links use. */
export function primaryDomain(
  tenant: { domains: readonly string[] },
  platformDomains: readonly string[],
): string | null {
  return customDomains(tenant.domains, platformDomains)[0] ?? null
}

/** Hosts that only exist on a developer's machine: localhost, lvh.me and loopback addresses. */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'lvh.me' ||
    hostname.endsWith('.lvh.me') ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  )
}

export interface SiteLinkOptions {
  /** Root for <slug>.<root> addresses: the first ROOT_DOMAINS entry (or PUBLIC_ROOT_DOMAIN). */
  rootDomain: string
  /** Platform domains, so an example.test entry is never taken for the tenant's own domain. */
  platformDomains: readonly string[]
  /**
   * The Host header the CMS was opened on, e.g. "admin.localhost:3000". On a local host the
   * link stays local (http://<slug>.localhost:3000), whatever the root domain says.
   */
  requestHost?: string | null
}

/**
 * Where staff open a tenant's public website from the CMS, or null when there is nowhere yet
 * (no slug). A verified custom domain wins: https://<primary domain>. Otherwise the preview
 * address https://<slug>.<root>, which a live-ready tenant redirects to its own domain anyway.
 * In local development (the CMS on admin.localhost or admin.lvh.me) it is the matching local
 * address, with the same port: http://<slug>.localhost:3000.
 */
export function siteOrigin(
  tenant: {
    slug?: string | null
    domains?: readonly string[] | null
    domainVerifiedAt?: string | Date | null
  },
  options: SiteLinkOptions,
): string | null {
  const slug = (tenant.slug ?? '').trim().toLowerCase()
  const rawHost = (options.requestHost ?? '').trim().toLowerCase()
  const port = /^[^[]*:(\d+)$/.exec(rawHost)?.[1] ?? /^\[[^\]]+\]:(\d+)$/.exec(rawHost)?.[1]
  const hostname = rawHost.replace(/:\d+$/, '').replace(/\.$/, '')
  if (hostname && isLocalHostname(hostname)) {
    if (!slug) return null
    // admin.localhost -> localhost; a bare loopback address has no subdomains, so use localhost.
    const root =
      hostname === '127.0.0.1' || hostname === '[::1]'
        ? 'localhost'
        : hostname.replace(/^(admin|www)\./, '')
    return `http://${slug}.${root}${port ? `:${port}` : ''}`
  }
  const primary = primaryDomain({ domains: tenant.domains ?? [] }, options.platformDomains)
  if (primary && tenant.domainVerifiedAt) return `https://${primary}`
  const root = bareDomain(options.rootDomain)
  if (!slug || !root) return null
  return `https://${slug}.${root}`
}

/** A page's address on a site origin: "/bookings" -> "https://x.example/bookings". */
export function siteUrl(origin: string, path = '/'): string {
  const clean = `/${path.trim().replace(/^\/+/, '')}`
    .replace(/\/{2,}/g, '/')
    .replace(/(.)\/$/, '$1')
  return clean === '/' ? `${origin}/` : `${origin}${clean}`
}
