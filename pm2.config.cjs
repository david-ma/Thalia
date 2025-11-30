module.exports = {
  apps: [
    {
      name: "thalia",
      script: "server/cli.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        PORT: 1337,
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
      },
    },
  ],
}
