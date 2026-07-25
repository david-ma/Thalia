/**
 * Verifies `thalia/markdown` resolves via package.json exports (consumer sites).
 */

import { describe, expect, test } from 'bun:test'
import {
  renderMarkdownPage,
  parseFrontMatter,
  buildMarkdownDocTabs,
  compileMarkdownPageHtml,
} from 'thalia/markdown'

describe('thalia/markdown package export', () => {
  test('exports markdown page helpers', () => {
    expect(typeof renderMarkdownPage).toBe('function')
    expect(typeof parseFrontMatter).toBe('function')
    expect(typeof buildMarkdownDocTabs).toBe('function')
    expect(typeof compileMarkdownPageHtml).toBe('function')
  })
})
