# Thalia

A custom Node.js framework for building web applications with a focus on modularity and organization.

## Features

- Multi-project support with isolated configurations
- Handlebars templating engine
- WebSocket support with Socket.IO
- Proxy support for routing requests
- Controller-based request handling
- Service-based API endpoints
- Static file serving
- TypeScript support
- SCSS compilation

## Project Structure

```
thalia/
├── bin/                    # Executable scripts
│   ├── build.js           # Build script for projects
│   ├── develop.js         # Development server script
│   └── thalia.js          # Main server script
├── server/                 # Server implementation
│   ├── core/              # Core server components
│   │   ├── handlers.ts    # Request handlers
│   │   ├── server.ts      # Server implementation
│   │   ├── thalia.ts      # Main Thalia class
│   │   ├── types.ts       # TypeScript type definitions
│   │   └── website.ts     # Website class
│   └── index.ts           # Server entry point
├── websites/              # Project directories
│   └── example/          # Example project
│       ├── config.js     # Project configuration
│       ├── src/          # Source files
│       └── views/        # Handlebars templates
├── package.json          # Project configuration
└── tsconfig.json         # TypeScript configuration
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the server:
   ```bash
   npm run build:ts
   ```

3. Start the development server:
   ```bash
   npm run dev example
   ```

4. Build a project:
   ```bash
   npm run build example
   ```

## Project Configuration

Each project in the `websites` directory should have a `config.js` file with the following structure:

```javascript
module.exports = {
  config: {
    // Project name
    name: 'example',

    // Public directory for static files
    folder: 'public',

    // Domain names for this project
    domains: ['example.com'],

    // Proxy configurations
    proxies: {
      api: {
        host: 'api.example.com',
        port: 8080
      }
    },

    // Controller handlers
    controllers: {
      '/': async (controller) => {
        controller.res.end('Hello World')
      }
    },

    // Service handlers
    services: {
      '/api': async (res, req, db, words) => {
        res.end(JSON.stringify({ message: 'API response' }))
      }
    },

    // WebSocket handlers
    sockets: {
      on: [
        {
          name: 'message',
          callback: (socket, data) => {
            socket.emit('response', { echo: data })
          }
        }
      ],
      emit: [
        (socket) => {
          socket.emit('welcome', { message: 'Connected' })
        }
      ]
    }
  }
}
```

## Development

- `npm run dev <project>` - Start development server for a project
- `npm run build <project>` - Build a project
- `npm run build:ts` - Build TypeScript files
- `npm run watch:ts` - Watch TypeScript files for changes
- `npm run watch:scss` - Watch SCSS files for changes
- `npm run clean` - Clean build artifacts

## License

MIT
