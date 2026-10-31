/** UK phone numbers: validation, Ofcom groupings for display, and tel: links. */

const UK_PHONE = /^(?:\+44\s?|0)\d[\d\s]{8,12}$/

export function normalisePhone(raw: string): string | null {
  const s = raw
    .replace(/[^\d+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!UK_PHONE.test(s)) return null
  return formatUkNumber(ukDigits(s)) ?? s
}

/** National digits ("+44 (0)121…" and "0121…" both give "0121…"). */
function ukDigits(s: string): string {
  const d = s.replace(/\D/g, '')
  if (s.trim().startsWith('+44')) return `0${d.slice(2).replace(/^0/, '')}`
  return d
}

/** The few areas with a six-digit code (Ofcom "mixed" areas), written 0xxxxx xxxxx. */
const SIX_DIGIT_CODES = new Set([
  '013873',
  '015242',
  '015394',
  '015395',
  '015396',
  '016973',
  '016974',
  '016977',
  '017683',
  '017684',
  '017687',
  '019467',
])

/**
 * Ofcom's written groupings for a UK national number, or null when the digits are not one:
 * 020 7946 0000, 0121 496 0123, 01632 960143, 013873 12345, 07700 900123, 0300 123 4567.
 */
export function formatUkNumber(digits: string): string | null {
  const g = (...sizes: number[]) => {
    const parts: string[] = []
    let i = 0
    for (const n of sizes) {
      parts.push(digits.slice(i, i + n))
      i += n
    }
    return parts.join(' ')
  }
  if (!/^0[1-9]\d+$/.test(digits)) return null
  if (digits.length === 11) {
    if (/^02/.test(digits)) return g(3, 4, 4)
    // 0113–0118 and 0121, 0131, 0141, 0151, 0161, 0191
    if (/^01(1\d|\d1)/.test(digits)) return g(4, 3, 4)
    if (SIX_DIGIT_CODES.has(digits.slice(0, 6))) return g(6, 5)
    if (/^0[17]/.test(digits)) return g(5, 6)
    if (/^05/.test(digits)) return g(3, 4, 4)
    return g(4, 3, 4) // 03, 08, 09
  }
  if (digits.length === 10) {
    if (/^0(800|500)/.test(digits)) return g(4, 6) // 0800 123456
    if (SIX_DIGIT_CODES.has(digits.slice(0, 6))) return g(6, 4)
    if (/^01/.test(digits)) return g(5, 5) // 01xxx 5-digit local numbers
  }
  return null
}

/**
 * A stored phone number as it should be shown. Numbers saved with the wrong grouping (for
 * example "01214 960123") are regrouped; anything that is not a plain UK number, such as one
 * with an extension or words, is shown exactly as stored.
 */
export function displayPhone(phone: string): string {
  const s = phone.trim()
  if (!/^\+?[\d\s().-]+$/.test(s)) return phone
  return formatUkNumber(ukDigits(s)) ?? phone
}

/** A UK number written in running text: 0… or +44…, digits with optional single spaces. */
const PHONE_IN_TEXT = /(?<![\d+])(?:\+44[ \t]?(?:\(0\)[ \t]?)?|0)\d(?:[ \t]?\d){8,9}(?!\d)/g

/**
 * Regroup UK numbers in copied text the way displayPhone does, so "02079 460123"
 * reads "020 7946 0123". Anything that is not a valid UK national number is left as written.
 */
export function regroupPhonesInText(text: string): string {
  return text.replace(PHONE_IN_TEXT, (m) => {
    const digits = ukDigits(m)
    if (digits.length < 10 || digits.length > 11) return m
    const out = formatUkNumber(digits)
    if (!out) return m
    return m.startsWith('+') ? m : out
  })
}

/** The tel: link for a number: digits only, keeping a leading + for international numbers. */
export function telHref(phone: string): string {
  const plus = phone.trim().startsWith('+') ? '+' : ''
  return `tel:${plus}${phone.replace(/\D/g, '')}`
}
