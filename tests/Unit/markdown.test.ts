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
import { parseMarkdown, wrapMarkdownCodeBlocks, registerMarkdownHelpers } from '../../server/markdown.js'

const THALIA_ROOT = path.join(import.meta.dir, '..', '..')
const EXAMPLE_SRC = path.join(THALIA_ROOT, 'websites', 'example-src')
const MARKDOWN_PATH = path.join(EXAMPLE_SRC, 'src', 'markdown.md')
const MERMAID_CARD_PARTIAL_PATH = path.join(THALIA_ROOT, 'src', 'views', 'partials', 'mermaidCard.hbs')

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
})
