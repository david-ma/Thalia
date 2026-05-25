/**
 * Markdown parsing, doc-page tabs, and HTML wrapping for Thalia.
 * Uses marked + marked-highlight (highlight.js); wraps code blocks in cards
 * and mermaid blocks in a Diagram/Source tabbed partial.
 */

import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import type { RequestInfo } from './server'
import type { WebsiteVersionInfo } from './website'

export interface MarkdownHandlebars {
  registerPartial(name: string, value: string): void
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void
  compile(template: string): (context: Record<string, unknown>) => string
  partials: Record<string, string | undefined>
}

export type MarkdownPageContext = {
  requestInfo: RequestInfo
  version: WebsiteVersionInfo
}

export type RenderMarkdownPageOptions = {
  /** Called in development before compiling the wrapper (reload partials). */
  reloadPartials?: () => void
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
export function parseFrontMatter(content: string): [string, Record<string, unknown> | null] {
  if (!content.startsWith('---')) return [content, null]
  const frontMatter = content.match(/^---([\s\S]*?)---(.*)/)?.[1]
  if (!frontMatter) return [content, null]
  // return [content, JSON.parse(frontMatter)]
  //yaml parse frontmatter
  return [content.replace(/^---([\s\S]*?)---(.*)/, ''), Bun.YAML.parse(frontMatter) as Record<string, unknown>]
}

/** Injected by wrapMarkdownCodeBlocks; must survive literal-{{ escaping below. */
const MERMAID_PARTIAL_RE = /\{\{>\s*mermaidCard\s+index=\d+\s*\}\}/g
const MERMAID_PLACEHOLDER_PREFIX = '\u0000THALIA_MERMAID_'
const MERMAID_PLACEHOLDER_SUFFIX = '\u0000'

function shieldMermaidPartials(html: string): { html: string; tokens: string[] } {
  const tokens: string[] = []
  const shielded = html.replace(MERMAID_PARTIAL_RE, (match) => {
    const i = tokens.length
    tokens.push(match)
    return `${MERMAID_PLACEHOLDER_PREFIX}${i}${MERMAID_PLACEHOLDER_SUFFIX}`
  })
  return { html: shielded, tokens }
}

function restoreMermaidPartials(html: string, tokens: string[]): string {
  return html.replace(
    new RegExp(`${MERMAID_PLACEHOLDER_PREFIX}(\\d+)${MERMAID_PLACEHOLDER_SUFFIX}`, 'g'),
    (_, index) => tokens[Number(index)] ?? '',
  )
}

/** Escape `{{` / `}}` so docs can show Handlebars examples without breaking compile. */
export function escapeHandlebarsLiterals(html: string): string {
  return html.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;')
}

/**
 * Prepare compiled-markdown HTML for Handlebars (mermaid partials only).
 * Literal `{{> my-panel}}` in code blocks is escaped; real mermaidCard calls are not.
 */
export function prepareMarkdownBodyForCompile(html: string): string {
  const { html: shielded, tokens } = shieldMermaidPartials(html)
  const escaped = escapeHandlebarsLiterals(shielded)
  return restoreMermaidPartials(escaped, tokens)
}

/** Raw YAML between opening `---` fences (no fences), or null if absent. */
export function extractFrontMatterYaml(content: string): string | null {
  if (!content.startsWith('---')) return null
  const yaml = content.match(/^---([\s\S]*?)---/)?.[1]
  return yaml?.trim() ? yaml.trim() : null
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
export function registerMarkdownHelpers(handlebars: MarkdownHandlebars): void {
  handlebars.registerHelper('lookup', function (obj: unknown, key: unknown) {
    if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function')) return undefined
    const k = String(key)
    return Object.prototype.hasOwnProperty.call(obj, k) ? (obj as Record<string, unknown>)[k] : undefined
  } as (...args: unknown[]) => unknown)
}

/** Tab descriptor for `tab-container` (data only — panels rendered via partials). */
export type TabItem = {
  idSuffix: string
  label: string
  active?: boolean
  /** Registered Handlebars partial name for panel body. */
  panelPartial?: string
  /** Trusted HTML when `panelPartial` is omitted. */
  content?: string
  paneClass?: string
}

/** Tab list for markdown doc pages (Page / Front matter / Raw). */
export function buildMarkdownDocTabs(hasFrontMatter: boolean): TabItem[] {
  const tabs: TabItem[] = [
    {
      idSuffix: 'rendered',
      label: 'Page',
      active: true,
      panelPartial: 'markdown-pane-page',
      paneClass: 'markdown-doc-pane',
    },
  ]
  if (hasFrontMatter) {
    tabs.push({
      idSuffix: 'front-matter',
      label: 'Front matter',
      panelPartial: 'markdown-pane-frontmatter',
      paneClass: 'markdown-doc-pane',
    })
  }
  tabs.push({
    idSuffix: 'raw',
    label: 'Raw',
    panelPartial: 'markdown-pane-raw',
    paneClass: 'markdown-doc-pane',
  })
  return tabs
}

function pageMetaFromFrontMatter(frontMatter: Record<string, unknown> | null): Record<string, string | undefined> {
  if (!frontMatter || typeof frontMatter !== 'object') return {}
  return {
    title: typeof frontMatter.title === 'string' ? frontMatter.title : undefined,
    description: typeof frontMatter.description === 'string' ? frontMatter.description : undefined,
    author: typeof frontMatter.author === 'string' ? frontMatter.author : undefined,
  }
}

/** Compile markdown body + `markdown` partial into a full HTML page. */
export function compileMarkdownPageHtml(
  handlebars: MarkdownHandlebars,
  contentHtml: string,
  mermaidSources: string[],
  frontMatter: Record<string, unknown> | null,
  frontMatterYaml: string | null,
  markdownSource: string,
  ctx: MarkdownPageContext,
  options?: RenderMarkdownPageOptions,
): string {
  options?.reloadPartials?.()
  handlebars.registerPartial('content', contentHtml)
  const compileCtx: Record<string, unknown> = {
    requestInfo: ctx.requestInfo,
    ...ctx.version,
    version: ctx.version,
    mermaidSources,
    frontMatter,
  }
  const renderedBody = handlebars.compile(prepareMarkdownBodyForCompile(contentHtml))(compileCtx)
  const markdownPartial = handlebars.partials['markdown'] ?? '{{> content }}'
  const pageCtx: Record<string, unknown> = {
    ...compileCtx,
    ...pageMetaFromFrontMatter(frontMatter),
    markdownBody: renderedBody,
    markdownRaw: markdownSource,
    markdownDocTabs: buildMarkdownDocTabs(!!frontMatterYaml),
    ...(frontMatterYaml ? { frontMatterYaml } : {}),
  }
  return handlebars.compile(markdownPartial)(pageCtx)
}

/**
 * Parse markdown source and return a full HTML page (`markdown` partial + doc tabs).
 */
export function renderMarkdownPage(
  handlebars: MarkdownHandlebars,
  markdownSource: string,
  ctx: MarkdownPageContext,
  options?: RenderMarkdownPageOptions,
): string {
  registerMarkdownHelpers(handlebars)
  const [body, frontMatter] = parseFrontMatter(markdownSource)
  const frontMatterYaml = extractFrontMatterYaml(markdownSource)
  const mermaidSources: string[] = []
  const contentHtml = wrapMarkdownCodeBlocks(parseMarkdown(body), mermaidSources)
  return compileMarkdownPageHtml(
    handlebars,
    contentHtml,
    mermaidSources,
    frontMatter,
    frontMatterYaml,
    markdownSource,
    ctx,
    options,
  )
}
