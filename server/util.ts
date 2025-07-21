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

export { asyncForEach }
