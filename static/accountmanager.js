var SignalingClient = function(delegate, publicChannel) {
	var msgDelegate_   = delegate;
	var publicChannel_ = publicChannel;

	var pubnub = PUBNUB({
        publish_key   : 'pub-c-540d3bfa-dd7a-4520-a9e4-907370d2ce37',
        subscribe_key : 'sub-c-3af2bc02-2b93-11e5-9bdb-0619f8945a4f'
    });
    pubnub.subscribe({                                     
        channel : publicChannel_,
        message : function(message,env,ch,timer,magic_ch){
        	msgDelegate_.onSignalingMessage(message);
        },
        connect: function() {}
    });

    this.Send  = Send;

	function Send(data, channel) {
		pubnub.publish({
            channel : channel,
            message : data
        });
	}

	function SendToPublicChannel(data) {
		pubnub.publish({
            channel : publicChannel_,
            message : data
        });
	}

}

// equivalent to FirstViewController on ios app
var AccountManager = function(userid, messageDelegate) {
	// HwType-UseType-OS-AppVersion-<Randome 4 digits>
    // Mac-Laptop-MacOx-1.0-<4 digits number>
    var rand4 = Math.floor(Math.random()*(8999+1)+1000);
	var selfPeerId_ = "4-3-3-1.0-"+rand4;

	var userid_    = userid;
	var signaling_ = new SignalingClient(this, userid_);
	var connectionMgr_ = new ConnectionManager(messageDelegate, signaling_)
	var hb_ref;
	log("=================New AccountManager allocated with userid:"+userid_);

	this.onSignalingMessage = onSignalingMessage;
	this.Clear = Clear;

	sendHeartbeat();

	function sendHeartbeat() {
		log("Sending hearbeat to on channel with userid:"+userid_);
		function ToHeartbeat() {
			return {
				MsgType :1,
				DeviceId:selfPeerId_
			};
		};
		signaling_.Send(ToHeartbeat(), userid_);
		hb_ref = setTimeout(sendHeartbeat, 5000);
	};

	function onSignalingMessage(response) {
	    if (!response.MsgType) {
	    	log("Wrong message type, key [MsgType] is not present");
	    	return;
	    };
	    if (!response.DeviceId) {
	    	log("Wrong message type, key [DeviceId] is not present");
	    	return;
	    };

	    var msgType  = response.MsgType;
	    var receiver = response.ToDeviceId ? response.ToDeviceId : "";
	    if (receiver.length !== 0) {
	    	if (receiver !== selfPeerId_) {
	    		// log("Ignoring this message, its destination is:"+receiver+", while selfPeerId:"+selfPeerId);
	    		return;
	    	};
	    } else {
	    	if (msgType !== 1) {
	    		log("Wrong message type, key[ToDeviceId] is not present in MsgType:"+msgType);
	    		return;
	    	};
	    };

	    switch(msgType) {
	    	case 1:
	    	//hb
	    	OnHeartBeat(response);
	    	break;
	    	case 2:
	    	// offer ICE
	    	OnOfferICECandidate(response);
	    	break;
	    	case 3:
	    	// offer sdp
	    	OnOfferSessionDescription(response);
	    	break;
	    	case 4:
	    	// answer ICE
	    	break;
	    	case 5:
	    	// answer sdp
	    	break;
	    	default:
	    	break;
	    }
	}

	function OnHeartBeat(message) {
		// we don't react to hb
		// we're waiting for offer coming in
	};

	function OnOfferICECandidate(message) {
		if (!message['DeviceId']) {
			log("Wrong OnOfferICECandidate message format, key[DeviceId] is not present in message");
			return;
		};
		var deviceid = message['DeviceId'];
		connectionMgr_.OnOfferICECandidate(message, deviceid);
	};

	function OnOfferSessionDescription(message) {
		if (!message['DeviceId']) {
			log("Wrong OnOfferSessionDescription message format, key[DeviceId] is not present in message");
			return;
		};
		if (!message['ToDeviceId']) {
			log("Wrong message format, key[ToDeviceId] is not present in message");
			return;
		};
		var otherPeerId = message['DeviceId'];
		var selfPeerId  = message['ToDeviceId'];
		var offersdp    = message['SessionDescription'];

		connectionMgr_.AddConnectionByOffer(otherPeerId, selfPeerId_, userid_, offersdp);
	}

	function Clear() {
		clearTimeout(hb_ref);
	}
}