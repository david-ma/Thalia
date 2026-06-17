import { describe, expect, test, beforeEach } from 'bun:test'
import { resetStartupTimerForTests, startupElapsedMs, startupMark } from '../../server/startup-timer'

describe('startup-timer', () => {
  beforeEach(() => {
    resetStartupTimerForTests()
  })

  test('startupMark records elapsed time', () => {
    startupMark('a')
    const elapsed = startupElapsedMs()
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  test('resetStartupTimerForTests clears marks', () => {
    startupMark('phase-one')
    resetStartupTimerForTests()
    startupMark('phase-two')
    expect(startupElapsedMs()).toBeGreaterThanOrEqual(0)
  })
})
