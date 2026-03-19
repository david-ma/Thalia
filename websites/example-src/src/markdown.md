Here is a markdown file.

## Code Blocks

```
This is a plaintext code block.
```

## SQL

``` sql
-- This is a SQL code block.
SELECT * FROM users;
```

## TypeScript

``` typescript
// This is a TypeScript code block.
console.log("Hello, world!");
```

## Mermaid

The next one is a Mermaid diagram.
``` mermaid
graph TD
    A[Start] --> B[Stop]
```

# Markdown syntax guide

This sample markdown file is from https://markdownlivepreview.com/

## Headers

# This is a Heading h1
## This is a Heading h2
###### This is a Heading h6

## Emphasis

*This text will be italic*  
_This will also be italic_

**This text will be bold**  
__This will also be bold__

_You **can** combine them_

## Lists

### Unordered

* Item 1
* Item 2
* Item 2a
* Item 2b
    * Item 3a
    * Item 3b

### Ordered

1. Item 1
2. Item 2
3. Item 3
    1. Item 3a
    2. Item 3b

## Images

![This is an alt text.](/images/loading.gif "This is a sample image.")

This is an image of a loading spinner.

## Links

You may be using [Markdown Live Preview](https://markdownlivepreview.com/).

## Blockquotes

> Markdown is a lightweight markup language with plain-text-formatting syntax, created in 2004 by John Gruber with Aaron Swartz.
>
>> Markdown is often used to format readme files, for writing messages in online discussion forums, and to create rich text using a plain text editor.

## Tables

| Left columns  | Right columns |
| ------------- |:-------------:|
| left foo      | right foo     |
| left bar      | right bar     |
| left baz      | right baz     |

## Blocks of code

```
let message = 'Hello world';
alert(message);
```

## Inline code

This web site is using `markedjs/marked`.
