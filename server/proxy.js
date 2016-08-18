var http = require('http');

http.createServer(onRequest).listen(80);

function onRequest(client_req, client_res) {

  var options = {
    port: 8080,
    path: client_req.url,
    method: client_req.method
  };

  if(client_req.host === "localhost") {
    options.port = 3000;
  }

  console.log('Serving '+options.port+ client_req.url);

    var proxy = http.request(options, function (res) {
        res.pipe(client_res, {
          end: true
        });
    });
    
    proxy.on('error', function(err){
      console.log(err);
      client_res.write("Error, server is down.");
      client_res.end();
    })

    client_req.pipe(proxy, {
      end: true
    });




}
