
function ToAnswerICECandidate(peerId, ToPeerId, candidate) {
	return {
		MsgType           : 4,
		DeviceId          : peerId,
		ToDeviceId        : ToPeerId,
        ICECandidate: {
            sdpMLineIndex   : candidate.sdpMLineIndex,
            sdpMid          : candidate.sdpMid,
            candidate       : candidate.candidate
        }
	};
}

function ToAnswerSessionDescription(peerId, ToPeerId, sdp) {
	return {
		MsgType           : 5,
		DeviceId          : peerId,
		ToDeviceId        : ToPeerId,
		SessionDescription: JSON.stringify(sdp)
	};
}

var Connection = function (signalingClient, otherPeerId, selfPeerId, pubChannelId, offersdp) {
	var signalingClient_ = signalingClient;
	var otherPeerId_     = otherPeerId;
	var selfPeerId_      = selfPeerId;
	var channelIsOpen_   = false;
	var rtcconnection_;

	this.otherPeerId         = otherPeerId;
	this.IsOpen              = IsOpen;
	this.OnOfferICECandidate = OnOfferICECandidate;
	this.Send                = Send;

	OnOfferSessionDescription(offersdp);

	function IsOpen() {
		return channelIsOpen_;
	};

	function OnOfferICECandidate(message) {
		rtcconnection_.addICE({
		    sdpMLineIndex 	: message.ICECandidate.sdpMLineIndex,
		    sdpMid          : message.ICECandidate.sdpMid,
		    candidate 		: message.ICECandidate.candidate
		});
	};

	function OnOfferSessionDescription(offersdp) {
	    rtcconnection_ = RTCPeerConnection({
	        offerSDP: offersdp,
	        onAnswerSDP: function(sdp) {
	            signalingClient_.publish({
		            channel : pubChannelId,
		            message : ToAnswerSessionDescription(selfPeerId_, otherPeerId_, sdp)
		        });
	        },
	        onICE: function(candidate) {
	            signalingClient_.publish({
		            channel : pubChannelId,
		            message : ToAnswerICECandidate(selfPeerId_, otherPeerId_, candidate)
		        });
	        },
	        onRemoteStream: function(stream) {
	        },
	        onChannelMessage: function (event) {
	        	log("========Recevied event.data====="+event.data);
	        	if (typeof event.data === 'object') {
	        		log("Recevied binary data, size:"+event.data.byteLength);
	        	} else {
        		    try{
				        var json=JSON.parse(event.data);
				        log("Received valid json, json.type="+json.type);
				    }catch(e){
				    	log("Not valid json, assuming smple string: "+event.data);    
				    }
	        	}
				// for (var key in event) {
				//   if (event.hasOwnProperty(key)) {
				//     log("event============="+key + "====" + event[key]);
				//   }
				// }

				// var eData = event.data;
				// for (var key in eData) {
				//   if (eData.hasOwnProperty(key)) {
				//     log("eData======================="+key + "====" + eData[key]);
				//   }
				// }

		   //      var data = event.data;
		   //      var data_fileSize = new Uint32Array(data, 0, 8);
		   //      var data_type     = new Uint8Array(data, 8, 1);
		   //      var data_name     = new Uint8Array(data, 9, 19);

		   //      var fileSize = data_fileSize[0];
		   //      var type     = data_type[0];
		   //      var fileName = String.fromCharCode.apply(null, data_name);

	    //     	if (type === 0) { 
	    //     		// type : File
	    //     		var fileData = data.slice(28);
					// OnFileData(fileName, fileSize, fileData, data.byteLength - 28); // file hash in the future maybe
	    //     	} else if (type === 1) { 
	    //     		// type : Text
	    //     		log("Received text:"+data); 
	    //     	} else if (type === undefined) {
	    //     		log("Received undefined type"); 
	    //     	}
	        },
    		onChannelOpened: function (channel) {
    			log("RTCDataChannel opened");
    			connIndicator.innerHTML = "Connected";
    			channelIsOpen_ = true;
    		}, 
    		onChannelClosed: function (event) {
    			log("RTCDataChannel closed");
    			connIndicator.innerHTML = "Disconnected";
    			channelIsOpen_ = false;
    		},
            onChannelError: function (event) {
            	log("RTCDataChannel error");
            }
	    });
	};

	function Send(data) {
		rtcconnection_.sendData(data);
		log("channel is doing sendData");
	}
}

var ConnectionManager = function(signalingClient) {
	var signalingClient_ = signalingClient;
	var connections_     = {};

	this.AddConnectionByOffer = AddConnectionByOffer;
	this.OnOfferICECandidate  = OnOfferICECandidate;
	this.SendToPeer           = SendToPeer;

	function AddConnection(otherPeerId, selfPeerId, pubChannelId) {
		// Connection only support AnswerConnection
		// Creating new connection is triggered by offer request
		// (todo) allow new connection for creating offer
	};

	function AddConnectionByOffer(otherPeerId, selfPeerId, pubChannelId, offersdp) {
		// Creating new connection is triggered by offer request
		if (!connections_[otherPeerId] || !connections_[otherPeerId].IsOpen()) {
			connections_[otherPeerId] = new Connection(signalingClient_, otherPeerId, selfPeerId, pubChannelId, offersdp);
		};
	};

	function OnOfferICECandidate(message, otherPeerId) {
		if (connections_[otherPeerId]) {
			connections_[otherPeerId].OnOfferICECandidate(message);
		};
	};

	function SendToPeer(peerid, data) {
		for (var key in connections_) {
		  if (connections_.hasOwnProperty(key)) {
		    connections_[key].Send(data);
		  }
		}
	}
}
