module.exports = {
  apps: [
    {
      name: 'thalia',
      script: 'server/thalia.js',
      log_file: `${__dirname}/websites/default/public/log/log-${new Date().toISOString().slice(0, 10)}.txt`,
    },
  ],
}
