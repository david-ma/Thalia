
// Asynchronous for each, doing a limited number of things at a time.
async function asyncForEach(
  array: any[],
  limit: number,
  callback: (item: any, index: number, array: any[], done: () => void) => void,
) {
  let i: number = 0

  for (; i < limit; i++) {
    doNextThing(i)
  }

  function doNextThing(index: number) {
    if (array[index]) {
      callback(array[index], index, array, function done() {
        doNextThing(i++)
      })
    }
  }

  return 1
}

// Merge two objects, recursively
// Don't modify the original objects, return a new object
// Use the primary object as the base, and merge the secondary object into it
// Concat arrays
// Replace strings or ints
// Join objects
function deepMerge(primary: any, secondary: any) {
  const result: any = {}
  for (const key in primary) {
    result[key] = primary[key]
    if (secondary[key] === undefined) {
      continue
    }
    if (typeof primary[key] !== typeof secondary[key]) {
      result[key] = secondary[key]
    } else if (Array.isArray(primary[key])) {
      result[key] = primary[key].concat(secondary[key])
    } else if (typeof primary[key] === 'object') {
      result[key] = deepMerge(primary[key], secondary[key])
    }
  }
  for (const key in secondary) {
    if (primary[key] === undefined) {
      result[key] = secondary[key]
      continue
    }
  }

  return result
}

export { asyncForEach, deepMerge }
