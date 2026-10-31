export type HostResolution =
  | { kind: 'admin' }
  | { kind: 'status' }
  | { kind: 'tenant-slug'; slug: string }
  | { kind: 'custom-domain'; domain: string }
  | { kind: 'root' }

export interface HostConfig {
  /** Base domains whose first label is a tenant slug, e.g. ["example.test", "localhost", "lvh.me"]. */
  rootDomains: string[]
  /** Hosts that serve the CMS and nothing else, e.g. ["admin.example.test", "localhost"]. */
  adminHosts: string[]
  /** Hosts that serve the public status page, e.g. ["status.example.test"]. */
  statusHosts?: string[]
}

export function normaliseHost(host: string | null | undefined): string {
  if (!host) return ''
  let h = host.trim().toLowerCase()
  // Strip port (IPv6 literals are not tenant hosts, keep as is).
  if (!h.startsWith('[')) h = h.replace(/:\d+$/, '')
  h = h.replace(/\.$/, '')
  if (h.startsWith('www.')) h = h.slice(4)
  return h
}

export function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback
  return value
    .split(',')
    .map((s) => normaliseHost(s))
    .filter(Boolean)
}

/** Decide what a request Host header is for. Pure: no DB access. */
export function resolveHost(rawHost: string | null | undefined, cfg: HostConfig): HostResolution {
  const host = normaliseHost(rawHost)
  if (!host) return { kind: 'root' }
  if (cfg.adminHosts.includes(host)) return { kind: 'admin' }
  if (cfg.statusHosts?.includes(host)) return { kind: 'status' }
  for (const root of cfg.rootDomains) {
    if (host === root) return { kind: 'root' }
    if (host.endsWith(`.${root}`)) {
      const label = host.slice(0, -(root.length + 1))
      // Only single-label subdomains are tenants: acme.example.test, not a.b.example.test
      if (label && !label.includes('.')) return { kind: 'tenant-slug', slug: label }
      return { kind: 'root' }
    }
  }
  return { kind: 'custom-domain', domain: host }
}
