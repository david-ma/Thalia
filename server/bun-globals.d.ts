/** Augment bun-types with runtime APIs missing from some published versions. */
declare module 'bun' {
  namespace YAML {
    function parse(text: string): unknown
    function stringify(value: unknown): string
  }
}
