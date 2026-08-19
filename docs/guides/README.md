# Thalia implementation guides

These guides are durable breadcrumbs for humans and coding agents working with
Thalia. They describe supported integration contracts and are shipped in the
npm package alongside the framework source.

The root `AGENTS.md` is the always-loaded repository contract and routes work to
these guides. A guide is not loaded automatically merely because it is linked,
so read the relevant file before changing that area.

## Guides

| Area | Read before changing |
|---|---|
| Themes, colour tokens, theme boot/toggle, themed examples | [Themes](themes.md) |

Add another topic guide when an integration has multiple coordinated files,
public extension points, or non-obvious tests. Keep transient investigations and
dated decision logs in diaries; promote only settled behaviour into this folder.

Use nested `AGENTS.md` files only for mandatory rules scoped to a subtree, not
for ordinary how-to material.
