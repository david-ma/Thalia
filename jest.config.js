module.exports = {
  preset: "jest-puppeteer",
  globals: {
    URL: "http://localhost:1337"
  },
  testMatch: [
    "**/test/**/*.test.js"
  ],
  verbose: true
}
