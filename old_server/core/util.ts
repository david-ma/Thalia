import formidable from 'formidable'

/**
 * Deep merges two objects, similar to lodash's merge
 */
export function merge<T extends object>(target: T, source: object): T {
  const output = { ...target }
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = merge(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }
  return output
}

/**
 * Checks if a value is a plain object
 */
function isObject(item: any): item is object {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Escapes HTML special characters in a string
 */
export function htmlEscape(string: string): string {
  return string
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Escapes OAuth special characters in a string
 */
export function oauthEscape(string: string): string {
  return string
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

/**
 * Sorts object parameters alphabetically by key
 */
export function sortParams(object: object): object {
  return Object.keys(object)
    .sort()
    .reduce((result: any, key) => {
      result[key] = object[key]
      return result
    }, {})
}

/**
 * Parses form data from a request
 */
export function parseForm(controller: any): Promise<[Record<string, string>, formidable.Files<string>]> {
  return new Promise((resolve, reject) => {
    const form = formidable()
    form.parse(controller.req, (err, fields, files) => {
      if (err) reject(err)
      resolve([parseFields(fields), files])
    })
  })
}

/**
 * Parses form fields from array format to single values
 */
function parseFields(fields: { [key: string]: string[] }): { [key: string]: string } {
  return Object.entries(fields).reduce((result, [key, value]) => {
    result[key] = Array.isArray(value) ? value[0] : value
    return result
  }, {} as { [key: string]: string })
}

/**
 * Parses a boolean string value
 */
export function parseBoolean(string: string): boolean {
  if (typeof string === 'boolean') return string
  if (typeof string !== 'string') return false
  return string.toLowerCase() === 'true'
} 