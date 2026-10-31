/** "View site" links in the CMS: where a tenant's public website is opened from. */
import { describe, expect, test } from 'bun:test'
import { siteOrigin, siteUrl } from '../src/domains'

const PROD = {
  rootDomain: 'sites.example.test',
  platformDomains: ['sites.example.test', 'example.test'],
  requestHost: 'admin.example.test',
}

describe('siteOrigin', () => {
  test('a demo without a custom domain uses <slug>.<first root domain>', () => {
    expect(siteOrigin({ slug: 'globex', domains: [] }, PROD)).toBe(
      'https://globex.sites.example.test',
    )
  })

  test('a verified custom domain wins', () => {
    expect(
      siteOrigin(
        {
          slug: 'acme',
          domains: ['www.AcmeParties.example'],
          domainVerifiedAt: '2026-10-01T09:00:00.000Z',
        },
        PROD,
      ),
    ).toBe('https://acmeparties.example')
  })

  test('an unverified custom domain is not linked: the preview address is', () => {
    expect(
      siteOrigin({ slug: 'acme', domains: ['acmeparties.example'], domainVerifiedAt: null }, PROD),
    ).toBe('https://acme.sites.example.test')
  })

  test('platform domains in the list are never taken for the tenant domain', () => {
    expect(
      siteOrigin(
        {
          slug: 'acme',
          domains: ['acme.sites.example.test'],
          domainVerifiedAt: new Date(),
        },
        PROD,
      ),
    ).toBe('https://acme.sites.example.test')
  })

  test('no slug and no verified domain: no link', () => {
    expect(siteOrigin({ slug: '', domains: [] }, PROD)).toBeNull()
    expect(siteOrigin({}, PROD)).toBeNull()
  })

  test('local development keeps the admin host scheme and port', () => {
    const local = { ...PROD, requestHost: 'admin.localhost:3141' }
    expect(siteOrigin({ slug: 'acme', domains: [] }, local)).toBe('http://acme.localhost:3141')
    // Even with a verified custom domain: locally the link opens the local copy.
    expect(
      siteOrigin(
        { slug: 'acme', domains: ['acmeparties.example'], domainVerifiedAt: '2026-10-01' },
        local,
      ),
    ).toBe('http://acme.localhost:3141')
    expect(siteOrigin({ slug: 'acme' }, { ...PROD, requestHost: 'admin.lvh.me:3000' })).toBe(
      'http://acme.lvh.me:3000',
    )
    expect(siteOrigin({ slug: 'acme' }, { ...PROD, requestHost: 'localhost:3000' })).toBe(
      'http://acme.localhost:3000',
    )
    expect(siteOrigin({ slug: 'acme' }, { ...PROD, requestHost: '127.0.0.1:3000' })).toBe(
      'http://acme.localhost:3000',
    )
  })

  test('no request host (scripts, tests) falls back to the root domain', () => {
    expect(siteOrigin({ slug: 'initech' }, { ...PROD, requestHost: undefined })).toBe(
      'https://initech.sites.example.test',
    )
  })

  test('the slug is normalised', () => {
    expect(siteOrigin({ slug: ' Acme ' }, PROD)).toBe('https://acme.sites.example.test')
  })
})

describe('siteUrl', () => {
  const origin = 'https://acme.sites.example.test'
  test('home page keeps one trailing slash', () => {
    expect(siteUrl(origin)).toBe(`${origin}/`)
    expect(siteUrl(origin, '/')).toBe(`${origin}/`)
  })
  test('page paths are joined cleanly', () => {
    expect(siteUrl(origin, '/bookings')).toBe(`${origin}/bookings`)
    expect(siteUrl(origin, 'bookings/')).toBe(`${origin}/bookings`)
    expect(siteUrl(origin, '//services//hire')).toBe(`${origin}/services/hire`)
  })
})
