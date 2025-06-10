"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketInit = void 0;
function socketInit(io, handle) {
    // console.log('Initialising Socket.io for site: ') // Which sites?
    Object.keys(handle.websites).forEach((siteName) => {
        io.of(`/${siteName}`)
            .use((socket, next) => {
            const host = socket.handshake.headers.host;
            const website = handle.getWebsite(host);
            if (website.name === siteName) {
                next();
            }
            else {
                next(new Error('Wrong namespace for this site'));
            }
        })
            .on('connection', function (socket) {
            const host = socket.handshake.headers.host;
            const website = handle.getWebsite(host);
            // Simple logging
            console.log('Socket connection ' +
                socket.id +
                ' from ' +
                socket.handshake.headers.referer);
            website.sockets.on.forEach(function (d) {
                socket.on(d.name, function (data) {
                    d.callback(socket, data, website.seq);
                });
            });
            website.sockets.emit.forEach((emitter) => {
                emitter(socket, website.seq);
            });
        });
    });
}
exports.socketInit = socketInit;
//# sourceMappingURL=socket.js.map