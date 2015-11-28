	"use strict"
	var gui = require('nw.gui');

	var userid = "", username = "";
	
	var fs     = require('fs');
	var dataPath = './data/';
	fs.mkdir(dataPath, function(){});

	var userNameText    = document.getElementById("username");
	var connIndicator   = document.getElementById("connectionIndicator");
	
 	var accountMgr = null;

	window.addEventListener("message", function(event) {
		var action = event.data['action'];
		if (action === 0) {
			// actionName : loggedout
			if (accountMgr) {
				log("===============before delete accountMgr:"+accountMgr);
				// delete accountMgr;
				accountMgr.Clear();
				accountMgr = null;
				log("===============after deleted accountMgr:"+accountMgr);
			};
			
			userNameText.innerHTML = "";
			connIndicator.innerHTML = "";
		} else if (action === 1) {
			// actionName : loggedin
			username = event.data['username'];
			userid   = event.data['userid'];

			if (username === undefined || userid === undefined) {
				// should not happen!!
				username = "";
				userid   = "";
			} else {
				accountMgr = new AccountManager(userid, this);
				userNameText.innerHTML = "Hi, " + username;
			}
		}
	}, false);

	function OnFile(name, abuffer) {
		log("OnFile recieved, name["+name+"], size["+abuffer.byteLength+"]");
	    fs.open(dataPath+name, 'w', function(err, fd) {
	    	if (err) {
	    		log("failed to open file:"+name);
	    	} else {
	    		var buf = new Buffer(new Uint8Array(abuffer));
	    		fs.write(fd, buf, 0, buf.length, function(err, written, buffer) {
	    			if (err) {
	    				log("Failed to write file:"+name);
	    			}
	    		});
	    	}
	    });
	}

	function OnString(str) {
		log("OnString recieved, string["+str+"]");
	}

	function log(text) {
	  console.log(text);
	}