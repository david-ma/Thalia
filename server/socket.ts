import { Thalia } from './thalia'
import SocketIO = require('socket.io')

function socketInit (io :SocketIO.Server, handle :Thalia.Handle) {
  console.log('Initialising Socket.io')

  Object.keys(handle.websites).forEach((siteName :string) => {
    io.of(`/${siteName}`).use((socket, next) => {
      const host = socket.handshake.headers.host
      const website = handle.getWebsite(host)

      if (website.name === siteName) {
        next()
      } else {
        next(new Error('Wrong namespace for this site'))
      }
    }).on('connection', function (socket) {
      const host = socket.handshake.headers.host
      const website = handle.getWebsite(host)

      // Simple logging
      console.log('Socket connection ' + socket.id + ' from ' + socket.handshake.headers.referer)

      website.sockets.on.forEach(function (d :Thalia.Receiver) {
        socket.on(d.name, function (data) {
          d.callback(socket, data, website.seq)
        })
      })
      website.sockets.emit.forEach((emitter :Thalia.Emitter) => {
        emitter(socket, website.seq)
      })
    })
  })
}

export { socketInit }
