import { describe, expect, test } from '@jest/globals'

import { htmlEscape, oauthEscape } from '../server/helpers'

// We should really just write these HTML Entities to a dom and read them
const statements = [
  {
    input: 'This is a test',
    expected: 'This is a test',
    oauthExpected: 'This%20is%20a%20test',
  },
  {
    input: 'This is a test &',
    expected: 'This is a test &amp;',
    oauthExpected: 'This%20is%20a%20test%20%26',
  },
  {
    input: 'This is a test <',
    expected: 'This is a test &lt;',
    oauthExpected: 'This%20is%20a%20test%20%3C',
  },
  {
    input: 'blah * blah',
    expected: 'blah &ast; blah',
    oauthExpected: 'blah%20%2A%20blah',
  },
  {
    input: 'oiajfeiojhuiHEIUFHEUwihUI#$&*@#Y$786t3µy8938r90239rjj09(JFD(j9few',
    expected:
      'oiajfeiojhuiHEIUFHEUwihUI&num;$&amp;&ast;&commat;&num;Y$786t3&micro;y8938r90239rjj09&lpar;JFD&lpar;j9few',
    oauthExpected:
      'oiajfeiojhuiHEIUFHEUwihUI%23%24%26%2A%40%23Y%24786t3%C2%B5y8938r90239rjj09%28JFD%28j9few',
  },
  {
    input: '&&777&&&&&&***8746^^$@^^$^```````………………',
    expected:
      '&amp;&amp;777&amp;&amp;&amp;&amp;&amp;&amp;&ast;&ast;&ast;8746&Hat;&Hat;$&commat;&Hat;&Hat;$&Hat;&grave;&grave;&grave;&grave;&grave;&grave;&grave;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;',
    oauthExpected:
      '%26%26777%26%26%26%26%26%26%2A%2A%2A8746%5E%5E%24%40%5E%5E%24%5E%60%60%60%60%60%60%60%E2%80%A6%E2%80%A6%E2%80%A6%E2%80%A6%E2%80%A6%E2%80%A6',
  },
]

describe('Test htmlEscape', () => {
  test('htmlEscape', () => {
    expect(htmlEscape).toBeTruthy()
  })

  statements.forEach(({ input, expected }) => {
    test(`htmlEscape(${input})`, () => {
      expect(htmlEscape(input)).toBe(expected)
    })
  })
})

describe('Test oauthEscape', () => {
  test('oauthEscape', () => {
    expect(oauthEscape).toBeTruthy()
  })

  statements.forEach(({ input, oauthExpected }) => {
    test(`oauthEscape(${input})`, () => {
      expect(oauthEscape(input)).toBe(oauthExpected)
    })
  })
})
