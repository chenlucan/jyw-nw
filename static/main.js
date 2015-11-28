"use strict"
global.$ = $;

var abar = require('address_bar');
var folder_view = require('folder_view');
var gui = require('nw.gui');
var fs     = require('fs');
var homePath = process.env['HOME']+'/PrivateCloud/';
var picPath = homePath + 'Pictures/';
fs.mkdir(homePath, function(err) {
	if (err) {
		log("Failed to create home: "+homePath);
	}
	fs.mkdir(picPath,  function(err) {});
});

// Extend application menu for Mac OS
if (process.platform == "darwin") {
  var menu = new gui.Menu({type: "menubar"});
  menu.createMacBuiltin && menu.createMacBuiltin(window.document.title);
  gui.Window.get().menu = menu;
}

var App = {
  // show "about" window
  about: function () {
    var params = {toolbar: false, resizable: false, show: true, height: 120, width: 350};
    var aboutWindow = gui.Window.open('about.html', params);
    aboutWindow.on('document-end', function() {
      aboutWindow.focus();
      // open link in default browser
      $(aboutWindow.window.document).find('a').bind('click', function (e) {
        e.preventDefault();
        gui.Shell.openExternal(this.href);
      });
    });
  },

  // change folder for sidebar links
  cd: function (anchor) {
    anchor = $(anchor);

    $('#sidebar li').removeClass('active');
    $('#sidebar i').removeClass('icon-white');

    anchor.closest('li').addClass('active');
    anchor.find('i').addClass('icon-white');

    this.setPath(anchor.attr('nw-path'));
  },

  // set path for file explorer
  setPath: function (path) {
    if (path.indexOf('~') == 0) {
      path = path.replace('~', process.env['HOME']);
    }
    this.folder.open(path);
    this.addressbar.set(path);
  }
};

$(document).ready(function() {
  var folder = new folder_view.Folder($('#files'));
  var addressbar = new abar.AddressBar($('#addressbar'));

  folder.open(process.cwd());
  addressbar.set(process.cwd());

  App.folder = folder;
  App.addressbar = addressbar;

  folder.on('navigate', function(dir, mime) {
    if (mime.type == 'folder') {
      addressbar.enter(mime);
    } else {
      gui.Shell.openItem(mime.path);
    }
  });

  addressbar.on('navigate', function(dir) {
    folder.open(dir);
  });

  // sidebar favorites
  $('[nw-path]').bind('click', function (event) {
    event.preventDefault();
    App.cd(this);
  });

  gui.Window.get().show();
});





var userid = "", username = "";

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
    fs.open(picPath+name, 'w', function(err, fd) {
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