var mysql = require("mysql");
var cred = require("./credentials").cred;

var db = {
	init: function(){
		db.dbConnection = mysql.createConnection(cred.db);

		db.dbConnection.connect(function(err) {
			if (err) {
				console.error('error connecting: ' + err.stack);
				db.dbConnection = mysql.createConnection(cred.db2);
				db.dbConnection.connect();
				return;
			}

			console.log('connected as id ' + db.dbConnection.threadId);
		});

		db.dbConnection.on('error', function(err) {
			console.log('db error', err);
			if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
				db.init();                         // lost due to either server restart, or a
			} else {                                      // connnection idle timeout (the wait_timeout
				throw err;                                  // server variable configures this)
			}
		});
		console.log("db connected");

	},
	test: function(d, callback){
		//just a little test to make sure you're connected to the database.
		console.log("running test");
		var query = "select * from localphotostories_clean";

		db.dbConnection.query(query, function(err, results) {
			if(err == null) {
				console.log(results);
//				callback(results);
			}
		});

	},
	get_row: function(id, callback){
		console.log("getting row "+id);
		var query = "select * from localphotostories_clean where row_names = "+id;

		db.dbConnection.query(query, function(err, results) {
			if(err == null) {
				callback(results);
			} else {
				callback();
			}
		});
	},
	get_desc: function(d, callback){
		var query = 'select * from metadata where `Primary.image` = "'+d+'" && name = "og:description"';

		db.dbConnection.query(query, function(err, results) {
			if(err == null) {
// 				console.log(results);
				callback(results);
			} else {
//				callback();
			}
		});


	},
	insert_twitter_name: function(d, callback){
// 		console.log("inserting twitter stuff to the database");

		if(d && d.username && d.sourcename && d.description){
// 			console.log("lol we made it this far...");
			var query = "INSERT INTO `david_twitter` (`username`, `sourcename`, `description`, `quality`) VALUES (?, ?, ?, 'crappy first-pick');";

			db.dbConnection.query(query, [d.username, d.sourcename, d.description], function(err, results) {
				if(err == null) {
	// 				console.log(results);
					callback(results);
				} else {
					console.log("error...");
					console.log(err);
	//				callback();
				}
			});
		} else {
			console.log("we don't have complete query data...?");
			console.log(d);
		}
	},
	get_good_row: function(id, callback){
		console.log("getting row "+id+" from tempview");
		var query = "select * from tempview where row_names = "+id;

		db.dbConnection.query(query, function(err, results) {
			if(err == null) {
				callback(results);
			} else {
				callback();
			}
		});
	}
}

exports.db = db;





































