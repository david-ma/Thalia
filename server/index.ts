import { Thalia } from './core/thalia'

export async function startServer(options: { port?: number; project?: string } = {}): Promise<void> {
  const port = options.port || 3000
  const project = options.project

  const server = new Thalia({
    defaultProject: project,
    rootPath: process.cwd()
  })

  await server.start(port)
  console.log(`Server started on port ${port}`)
  if (project) {
    console.log(`Serving project: ${project}`)
  }
}

// Allow running directly from command line
if (require.main === module) {
  const args = process.argv.slice(2)
  const options: { port?: number; project?: string } = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      options.port = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--project' && i + 1 < args.length) {
      options.project = args[i + 1]
      i++
    }
  }

  startServer(options).catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}
