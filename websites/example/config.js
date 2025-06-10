module.exports = {
  config: {
    name: 'example',
    folder: 'public',
    domains: ['localhost'],
    controllers: {
      '/': async (controller) => {
        controller.res.end('Hello from Thalia!')
      }
    },
    services: {
      '/api/status': async (res, req, db, words) => {
        res.end(JSON.stringify({ status: 'ok' }))
      }
    },
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
          socket.emit('welcome', { message: 'Connected to Thalia' })
        }
      ]
    }
  }
} 