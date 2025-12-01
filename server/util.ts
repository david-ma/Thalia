// Asynchronous for each, doing a limited number of things at a time.
export async function asyncForEach(
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

// Simple spinner
export function spinner(string: string = 'Loading...') {
  const dots = {
    interval: 80,
    frames: [
      "⠋",
      "⠙",
      "⠹",
      "⠸",
      "⠼",
      "⠴",
      "⠦",
      "⠧",
      "⠇",
      "⠏"
    ]
  }

  let i = 0
  const spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${dots.frames[i]} ${string}`)
    i = (i + 1) % dots.frames.length
  }, dots.interval)

  return () => {
    process.stdout.write(`\r${string}\n`)
    clearInterval(spinnerInterval)
  }
}
