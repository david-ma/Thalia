/**
 * Helpers for turning Handlebars failures into actionable developer messages.
 */

export type TemplateErrorContext = {
  website?: string
  template?: string
  templatePath?: string
  route?: string
  source?: string
}

export type TemplateErrorDetails = {
  message: string
  line?: number
  snippet?: string
  hints: string[]
  llmContext: string
}

const PARSE_LINE_RE = /Parse error on line (\d+)/i
const LINE_MARKER_RE = /on line (\d+)/i

export function extractTemplateLine(message: string): number | undefined {
  const match = message.match(PARSE_LINE_RE) ?? message.match(LINE_MARKER_RE)
  if (!match) return undefined
  const line = Number.parseInt(match[1], 10)
  return Number.isFinite(line) ? line : undefined
}

export function snippetAtLine(source: string | undefined, line: number): string | undefined {
  if (!source) return undefined
  const lines = source.split(/\r?\n/)
  const index = line - 1
  if (index < 0 || index >= lines.length) return undefined
  return lines[index].trimEnd()
}

function findSpacedBlockLines(source: string | undefined): { line: number; text: string }[] {
  if (!source) return []
  return source
    .split(/\r?\n/)
    .map((text, index) => ({ line: index + 1, text: text.trimEnd() }))
    .filter(({ text }) => /\{\{#\s/.test(text))
}

function collectHints(message: string, source: string | undefined, line?: number): string[] {
  const hints: string[] = []
  const lower = message.toLowerCase()
  const snippet = line ? snippetAtLine(source, line) : undefined

  if (lower.includes('open_endblock') && lower.includes('eof')) {
    hints.push(
      'A block was opened but never closed. Add the matching closing tag: {{/if}}, {{/each}}, {{/with}}, or {{/unless}}.',
    )
  }

  if (lower.includes('open_inverse_chain') || lower.includes("'inverse'")) {
    hints.push('An {{#if}} (or similar) block is missing {{else}} or {{/if}} before the template ends.')
  }

  if (snippet && /\{\{#\s/.test(snippet)) {
    hints.push('Block helpers are usually written without a space after #: {{#if}}, {{#each}}, not {{# if}}.')
  }

  for (const block of findSpacedBlockLines(source)) {
    hints.push(
      `Line ${block.line} opens a block with a space after #: \`${block.text.trim()}\` — use {{#if}}/{{#each}} and add the matching {{/…}}.`,
    )
  }

  if (lower.includes('partial') && lower.includes('not found')) {
    hints.push('A {{> partial}} reference does not match any loaded partial. Check the name and that the .hbs file exists under src/.')
  }

  if (lower.includes('each') && lower.includes("requires an 'iterator'")) {
    hints.push('{{#each}} needs an array or object in the template data. Check the controller passes the variable you iterate over.')
  }

  if (hints.length === 0) {
    hints.push('Fix the template syntax error shown above, save the file, and reload the page.')
  }

  return [...new Set(hints)]
}

export function buildTemplateErrorDetails(error: Error, context: TemplateErrorContext = {}): TemplateErrorDetails {
  const message = error.message || String(error)
  const line = extractTemplateLine(message)
  const snippet = line ? snippetAtLine(context.source, line) : undefined
  const hints = collectHints(message, context.source, line)

  const templateLabel = context.templatePath ?? (context.template ? `src/${context.template}.hbs` : undefined)

  const lines = [
    'Thalia Handlebars template error',
    '',
    context.website ? `Website: ${context.website}` : undefined,
    context.route ? `Route: ${context.route}` : undefined,
    context.template ? `Template: ${context.template}` : undefined,
    templateLabel ? `File (likely): ${templateLabel}` : undefined,
    line ? `Line: ${line}` : undefined,
    '',
    `Error: ${message}`,
    snippet ? `Problem line: ${snippet}` : undefined,
    '',
    'Hints:',
    ...hints.map((hint) => `- ${hint}`),
    '',
    error.stack ? `Stack:\n${error.stack}` : undefined,
  ].filter((line): line is string => Boolean(line))

  return {
    message,
    line,
    snippet,
    hints,
    llmContext: lines.join('\n'),
  }
}
