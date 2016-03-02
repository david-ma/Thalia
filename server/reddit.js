var cred = require("./credentials").cred || {};
var db = require("./database").db;
var Snoocore = require('snoocore');
var cron = require("./cron").cron;


var reddit = {
	snoo: null,
	init: function (){
		reddit.snoo = new Snoocore(cred.reddit);
	},
	submit: function(data){
		reddit.snoo("/api/submit")
			.post(data)
			.then(function(result) {
				console.log("hello, we just submitted something!");
				console.log(result)

if(typeof result !== 'undefined' &&
	 typeof result.json !== 'undefined' &&
	 typeof result.json.data !== 'undefined' &&
	 typeof result.json.data.name == 'string') {

				reddit.snoo("/api/approve").post({
					id: result.json.data.name
				});
				reddit.snoo("/api/distinguish").post({
					api_type: "json",
					how: "yes",
					id: result.json.data.name
				});
				reddit.snoo("/api/sendreplies").post({
					id: result.json.data.name,
					state: false
				});
				if(data.nickname == 'albums' || data.nickname == 'raw' ||  data.nickname == 'follow') {
					reddit.snoo("/api/set_contest_mode").post({
						api_type: "json",
						id: result.json.data.name,
						state: true
					});
				}

				db.report_post(data.nickname, result.json.data.url);

} else {
	console.log("error, reddit is probably down... try again later?");
	cron.delay_submit(data);
}
				
			})
	},
	getTopDailyPosts: function(subreddit, callback){
		var results = [];
		
		
		
		reddit.snoo("/r/"+subreddit+"/hot").get({
			
		}).then(function(result){
			results = result.data.children;
			callback(results);
		});

		return results;
	},
	getComments: function(d, callback){
		reddit.snoo("/r/"+d.subreddit+"/"+d.article).get(d)
			.then(function(result){
				callback(result);
			});
	},
	aGet: function(d, callback){
		reddit.snoo(d.endpoint).get(d)
			.then(function(result){
				callback(result);
			});
	},
	comp: {
		init: function(){
			reddit.comp.snoo = new Snoocore({
				userAgent: 'PhotoComp2015',
				oauth: cred.reddit || {}
			})
//	This would get called every time there is any sort of error at all.
// 			reddit.comp.snoo.on('response_error', function(responseError){
// 				console.log("Hey! There's an error!");
// 				console.log(responseError);
// 			});
		},
		checkCode: function(auth_code, callback){
			reddit.comp.snoo.auth(auth_code).then(function(refresh_token){
				console.log("trying to autheticate with: "+auth_code);
				console.log("refreshToken is: ", refresh_token);

				callback({refresh_token: refresh_token});

				return reddit.comp.snoo('/api/v1/me').get();
			}).catch(function(error){
					console.log("There has been an error! bad auth_code!");
					callback("error");
			});
		},
		checkRefresh: function(d, callback){
			console.log(d);


			var snoo = reddit.comp.snoo;
			snoo.refresh(d.refresh_token).then(function(){
				return snoo('/api/v1/me').get();
			}).then(function(data){
				data.refresh_token = d.refresh_token;
				data.auth_code = d.auth_code;
				callback(data);
			});
		}
	}
}






// log in as frostickle...
// make a ton of posts...





exports.reddit = reddit;








