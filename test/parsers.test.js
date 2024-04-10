"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const helpers_1 = require("../server/helpers");
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
];
(0, globals_1.describe)('Test htmlEscape', () => {
    (0, globals_1.test)('htmlEscape', () => {
        (0, globals_1.expect)(helpers_1.htmlEscape).toBeTruthy();
    });
    statements.forEach(({ input, expected }) => {
        (0, globals_1.test)(`htmlEscape(${input})`, () => {
            (0, globals_1.expect)((0, helpers_1.htmlEscape)(input)).toBe(expected);
        });
    });
});
