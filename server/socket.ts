
function socketInit(io :SocketIO.Server, handle :any){
    console.log("Initialising Socket.io");

    Object.keys(handle.websites).forEach((siteName :string) => {
        io.of(`/${siteName}`).use((socket, next) => {
            const host = socket.handshake.headers.host;
            if (host == siteName || host.indexOf('localhost') >= 0) {
                next()
            } else {
                next(new Error("Wrong namespace for this site"))
            }
        }).on('connection', function(socket){
            const host = socket.handshake.headers.host;
            const website = handle.getWebsite(host);

            // Simple logging
            console.log("Socket connection "+socket.id+" from "+socket.handshake.headers.referer);

            if (host == siteName || host.indexOf('localhost') >= 0) {
                if(website !== undefined && website.sockets !== undefined){
                    if(website.sockets.on instanceof Array) {
                        website.sockets.on.forEach(function(d :any){
                            socket.on(d.name, function(data){
                                d.callback(data, website.db || website.seq, socket);
                            });
                        });
                    }
                    if(website.sockets.emit instanceof Array) {
                        website.sockets.emit.forEach(function(d :any){
                            socket.emit(d.name, d.data);
                        });
                    }
                }
            }
        });
    })
}

export { socketInit };
