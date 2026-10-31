import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// @lemon-squared/platform is shared by separate products, so it must stay product-neutral.
// Biome's noRestrictedImports blocks imports from product packages (@gp/*); this test also
// catches healthcare-product wording and fields in src/, and a dependency on a @gp/* package.

const SRC = join(import.meta.dir, '..', 'src')
const files = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

const FORBIDDEN_WORDS =
  /\b(nhs|gp|gps|practices?|patients?|surgery|surgeries|clinic(al)?|ods|cqc|pcn|ccg|icb|nhsuk|111|999)\b/i

describe('@lemon-squared/platform boundary', () => {
  test('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const text = readFileSync(join(SRC, file), 'utf8')

    test(`${file} imports no @gp/* package`, () => {
      expect(text).not.toMatch(/from\s+['"]@gp\//)
      expect(text).not.toMatch(/import\(\s*['"]@gp\//)
    })

    test(`${file} has no NHS or GP wording or fields`, () => {
      const hits = text
        .split('\n')
        .map((line, i) => ({ line: i + 1, text: line }))
        .filter((l) => FORBIDDEN_WORDS.test(l.text))
      expect(hits).toEqual([])
    })
  }

  test('package.json depends on no @gp/* package', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8'))
    const deps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    })
    expect(deps.filter((d) => d.startsWith('@gp/'))).toEqual([])
  })
})
