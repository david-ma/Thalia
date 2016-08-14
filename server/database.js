var mysql = require("mysql");

var db = db || {};

db = function(cred){
	
		db.dbConnection = mysql.createConnection(cred);

		db.dbConnection.connect(function(err) {
			if(err) {
				console.log("Error in database!");
				console.log(err);
			} else {
				console.log('connected to '+cred.database+' as id ' + db.dbConnection.threadId);
			}
		});

		db.dbConnection.on('error', function(err) {
			console.log('db error', err);
			
/**
 * Connection to the MySQL server is usually lost due to either server restart, or a
 * connnection idle timeout (the wait_timeoutserver variable configures this)
 */

			if(err.code === 'PROTOCOL_CONNECTION_LOST') {
				db.init();
			} else {
				throw err;
			}
		});
		console.log("db connected");
}

db.prototype.query = function(query, callback){
	db.dbConnection.query(query, function(err, results) {
		if(err == null) {
			callback(results);
		} else {
			console.log(err);
		}
	});
}




exports.db = db;


