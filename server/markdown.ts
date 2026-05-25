/**
 * Markdown parsing and code-block wrapping for Thalia.
 * Uses marked + marked-highlight (highlight.js); wraps code blocks in cards
 * and mermaid blocks in a Diagram/Source tabbed partial.
 */

import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

interface HandlebarsInstance {
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    emptyLangClass: 'hljs',
    highlight(code: string, lang: string) {
      if (lang === 'mermaid') return code
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)

/** Parse markdown string to HTML (syntax-highlighted code blocks). */
export function parseMarkdown(content: string): string {
  return marked.parse(content, { async: false }) as string
}


/**
 * Get the yaml front matter from a markdown file.
 */
export function parseFrontMatter(content: string): [string, Record<string, any> | null] {
  if (!content.startsWith('---')) return [content, null]
  const frontMatter = content.match(/^---([\s\S]*?)---(.*)/)?.[1]
  if (!frontMatter) return [content, null]
  // return [content, JSON.parse(frontMatter)]
  //yaml parse frontmatter
  return [content.replace(/^---([\s\S]*?)---(.*)/, ''), Bun.YAML.parse(frontMatter)]
}

/** Raw YAML between opening `---` fences (no fences), or null if absent. */
export function extractFrontMatterYaml(content: string): string | null {
  if (!content.startsWith('---')) return null
  const yaml = content.match(/^---([\s\S]*?)---/)?.[1]
  return yaml?.trim() ? yaml.trim() : null
}

export type MarkdownDocTabItem = {
  idSuffix: string
  label: string
  content: string
  active?: boolean
}

function markdownSourcePre(language: string, source: string): string {
  const lang = escapeHtml(language)
  return (
    '<div class="code-card" data-language="' +
    lang +
    '">' +
    '<div class="code-card__header"><span class="code-card__lang">' +
    lang +
    '</span></div>' +
    '<div class="code-card__body"><pre class="mb-0"><code class="hljs language-' +
    lang +
    '">' +
    escapeHtml(source) +
    '</code></pre></div></div>'
  )
}

/** Tab items for `markdown_wrapper` + `{{> tabs }}` (rendered HTML, optional YAML, raw fetch panel). */
export function buildMarkdownDocTabItems(
  renderedHtml: string,
  frontMatterYaml: string | null,
): MarkdownDocTabItem[] {
  const items: MarkdownDocTabItem[] = [
    {
      idSuffix: 'rendered',
      label: 'Page',
      active: true,
      content: '<div class="markdown-rendered">' + renderedHtml + '</div>',
    },
  ]
  if (frontMatterYaml) {
    items.push({
      idSuffix: 'front-matter',
      label: 'Front matter',
      content: markdownSourcePre('yaml', frontMatterYaml),
    })
  }
  items.push({
    idSuffix: 'raw',
    label: 'Raw',
    content:
      '<div class="markdown-raw-panel">' +
      '<p class="text-muted small mb-2">Source <code>.md</code> file. ' +
      '<a href="?raw=true">Open plain text</a> or view below.</p>' +
      '<pre class="mb-0"><code class="hljs language-markdown" id="markdown-raw-source">Loading…</code></pre>' +
      '</div>',
  })
  return items
}

/**
 * Wrap code blocks in cards. Mermaid blocks become {{> mermaidCard index=N }};
 * sources are pushed into mermaidSources for Handlebars to render raw via {{{ }}}.
 */
export function wrapMarkdownCodeBlocks(html: string, mermaidSources: string[]): string {
  let out = html.replace(
    /<pre><code class="[^"]*language-mermaid[^"]*">([\s\S]*?)<\/code><\/pre>/gi,
    (_, source: string) => {
      const i = mermaidSources.length
      mermaidSources.push(decodeHtml(source.trim()))
      return `{{> mermaidCard index=${i} }}`
    },
  )
  out = out.replace(
    /<pre><code class="hljs language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_, lang: string, inner: string) =>
      '<div class="code-card" data-language="' +
      escapeHtml(lang) +
      '">' +
      '<div class="code-card__header"><span class="code-card__lang">' +
      escapeHtml(lang) +
      '</span></div>' +
      '<div class="code-card__body"><pre><code class="hljs language-' +
      escapeHtml(lang) +
      '">' +
      inner +
      '</code></pre></div></div>',
  )
  out = out.replace(
    /<pre><code class="hljs">([\s\S]*?)<\/code><\/pre>/g,
    (_, inner: string) =>
      '<div class="code-card" data-language="">' +
      '<div class="code-card__header"><span class="code-card__lang">plaintext</span></div>' +
      '<div class="code-card__body"><pre><code class="hljs">' +
      inner +
      '</code></pre></div></div>',
  )
  return out
}

/** Register Handlebars helpers needed for markdown (e.g. mermaidCard partial). */
export function registerMarkdownHelpers(handlebars: HandlebarsInstance): void {
  handlebars.registerHelper('lookup', function (obj: unknown, key: unknown) {
    if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function')) return undefined
    const k = String(key)
    return Object.prototype.hasOwnProperty.call(obj, k) ? (obj as Record<string, unknown>)[k] : undefined
  } as (...args: unknown[]) => unknown)
}
