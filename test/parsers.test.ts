import { describe, expect, test } from '@jest/globals'

import { htmlEscape } from '../server/helpers'

describe('Test htmlEscape', () => {
  test('htmlEscape', () => {
    expect(htmlEscape).toBeTruthy()
  })
})
