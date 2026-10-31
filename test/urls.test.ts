/** Canonical URLs, live-domain rules, host resolution and paths. */
import { describe, expect, test } from 'bun:test'
import {
  canonicalRedirect,
  canonicalUrl,
  customDomains,
  isLiveReady,
  isPlatformDomain,
  liveIssue,
  pageUrls,
  primaryDomain,
  publicOrigin,
  resolveHost,
} from '../src'

const ROOT = 'example.test'
const PLATFORM = ['example.test', 'localhost', 'lvh.me']
const hostCfg = {
  rootDomains: ['example.test', 'localhost', 'lvh.me'],
  adminHosts: ['admin.example.test', 'admin.localhost'],
}

describe('canonical URLs', () => {
  test('the first custom domain wins; demos fall back to the preview subdomain', () => {
    const demo = { slug: 'acme', status: 'demo' as const }
    expect(publicOrigin({ ...demo, domains: [] }, PLATFORM, ROOT)).toBe('https://acme.example.test')
    expect(
      publicOrigin({ ...demo, domains: ['WWW.Acme.example', 'old.example'] }, PLATFORM, ROOT),
    ).toBe('https://acme.example')
    expect(publicOrigin({ ...demo, domains: ['  ', 'b.example'] }, PLATFORM, ROOT)).toBe(
      'https://b.example',
    )
  })

  test('a live tenant never gets a example.test URL', () => {
    const live = { slug: 'acme', status: 'live' as const }
    expect(publicOrigin({ ...live, domains: [] }, PLATFORM, ROOT)).toBeNull()
    expect(publicOrigin({ ...live, domains: ['acme.example.test'] }, PLATFORM, ROOT)).toBeNull()
    expect(
      publicOrigin({ ...live, domains: ['x.example.test', 'acme.example'] }, PLATFORM, ROOT),
    ).toBe('https://acme.example')
  })

  test('trailing slashes, query strings, fragments and case never change the canonical', () => {
    const o = 'https://acme.example'
    for (const p of ['/About/', '/about?utm_source=x', '/about#team', '//about//', 'about']) {
      expect(canonicalUrl(o, p)).toBe('https://acme.example/about')
    }
    expect(canonicalUrl(o, '/')).toBe('https://acme.example/')
    expect(canonicalUrl(o, '/?q=1')).toBe('https://acme.example/')
  })

  test('the internal /site/<host> route never appears', () => {
    const url = canonicalUrl(`https://a.${ROOT}`, '/contact')
    expect(url).not.toContain('/site/')
  })

  test('language alternates slot in for hreflang', () => {
    expect(pageUrls('https://a.example', '/about/')).toEqual({
      canonical: 'https://a.example/about',
    })
    expect(
      pageUrls('https://a.example', '/about', {
        languages: { 'en-GB': '/about', cy: '/cy/about/', 'x-default': '/about' },
      }).languages,
    ).toEqual({
      'en-GB': 'https://a.example/about',
      cy: 'https://a.example/cy/about',
      'x-default': 'https://a.example/about',
    })
  })
})

describe('live tenants and platform domains', () => {
  test('platform domains are the roots and every subdomain of them', () => {
    expect(isPlatformDomain('example.test', PLATFORM)).toBe(true)
    expect(isPlatformDomain('WWW.Acme.Example.test.', PLATFORM)).toBe(true)
    expect(isPlatformDomain('a.b.lvh.me', PLATFORM)).toBe(true)
    expect(isPlatformDomain('notexample.test', PLATFORM)).toBe(false)
    expect(isPlatformDomain('acme.example', PLATFORM)).toBe(false)
    expect(
      customDomains(['x.example.test', 'WWW.A.example', 'a.example', 'b.example'], PLATFORM),
    ).toEqual(['a.example', 'b.example'])
    expect(primaryDomain({ domains: ['x.example.test'] }, PLATFORM)).toBeNull()
  })

  test('going live needs a custom domain, then verification', () => {
    expect(liveIssue({ domains: [] }, PLATFORM)).toBe('no-custom-domain')
    expect(
      liveIssue({ domains: ['a.example.test'], domainVerifiedAt: '2026-10-01' }, PLATFORM),
    ).toBe('no-custom-domain')
    expect(liveIssue({ domains: ['a.example'] }, PLATFORM)).toBe('domain-not-verified')
    expect(
      liveIssue({ domains: ['a.example'], domainVerifiedAt: '2026-10-01' }, PLATFORM),
    ).toBeNull()
    expect(
      isLiveReady({ status: 'demo', domains: ['a.example'], domainVerifiedAt: 'x' }, PLATFORM),
    ).toBe(false)
  })

  const ready = {
    status: 'live' as const,
    domains: ['acme.example', 'acme-hire.example'],
    domainVerifiedAt: '2026-10-01T09:00:00.000Z',
  }

  test('the preview subdomain of a live tenant redirects to its primary domain, path kept', () => {
    expect(canonicalRedirect(ready, { slug: 'acme' }, PLATFORM, '/Contact/')).toBe(
      'https://acme.example/contact',
    )
    expect(canonicalRedirect(ready, { slug: 'acme' }, PLATFORM, '/')).toBe('https://acme.example/')
    // Secondary domains go to the primary too; the primary itself is served.
    expect(canonicalRedirect(ready, { domain: 'acme-hire.example' }, PLATFORM, '/a')).toBe(
      'https://acme.example/a',
    )
    expect(canonicalRedirect(ready, { domain: 'acme.example' }, PLATFORM, '/a')).toBeNull()
  })

  test('the query string is dropped unless it is needed', () => {
    const q = { q: 'red castle', utm_source: 'x' }
    expect(canonicalRedirect(ready, { slug: 'acme' }, PLATFORM, '/about', q)).toBe(
      'https://acme.example/about',
    )
    expect(canonicalRedirect(ready, { slug: 'acme' }, PLATFORM, '/search', q, ['q'])).toBe(
      'https://acme.example/search?q=red+castle',
    )
  })

  test('demos, and live tenants that are not ready, stay where they are', () => {
    expect(
      canonicalRedirect({ ...ready, status: 'demo' }, { slug: 'acme' }, PLATFORM, '/'),
    ).toBeNull()
    expect(
      canonicalRedirect({ ...ready, domainVerifiedAt: null }, { slug: 'acme' }, PLATFORM, '/'),
    ).toBeNull()
    expect(canonicalRedirect({ ...ready, domains: [] }, { slug: 'acme' }, PLATFORM, '/')).toBeNull()
  })
})
describe('resolveHost', () => {
  test('tenant subdomains on every root domain', () => {
    expect(resolveHost('acme.example.test', hostCfg)).toEqual({
      kind: 'tenant-slug',
      slug: 'acme',
    })
    expect(resolveHost('Acme.localhost:3000', hostCfg)).toEqual({
      kind: 'tenant-slug',
      slug: 'acme',
    })
    expect(resolveHost('initech.lvh.me:3000', hostCfg)).toEqual({
      kind: 'tenant-slug',
      slug: 'initech',
    })
  })
  test('admin and root hosts', () => {
    expect(resolveHost('admin.example.test', hostCfg)).toEqual({ kind: 'admin' })
    expect(resolveHost('example.test', hostCfg)).toEqual({ kind: 'root' })
    expect(resolveHost('www.example.test', hostCfg)).toEqual({ kind: 'root' })
    expect(resolveHost('a.b.example.test', hostCfg)).toEqual({ kind: 'root' })
  })
  test('anything else is a custom domain, www stripped', () => {
    expect(resolveHost('www.acme-hire.example', hostCfg)).toEqual({
      kind: 'custom-domain',
      domain: 'acme-hire.example',
    })
  })
})

describe('normalisePath', () => {
  test('makes old-site paths with spaces and symbols URL-safe', async () => {
    const { normalisePath } = await import('../src')
    expect(normalisePath('/company-info/About us/')).toBe('/company-info/about-us')
    expect(normalisePath('/News%20&%20Events?x=1')).toBe('/news-events')
    expect(normalisePath('/')).toBe('/')
  })
})
