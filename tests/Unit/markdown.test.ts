/**
 * Unit tests for server/markdown.ts
 *
 * Renders websites/example-src/src/markdown.md through the markdown pipeline
 * (parseMarkdown → wrapMarkdownCodeBlocks → Handlebars with mermaidCard partial)
 * and compares the result to a snapshot.
 *
 * Run from Thalia root: bun test tests/Unit/markdown.test.ts
 * Update snapshot: bun test tests/Unit/markdown.test.ts --update-snapshots
 */

import { describe, test, expect } from 'bun:test'
import path from 'path'
import fs from 'fs'
import Handlebars from 'handlebars'
import {
  parseMarkdown,
  wrapMarkdownCodeBlocks,
  registerMarkdownHelpers,
  extractFrontMatterYaml,
  buildMarkdownDocTabs,
  compileMarkdownPageHtml,
  prepareMarkdownBodyForCompile,
  type MarkdownPageContext,
} from '../../server/markdown.js'

const THALIA_ROOT = path.join(import.meta.dir, '..', '..')
const EXAMPLE_SRC = path.join(THALIA_ROOT, 'websites', 'example-src')
const MARKDOWN_PATH = path.join(EXAMPLE_SRC, 'src', 'markdown.md')
const MERMAID_CARD_PARTIAL_PATH = path.join(THALIA_ROOT, 'src', 'views', 'partials', 'mermaidCard.hbs')
const PARTIALS_DIR = path.join(THALIA_ROOT, 'src', 'views', 'partials')

function registerPartialsFromDir(handlebars: typeof Handlebars, folder: string): void {
  if (!fs.existsSync(folder)) return
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      registerPartialsFromDir(handlebars, fullPath)
    } else if (/\.hbs$/.test(entry.name)) {
      const name = entry.name.replace(/\.hbs$/, '')
      handlebars.registerPartial(name, fs.readFileSync(fullPath, 'utf8'))
    }
  }
}

describe('markdown pipeline', () => {
  test('parseMarkdown + wrapMarkdownCodeBlocks + Handlebars renders example-src markdown.md to stable HTML', () => {
    const content = fs.readFileSync(MARKDOWN_PATH, 'utf8')
    const html = parseMarkdown(content)
    const mermaidSources: string[] = []
    const wrapped = wrapMarkdownCodeBlocks(html, mermaidSources)

    const handlebars = Handlebars.create()
    registerMarkdownHelpers(handlebars)
    const mermaidCardPartial = fs.readFileSync(MERMAID_CARD_PARTIAL_PATH, 'utf8')
    handlebars.registerPartial('mermaidCard', mermaidCardPartial)

    const template = handlebars.compile(wrapped)
    const rendered = template({ mermaidSources })

    expect(rendered).toMatchSnapshot()
  })

  test('extractFrontMatterYaml returns inner YAML without fences', () => {
    const md = '---\ntitle: Docs\n---\n\n# Hello\n'
    expect(extractFrontMatterYaml(md)).toBe('title: Docs')
  })

  test('buildMarkdownDocTabs returns panel partial names without front matter', () => {
    const tabs = buildMarkdownDocTabs(false)
    expect(tabs.map((t) => t.idSuffix)).toEqual(['rendered', 'raw'])
    expect(tabs[0].panelPartial).toBe('markdown-pane-page')
    expect(tabs[0].active).toBe(true)
  })

  test('prepareMarkdownBodyForCompile escapes literal handlebars in code but keeps mermaid partials', () => {
    const mermaidSources: string[] = []
    const wrapped = wrapMarkdownCodeBlocks(
      parseMarkdown('```handlebars\n{{> my-panel}}\n```\n\n```mermaid\ngraph TD\n  A-->B\n```'),
      mermaidSources,
    )
    const prepared = prepareMarkdownBodyForCompile(wrapped)
    expect(prepared).toContain('&#123;&#123;')
    expect(prepared).toContain('{{> mermaidCard index=0 }}')
    expect(prepared).not.toMatch(/\{\{>\s*my-panel/)

    const handlebars = Handlebars.create()
    registerMarkdownHelpers(handlebars)
    handlebars.registerPartial('mermaidCard', fs.readFileSync(MERMAID_CARD_PARTIAL_PATH, 'utf8'))
    expect(() => handlebars.compile(prepared)({ mermaidSources })).not.toThrow()
  })

  test('buildMarkdownDocTabs includes front matter and body tabs when requested', () => {
    const tabs = buildMarkdownDocTabs(true)
    expect(tabs.map((t) => t.idSuffix)).toEqual(['rendered', 'front-matter', 'body', 'raw'])
    expect(tabs[1].panelPartial).toBe('markdown-pane-frontmatter')
    expect(tabs[2].panelPartial).toBe('markdown-pane-body')
  })

  test('compileMarkdownPageHtml renders tab-container and pane partials', () => {
    const handlebars = Handlebars.create()
    registerMarkdownHelpers(handlebars)
    registerPartialsFromDir(handlebars, PARTIALS_DIR)
    handlebars.registerPartial('wrapper', '{{> @partial-block }}')

    const ctx = {
      requestInfo: { pathname: '/doc.md' },
      version: { websiteName: 'test', version: '0' },
    } as MarkdownPageContext

    const withoutFm = compileMarkdownPageHtml(
      handlebars,
      '<p>Hi</p>',
      [],
      null,
      null,
      '# Hi\n',
      '# Hi\n',
      ctx,
    )
    expect(withoutFm).toContain('id="mdtab-rendered"')
    expect(withoutFm).toContain('<p>Hi</p>')
    expect(withoutFm).not.toContain('id="mdtab-front-matter-tab"')

    const withFm = compileMarkdownPageHtml(
      handlebars,
      '<p>Hi</p>',
      [],
      { title: 'Docs' },
      'title: Docs',
      '---\ntitle: Docs\n---\n\n# Hi\n',
      '\n# Hi\n',
      ctx,
    )
    expect(withFm).toContain('id="mdtab-front-matter-tab"')
    expect(withFm).toContain('id="mdtab-body-tab"')
    expect(withFm).toContain('title: Docs')
    expect(withFm).toContain('id="markdown-body-source"')
    expect(withFm).toContain('id="markdown-raw-source"')
    expect(withFm).toContain('# Hi')
  })
})
