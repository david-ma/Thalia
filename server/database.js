var mysql = require("mysql");

var Database = function (cred) {
  this.cred = cred;
  this.connected = false;
}
Database.prototype.connect = function(){
  var that = this,
      cred = this.cred;

	var db = this.db = mysql.createConnection(cred);

	db.connect(function(err) {
			if(err) {
				console.log("Error in database!");
				console.log(err);
			} else {
			  that.connected = true;
				console.log('Database connected: '+cred.database+' as id: ' + db.threadId);
			}
		});
	
	db.on('error', function(err) {
		console.log('db error: '+cred.database);

		/**
		 * Connection to the MySQL server is usually lost due to either server restart, or a
		 * connnection idle timeout (the wait_timeoutserver variable configures this)
		 */
		if(err.code === 'PROTOCOL_CONNECTION_LOST') {
		  that.connected = false;
			console.log('PROTOCOL_CONNECTION_LOST');
		} else {
		  console.log("Some sort of DB error...");
			console.log(err);
		}
	});
	return db;
}

Database.prototype.query = function(query, callback){
  if(this.connected) {
  	this.db.query(query, callback);
  } else {
    this.connect();
  	this.db.query(query, callback);
  }
}

exports.db = Database;











