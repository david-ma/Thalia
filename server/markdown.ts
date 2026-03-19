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

function escapeHtml(s: string): string {
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
