
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
};

var DataChannelMessageHandler = function(messageDelegate) {
/*

RTCDataChannel protocol:
1. able to receive data format:
   - ArrayBuffer (binary)
   - JSON (non-binary)
   - string

2. assume every msg has SeqNo:
   - ArrayBuffer - a metadata json packet is sent before binary data, those ArrayBuffer
     has the same SeqNo with its metadata packet.
   - JSON has field SeqNo
   - string is not handled. should be wrapped in JSON

3. once deteced gap, inform other side

4. If gap detected,
	- receiver should be able to continue receive packets from new beginning of packets
	- sender can resend the packet with new SeqNo. 
	- assume SeqNo is ascending, though receiver side is not depending on that.
*/
		
		// 	mode:
		// 	- 1: wait for json(including file metadata)
		// 	- 2: wait for file binary data packets numOfPackets
		
		// var mode = 1; 
	var fileHandler;
	var delegate = messageDelegate;

	var FileHandler = function(fileDelegate, name, size, numOfPackets) {
		var delegate = fileDelegate;
		var valid = true;
		var name = name;
		var size = size;
		var numOfPackets = numOfPackets;
		var buffer = new Uint8Array(size);
		var buffer_offset = 0;

		this.OnBinary = OnBinary;

		function OnBinary(abuffer) {
			if (!valid) {
				log("FileHandler is in not valid mode, not able to receive file binary");
				return;
			};
			if (buffer_offset < 0 || buffer_offset >= size) {
				log("FileHandler buffer_offset is out of index boundary");
				Clear();
				return;
			};
			if (buffer_offset + abuffer.byteLength > size) {
				log("FileHandler received arraybuffer is out of index boundary");
				Clear();
				return;
			};
			buffer.set(new Uint8Array(abuffer), buffer_offset);
			buffer_offset = buffer_offset + abuffer.byteLength;
			numOfPackets = numOfPackets - 1;

			if (size !== 0 && buffer_offset === size && numOfPackets === 0) {
				// received all binary packets for this file
				delegate.OnFile(name, buffer.buffer);
			}
		}

		function Clear() {
			valid = false;
			name  = "";
			size = 0;
			numOfPackets = 0;
			buffer = new Uint8Array(0);
			buffer_offset = 0;
		}
	};

	this.OnPacket  = OnPacket;

	function OnPacket(data) {
    	if (typeof data === 'object') {
    		log("Recevied binary data, size:"+data.byteLength);
			OnBinary(data);
    	} else {
		    try {
		        var json=JSON.parse(data);
		        OnJSON(json);
		    } catch(e) {
		    	log("Unhandled fomat: Not valid json, assuming smple string: "+data);    
		    }
    	}
	};

	function OnJSON(json) {
			// if (mode !== 1) {
			// 	// right now only supporting 2 modes. mode is 2: receiving files
			// 	// incomming json means binary data loss
			// 	// transit to mode 1
			// 	// clear not completed files
			// 	mode = 1;
			// 	fileHandler = undefined;
			// };

		if (json.Type) {
			if (json.Type === 1) {
				// file metadata
				var name = json.Name;
				var size = json.Size;
				var numOfPackets = json.NumOfPackets;
				
				var md5  = json.MD5;
				var dir  = json.Directory;
				var oper = json.Operation;
				fileHandler = new FileHandler(delegate, name, size, numOfPackets);
					// mode = 2;
			} else if (json.Type === 2) {
				// string received
				var content = json.Content;
				delegate.OnString(content);
			}
		}
	};

	function OnBinary(buffer) {
			// if (mode !== 2) {
			// 	log("DataChannelMessageHandler is not in mode of receiving file binary packets, ignore this binary packet");
			// 	return;
			// };
		if (fileHandler) {
			fileHandler.OnBinary(buffer);
		};
	};
};

var Connection = function (messageDelegate, signalingClient, otherPeerId, selfPeerId, pubChannelId, offersdp) {
	var msgHandler       = new DataChannelMessageHandler(messageDelegate);
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
	        	msgHandler.OnPacket(event.data);

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

var ConnectionManager = function(messageDelegate, signalingClient) {
	var delegate_        = messageDelegate;
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
			connections_[otherPeerId] = new Connection(delegate_, signalingClient_, otherPeerId, selfPeerId, pubChannelId, offersdp);
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
