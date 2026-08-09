/**
 * Unit tests: theme registry helpers (`src/js/theme-toggle.ts`).
 */
import { describe, expect, test } from 'bun:test'
import {
  CYCLE_BINARY,
  CYCLE_SYSTEM,
  PALETTE_IDS,
  cycleThemeId,
  isThemeId,
  resolveColorScheme,
  themeMeta,
} from '../../src/js/theme-toggle.ts'

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
})
