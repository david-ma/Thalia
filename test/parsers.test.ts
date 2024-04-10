import { describe, expect, test } from '@jest/globals'

import { htmlEscape } from '../server/helpers'

// We should really just write these HTML Entities to a dom and read them
const statements = [
  {
    input: 'This is a test',
    expected: 'This is a test'
  },
  {
    input: 'This is a test &',
    expected: 'This is a test &amp;'
  },
  {
    input: 'This is a test <',
    expected: 'This is a test &lt;'
  },
  {
    input: "blah * blah",
    expected: "blah &ast; blah"
  },
  {
    input: 'oiajfeiojhuiHEIUFHEUwihUI#$&*@#Y$786t3µy8938r90239rjj09(JFD(j9few',
    expected: 'oiajfeiojhuiHEIUFHEUwihUI&num;$&amp;&ast;&commat;&num;Y$786t3&micro;y8938r90239rjj09&lpar;JFD&lpar;j9few'
  },
  {
    input: '&&777&&&&&&***8746^^$@^^$^```````………………',
    expected: '&amp;&amp;777&amp;&amp;&amp;&amp;&amp;&amp;&ast;&ast;&ast;8746&Hat;&Hat;$&commat;&Hat;&Hat;$&Hat;&grave;&grave;&grave;&grave;&grave;&grave;&grave;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;'
  }
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
