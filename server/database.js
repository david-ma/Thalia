var mysql = require("mysql");


var db = db || {};

db = function(cred){
	
		db.dbConnection = mysql.createConnection(cred);

		db.dbConnection.connect(function(err) {
			console.log('connected to '+cred.database+' as id ' + db.dbConnection.threadId);
		});

		db.dbConnection.on('error', function(err) {
			console.log('db error', err);
			if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
				db.init();                         // lost due to either server restart, or a
			} else {                                      // connnection idle timeout (the wait_timeout
				throw err;                                  // server variable configures this)
			}
		});
		console.log('db connected');
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

db.prototype.insert = function(table, object, callback){
	var query = 'INSERT INTO `'+table+'` (`';
			keys = Object.keys(object),
			items = [];
	keys.forEach(function(key){
		items.push(object[key]); 
	});

	query += keys.join('`, `');
	query += '`) VALUES ("';
	query += items.join('", "');
	query += '");';

console.log(query);

	db.dbConnection.query(query, function(err, results) {
		if(err == null) {
			callback(results);
		} else {
			console.log(err);
		}
	});
}




exports.db = db;


