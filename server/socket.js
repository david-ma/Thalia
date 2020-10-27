/**
 * David Ma @Frostickle
 * 14 August 2016
 * I don't know why I need that heartbeat function,
 * but socket.io connections kept dropping.
 * We could count the beats and drop it after too many.
 * I'm not sure if this is an issue.
 */

function init(io, handle){
    console.log("Initialising Socket.io");

    //start the heartbeat...
    // function sendHeartbeat(){
    //     setTimeout(sendHeartbeat, 8000);
    //     io.sockets.emit('drip', { beat : 1 });
    // }
    // setTimeout(sendHeartbeat, 8000);

    //this stuff happens once, when the server starts:
    let text = "dummytext"


    //this stuff happens every time a page is loaded:
    io.on('connection', function(socket){


        socket.emit("text", {data: text});
        socket.on("overwriteText", function(packet){
            // console.log("overwriteText recieved.", packet);
            text = packet.data;
            socket.broadcast.emit("text", {data: text});

        });

        // Heartbeat function to keep connections alive.
        socket.on("drop", function(data){console.log("drop");});

        // Crappy logging
        console.log("Socket connection "+socket.id+" from "+socket.handshake.headers.referer);

        var host = socket.handshake.headers.host;
        var website = handle.getWebsite(host);

        if(website !== undefined && website.sockets !== undefined){
            if(website.sockets.on instanceof Array) {
                website.sockets.on.forEach(function(d){
                    socket.on(d.name, function(data){
                        d.callback(data, website.db, socket);
                    });
                });
            }
            if(website.sockets.emit instanceof Array) {
                website.sockets.emit.forEach(function(d){
                    socket.emit(d.name, d.data);
                });
            }
        }
    });
}

exports.init = init;
