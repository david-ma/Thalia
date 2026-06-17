import { describe, test, expect } from 'bun:test'
import { buildTemplateErrorDetails, extractTemplateLine, snippetAtLine } from '../../server/template-errors.js'

describe('template-errors', () => {
  test('extractTemplateLine parses Handlebars parse errors', () => {
    expect(extractTemplateLine("Parse error on line 10:\n...")).toBe(10)
    expect(extractTemplateLine('Something on line 4 failed')).toBe(4)
    expect(extractTemplateLine('No line here')).toBeUndefined()
  })

  test('snippetAtLine returns the matching source line', () => {
    const source = 'line one\n  {{#if broken}}\nline three'
    expect(snippetAtLine(source, 2)).toBe('  {{#if broken}}')
  })

  test('buildTemplateErrorDetails adds hints and LLM context for unclosed blocks', () => {
    const source = '{{#if x}}\nhello\n'
    const error = new Error(
      "Parse error on line 3:\n...hello\n---------------------^\nExpecting 'OPEN_ENDBLOCK', got 'EOF'",
    )
    const details = buildTemplateErrorDetails(error, {
      website: 'thalia_ubc',
      template: 'catalogues',
      templatePath: 'src/catalogues.hbs',
      route: '/catalogues',
      source,
    })

    expect(details.line).toBe(3)
    expect(details.hints.some((hint) => hint.includes('closing tag'))).toBe(true)
    expect(details.llmContext).toContain('Website: thalia_ubc')
    expect(details.llmContext).toContain('Route: /catalogues')
    expect(details.llmContext).toContain('Template: catalogues')
    expect(details.llmContext).toContain('Hints:')
  })

  test('buildTemplateErrorDetails points at spaced block opens when error is at EOF', () => {
    const source = '{{# if "broken-if" }}\nhello\n</html>\n'
    const error = new Error("Parse error on line 3:\nExpecting 'OPEN_ENDBLOCK', got 'EOF'")
    const details = buildTemplateErrorDetails(error, {
      template: 'catalogues',
      templatePath: 'src/catalogues.hbs',
      source,
    })

    expect(details.hints.some((hint) => hint.includes('Line 1'))).toBe(true)
    expect(details.hints.some((hint) => hint.includes('broken-if'))).toBe(true)
  })
})
