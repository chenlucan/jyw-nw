	"use strict"
	var gui = require('nw.gui');

	var userid = "", username = "";
	
	var fs     = require('fs');
	var dataPath = './data/';
	fs.mkdir(dataPath, function(){});

	var userNameText   = document.getElementById("username");
	var connIndicator   = document.getElementById("connectionIndicator");
	var receiveTextarea = document.getElementById("receiveLog");
	var sendTextarea    = document.getElementById("sendTextarea");
	var receiveTextarea = document.getElementById("receiveLog");

    var loginButton     = document.getElementById("loginButton");
	var sendButton      = document.getElementById("sendButton");
	var fileInput       = document.getElementById("fileInput");
	var sendFileButton  = document.getElementById("sendFileButton");
	var sendProgress    = document.getElementById("sendProgress");

	var downloadDiv     = document.getElementById("received");

	var loginframe      = document.getElementById("loginframe");

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

	sendButton.onclick     = sendText;
	sendFileButton.onclick = sendMutiFiles;

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




	/////////////////////////////////////////////////////
	//Send files
	function sendMutiFiles() {
		for (var file in fileInput.files) {
			sendFile(file);
		}
	}
	function sendFile(file) {
	  log('file is ' + [file.name, file.size, file.type, file.lastModifiedDate].join(' '));
	  if (file.size === 0) {
	    return false;
	  }
	  sendProgress.max = file.size;
	  // var chunkSize = 16384;
	  var chunkSize = 65000;

	  var sliceFile = function(offset) {
	  	log("sending file, offset:"+offset);
	    var reader = new window.FileReader();
	    reader.onload = (function() {
	      return function(e) {
	      	if (offset == 0) {
		        var data = JSON.stringify({type:'File', fileName: file.name, fileSize: file.size});
		        log("sending file, JSON string length: "+data.length);
		        peer.sendData(data);	
	      	}

	      	var data_value_u8 = new Uint8Array(e.target.result);
	      	var data_value = Array.apply(null, data_value_u8);
	      	peer.sendData(e.target.result);

	        if (file.size > offset + e.target.result.byteLength) {
	          window.setTimeout(sliceFile, 0, offset + chunkSize);
	        }
	        sendProgress.value = offset + e.target.result.byteLength;
	      };
	    })(file);
	    var slice = file.slice(offset, offset + chunkSize);
	    reader.readAsArrayBuffer(slice);
	  };



	  sliceFile(0);
	  log("Sending File, name: "+file.name);
	  return false;
	}
	/////////////////////////////////////////////////////
	///HTML control handlers
	var hack_sendText = 1;
	function sendText() {
		hack_sendText = hack_sendText + 1;
		if (hack_sendText % 2 === 0) {
			log("sending json text");
			conMgr.SendToPeer("", JSON.stringify({"type":"testing json"}));
			conMgr.SendToPeer("", "Hello, team");
		} else {
			log("sending arrayBuffer size: 60000");
			var ab = new ArrayBuffer(60000);
			conMgr.SendToPeer("", ab);
		}
	}

	/////////////////////////////////////////////////////
	// receive fill util functions and variables
	var fileName = '';
	var fileSize = 0;
	var receiveBuffer = [];
	var receivedSize  = 0;
	var receiveUint8Buffer = new Uint8Array(0);

	function OnFileData(fName, fSize, fileData, valueLength) {
	  if (fileName === '' && fileSize === 0) {
	    // beginning of file transfering
	    fileName = fName;
	    fileSize = fSize;
	    receiveBuffer = [];
	    receivedSize  = 0;
	    receiveUint8Buffer = new Uint8Array(fSize);
	  }
	  // in progress of file transfering
	  if (fileName !== fName || fileSize !== fSize) {
	    log("Something wrong when transfering file, reason[file name/size does not match]");
	    log("Something wrong when transfering file, fileName:" + fileName + ", fileSize:" + fileSize + ", fName:"+fName + ", fSize:"+fSize);
	    fileName = '';
	    fileSize = 0;
	    receiveBuffer = [];
	    receivedSize  = 0;
	    receiveUint8Buffer = new Uint8Array(0);
	    return;  
	  }

	  receiveBuffer.push(fileData);
	  var fileDataUint8Buffer = new Uint8Array(fileData);
	  for (var i = 0; i < valueLength; ++i) {
	  	receiveUint8Buffer[receivedSize+i] = fileDataUint8Buffer[i];
	  }
	  receivedSize += valueLength;
	  
	  if (receivedSize === fileSize) {
	    log("File received, name:"+fileName + ", size:"+fileSize);
	    var received = new window.Blob(receiveBuffer);

	    downloadDiv.href = URL.createObjectURL(received);
	    downloadDiv.download = fileName;
	    var text = 'Click to download \'' + fileName + '\' (' + fileSize + ' bytes)';
	    downloadDiv.appendChild(document.createTextNode(text));
	    downloadDiv.style.display = 'block';

	    fs.open(dataPath+fileName, 'w', function(err, fd) {
	    	if (err) {
	    		log("open file failed img.jep");
	    	} else {
	    		var a_buf = receiveUint8Buffer.buffer;
	    		var buf = new Buffer(receivedSize);
	    		

	    		for (var i = 0; i < receivedSize; ++i) {
	    			buf[i] = receiveUint8Buffer[i];
	    		}
	    		fs.write(fd, buf, 0, buf.length, function(err, written, buffer) {
	    			if (err) {
	    				log("writen to file failed");
	    			} else {
	    				log("Received file, size: "+written);
	    			}
	    		});
	    	}
	    });

	    // able to receive file from guest again
	    fileName = '';
	    fileSize = 0;
	  }
	}

	function log(text) {
	  console.log(text);
	  receiveTextarea.value += '..........event log: '+text + '\n';
	}