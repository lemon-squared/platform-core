/** Markdown and path helpers shared by every site: no renderer, no styling. */

export function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

const PIPE_ROW = /^\s*\|.*\|\s*$/
const SEPARATOR = /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/
/** Copied tables often lack the GFM header separator, and closed days come out as "12am to". */
export function fixPipeTables(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (!PIPE_ROW.test(line)) {
      out.push(line)
      continue
    }
    const start = !PIPE_ROW.test(lines[i - 1] ?? '')
    if (/\|\s*\d{1,2}(?::\d\d)?\s*[ap]m\s+to\s*\|/i.test(line) && !start) continue
    out.push(line)
    if (start && !SEPARATOR.test(lines[i + 1] ?? '') && PIPE_ROW.test(lines[i + 1] ?? '')) {
      const cells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|').length
      out.push(`|${' --- |'.repeat(cells)}`)
    }
  }
  return out.join('\n')
}

/** A site path under a language prefix: ("/cy", "/") -> "/cy", ("/cy", "/team") -> "/cy/team". */
export function prefixPath(prefix: string | undefined, path: string): string {
  if (!prefix) return path
  return path === '/' ? prefix : `${prefix}${path}`
}

export function normalisePath(p: string): string {
  let path = p.split(/[?#]/)[0] ?? '/'
  if (!path.startsWith('/')) path = `/${path}`
  try {
    path = decodeURI(path)
  } catch {
    // keep as-is when the old site had a malformed escape
  }
  // Old sites have paths like "/About us/" or "/news&events": make each segment URL-safe.
  path = path
    .toLowerCase()
    .split('/')
    .map((seg) =>
      seg
        .replace(/[^a-z0-9\-_.]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter((seg, i) => i === 0 || seg !== '')
    .join('/')
  return path === '' ? '/' : path
}

/**
 * Copied pages jump heading levels (an h4 straight under the page title). Close the gaps so each
 * heading is at most one level below the one before it, starting under the page's h1.
 */
export function closeHeadingGaps(html: string): string {
  // Open headings as [level in the copy, level shown]; siblings keep the same level.
  const open: [number, number][] = []
  return html.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (_m, n: string, attrs: string, inner: string) => {
      const orig = Number(n)
      while (open.length && (open.at(-1) as [number, number])[0] >= orig) open.pop()
      const level = Math.min(6, open.length ? (open.at(-1) as [number, number])[1] + 1 : 2)
      open.push([orig, level])
      return `<h${level}${attrs}>${inner}</h${level}>`
    },
  )
}
