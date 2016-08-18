var mysql = require("mysql");

var Database = function (cred) {
  this.cred = cred;
  this.connect_database();
}


Database.prototype.connect_database = function(){
  var cred = this.cred

	var db = this.db = mysql.createConnection(cred);
	db.connect(function(err) {
			if(err) {
				console.log("Error in database!");
				console.log(err);
			} else {
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
			console.log('PROTOCOL_CONNECTION_LOST, reconnecting');
			this.connect_database();
		} else {
			console.log(err);
		}
	});
}

Database.prototype.query = function(query, callback){
	this.db.query(query, callback);
}

exports.db = Database;
