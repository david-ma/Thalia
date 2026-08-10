/**
 * Unit tests: theme registry helpers (`src/js/theme-toggle.ts`).
 */
import { describe, expect, test } from 'bun:test'
import fs from 'fs'
import path from 'path'
import {
  CYCLE_BINARY,
  CYCLE_SYSTEM,
  PALETTE_IDS,
  THEMES,
  cycleThemeId,
  isThemeId,
  resolveColorScheme,
  themeMeta,
} from '../../src/js/theme-toggle.ts'

const root = path.resolve(import.meta.dirname, '../..')

describe('theme-toggle registry', () => {
  test('isThemeId accepts known ids', () => {
    expect(isThemeId('thalia')).toBe(true)
    expect(isThemeId('thalia-dark')).toBe(true)
    expect(isThemeId('agency')).toBe(true)
    expect(isThemeId('jaffle')).toBe(false)
    expect(isThemeId(null)).toBe(false)
  })

  test('cycleThemeId system and binary', () => {
    expect(cycleThemeId('system', 'system')).toBe('light')
    expect(cycleThemeId('light', 'system')).toBe('dark')
    expect(cycleThemeId('dark', 'system')).toBe('system')
    expect(cycleThemeId('light', 'binary')).toBe('dark')
    expect(cycleThemeId('dark', 'binary')).toBe('light')
    expect(cycleThemeId('solarized-dark', 'binary')).toBe(CYCLE_BINARY[0])
  })

  test('resolveColorScheme', () => {
    expect(resolveColorScheme('thalia', true)).toBe('light')
    expect(resolveColorScheme('thalia-dark', false)).toBe('dark')
    expect(resolveColorScheme('system', true)).toBe('dark')
    expect(resolveColorScheme('system', false)).toBe('light')
  })

  test('palette includes first-ship packs', () => {
    expect(PALETTE_IDS).toContain('thalia')
    expect(PALETTE_IDS).toContain('agency')
    expect(PALETTE_IDS).not.toContain('jaffle')
    expect(CYCLE_SYSTEM).toEqual(['system', 'light', 'dark'])
    expect(themeMeta('agency').scheme).toBe('light')
  })

  test('palette markup stays in sync with the palette registry', () => {
    const template = fs.readFileSync(path.join(root, 'src/views/partials/theme-toggle.hbs'), 'utf8')
    const templateIds = Array.from(template.matchAll(/data-theme-set="([^"]+)"/g), (match) => match[1])
    expect(templateIds).toEqual(PALETTE_IDS)
  })

  test('every non-system registry theme has an SCSS selector', () => {
    const scss = fs.readFileSync(path.join(root, 'src/css/thalia-themes.scss'), 'utf8')
    const scssIds = Array.from(scss.matchAll(/data-theme="([^"]+)"/g), (match) => match[1]).sort()
    const registryIds = THEMES.map(({ id }) => id).filter((id) => id !== 'system').sort()
    expect(scssIds).toEqual(registryIds)
  })

  test('early boot registry and dark schemes stay in sync', () => {
    const boot = fs.readFileSync(path.join(root, 'src/views/partials/theme-boot.hbs'), 'utf8')
    const idsFromObject = (name: 'KNOWN' | 'DARK') => {
      const body = boot.match(new RegExp(`var ${name} = \\{([\\s\\S]*?)\\};`))?.[1] ?? ''
      return Array.from(body.matchAll(/(?:"([^"]+)"|([a-z][a-z0-9-]*))\s*:\s*1/g), (match) => match[1] ?? match[2]).sort()
    }
    const registered = THEMES.filter(({ id }) => id !== 'system').map(({ id }) => id).sort()
    const dark = THEMES.filter(({ scheme }) => scheme === 'dark').map(({ id }) => id).sort()
    expect(idsFromObject('KNOWN')).toEqual(registered)
    expect(idsFromObject('DARK')).toEqual(dark)
  })

})
