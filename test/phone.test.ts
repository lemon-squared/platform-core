import { describe, expect, test } from 'bun:test'
import { displayPhone, formatUkNumber, normalisePhone, telHref } from '../src'

describe('UK phone groupings', () => {
  const cases: [string, string][] = [
    // two-digit area codes
    ['02079460000', '020 7946 0000'],
    ['02380123456', '023 8012 3456'],
    ['02476123456', '024 7612 3456'],
    ['02890123456', '028 9012 3456'],
    ['02920123456', '029 2012 3456'],
    // 011x and 01x1
    ['01132460000', '0113 246 0000'],
    ['01142460000', '0114 246 0000'],
    ['01159460000', '0115 946 0000'],
    ['01162460000', '0116 246 0000'],
    ['01179460000', '0117 946 0000'],
    ['01189460000', '0118 946 0000'],
    ['01214960123', '0121 496 0123'],
    ['01314960000', '0131 496 0000'],
    ['01414960000', '0141 496 0000'],
    ['01514960000', '0151 496 0000'],
    ['01614960000', '0161 496 0000'],
    ['01914960000', '0191 496 0000'],
    // five- and six-digit area codes
    ['01632960143', '01632 960143'],
    ['01632960880', '01632 960880'],
    ['01387612345', '01387 612345'],
    ['01387312345', '013873 12345'],
    ['01697712345', '016977 12345'],
    // mobiles and non-geographic
    ['07700900123', '07700 900123'],
    ['03001234567', '0300 123 4567'],
    ['08001234567', '0800 123 4567'],
    ['08451234567', '0845 123 4567'],
    // ten-digit numbers
    ['0800123456', '0800 123456'],
    ['0169772345', '016977 2345'],
  ]
  for (const [digits, shown] of cases) {
    test(`${digits} → ${shown}`, () => expect(formatUkNumber(digits)).toBe(shown))
  }

  test('not a UK national number', () => {
    expect(formatUkNumber('12345678901')).toBeNull()
    expect(formatUkNumber('0121496')).toBeNull()
  })
})

describe('displayPhone', () => {
  test('regroups numbers stored with the wrong spacing', () => {
    expect(displayPhone('01214 960123')).toBe('0121 496 0123')
    expect(displayPhone('01614 960000')).toBe('0161 496 0000')
    expect(displayPhone('02079 460000')).toBe('020 7946 0000')
    expect(displayPhone('0163 2960 143')).toBe('01632 960143')
    expect(displayPhone('077009 00123')).toBe('07700 900123')
  })

  test('leaves correct numbers alone', () => {
    for (const p of ['0121 496 0123', '01632 960143', '0300 123 4567', '020 7946 0000']) {
      expect(displayPhone(p)).toBe(p)
    }
  })

  test('+44 forms', () => {
    expect(displayPhone('+44 121 496 0123')).toBe('0121 496 0123')
    expect(displayPhone('+44 (0)161 496 0000')).toBe('0161 496 0000')
  })

  test('anything that is not a plain number is shown as stored', () => {
    expect(displayPhone('01632 960143 ext 2')).toBe('01632 960143 ext 2')
    expect(displayPhone('Call reception')).toBe('Call reception')
    expect(displayPhone('123')).toBe('123')
  })
})

describe('normalisePhone uses the same groupings', () => {
  test('imports', () => {
    expect(normalisePhone('0121 4960123')).toBe('0121 496 0123')
    expect(normalisePhone('(0161) 4960000')).toBe('0161 496 0000')
    expect(normalisePhone('+44 20 7946 0000')).toBe('020 7946 0000')
  })
})

describe('telHref', () => {
  test('digits only', () => {
    expect(telHref('0121 496 0123')).toBe('tel:01214960123')
    expect(telHref('01214 960123')).toBe('tel:01214960123')
    expect(telHref('(0161) 496-0000')).toBe('tel:01614960000')
    expect(telHref('+44 121 496 0123')).toBe('tel:+441214960123')
  })
})
