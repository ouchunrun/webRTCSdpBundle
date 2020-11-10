/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';
var connectButton = document.querySelector('button#connect');
var hangupButton = document.querySelector('button#hangup');
var bitrateDiv = document.querySelector('div#bitrate');
var peerDiv = document.querySelector('div#peer');
var senderStatsDiv = document.querySelector('div#senderStats');
var receiverStatsDiv = document.querySelector('div#receiverStats');

var localVideo = document.querySelector('div#localVideo video');
var remoteVideo = document.querySelector('div#remoteVideo video');
var cameraPrev = document.getElementById('cameraPrev')
var localVideoStatsDiv = document.querySelector('div#localVideo div');
var remoteVideoStatsDiv = document.querySelector('div#remoteVideo div');

var localPeerConnection;
var remotePeerConnection;
var localStream;
var bytesPrev;
var timestampPrev;

let constraints = {
    audio: true,
    video: {
        frameRate: 15,
        width: 1280,
        height: 720,
    }
};
let isAddNewStream = false

/***
 * 取流：包括 桌面共享present(window/screen/tab/all)、摄像头共享（audio/video）
 * FAQ： 如何区分预览取流和正常取流（不用区分，都是取流，预览是不存在服务器要求的分辨率的
 */

function getUsingDeviceId () {
    var selectedIndex = document.getElementById('videoList').options.selectedIndex
    var selectedOption = document.getElementById('videoList').options[selectedIndex]
    return selectedOption.value
}

async function selectDeviceAndGum(){
    var deviceId = getUsingDeviceId()
    console.warn("deviceId: ", deviceId)
    if(deviceId === ""){
        console.warn("请选择有效设备")
        return
    }
    let constraints = JSON.parse(getUserMediaConstraintsDiv.value)
    constraints.video.deviceId = {
        exact: deviceId
    }
    console.warn('getUserMediaConstraints: ', JSON.stringify(constraints, null, '   '))

    let prevStream = await navigator.mediaDevices.getUserMedia(constraints);
    let cameraPrev = document.getElementById('cameraPrev')
    cameraPrev.srcObject = prevStream

    if(localPeerConnection && remotePeerConnection){
        addNewStream(prevStream)
    }
}

async function addNewStream(stream){
    if(!stream){
        let con = {
            audio: false,
            video: {
                frameRate: 5,
                width: 320,
                height: 180,
            }
        };
        stream = await navigator.mediaDevices.getUserMedia(con);
    }

    localPeerConnection.addStream(stream)

    localPeerConnection.createOffer().then(
        function(desc) {
            console.log('localPeerConnection offering');
            console.log(`Offer from pc1 ${desc.sdp}`);
            localPeerConnection.setLocalDescription(desc);
        },
        function(err) {
            console.log(err);
        }
    );
    isAddNewStream = true
}

let videoIndex = 1
async function createPeerConnection(){
    console.log("begin create peerConnections");
    console.log(localStream);
    connectButton.disabled = true;
    hangupButton.disabled = false;

    bytesPrev = 0;
    timestampPrev = 0;
    let config = {
        // sdpSemantics: 'plan-b',
        sdpSemantics: 'unified-plan',
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-compat'
    }
    localPeerConnection = new RTCPeerConnection(config);
    remotePeerConnection = new RTCPeerConnection(config);


    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localPeerConnection.addStream(localStream)
    localVideo.srcObject = localStream

    let con = {
        audio: false,
        video: {
            frameRate: 15,
            width: 1920,
            height: 1080,
        }
    };
    let stream = await navigator.mediaDevices.getUserMedia(con);
    localPeerConnection.addStream(stream)

    console.log('localPeerConnection creating offer');
    localPeerConnection.onnegotiationeeded = function() {
        console.log('Negotiation needed - localPeerConnection');
    };
    remotePeerConnection.onnegotiationeeded = function() {
        console.log('Negotiation needed - remotePeerConnection');
    };

    localPeerConnection.oniceconnectionstatechange = function(o_event){
        console.warn("localPeerConnection iceConnectionState: ", localPeerConnection.iceConnectionState)
    };
    localPeerConnection.onconnectionstatechange = function(o_event){
        console.warn("localPeerConnection iceConnectionState: ", localPeerConnection.connectionState)
    };

    remotePeerConnection.oniceconnectionstatechange = function(o_event){
        console.warn("remotePeerConnection iceConnectionState: ", remotePeerConnection.iceConnectionState)
    };
    remotePeerConnection.onconnectionstatechange = function(o_event){
        console.warn("remotePeerConnection iceConnectionState: ", remotePeerConnection.connectionState)
    };

    localPeerConnection.onicecandidate = function(e) {
        console.log('Candidate localPeerConnection');
        if(!e.candidate || localPeerConnection.iceGatheringState === 'complete'){
            console.warn("localPeerConnection 收集完成")
            let desc = localPeerConnection.localDescription
            remotePeerConnection.setRemoteDescription(desc);
            remotePeerConnection.createAnswer({iceRestart: true}).then(
                function(desc2) {
                    console.log('remotePeerConnection createAnswer complete');
                    remotePeerConnection.setLocalDescription(desc2);

                    // Todo: Firefox 不触发 onicecandidate 事件
                    if(navigator.userAgent.indexOf('Firefox') >= 0 && isAddNewStream){
                        console.warn(`Answer from pc2:\n${desc2.sdp}`);
                        localPeerConnection.setRemoteDescription(desc2);
                    }
                },
                function(err) {
                    console.log(err);
                }
            );
        }else {
            console.log('local.candidate:', e.candidate.candidate)
        }
    };

    remotePeerConnection.onicecandidate = function(e) {
        console.log('Candidate remotePeerConnection');
        if(!e.candidate || remotePeerConnection.iceGatheringState === 'complete'){
            console.warn("remotePeerConnection 收集完成")
            let desc2 = remotePeerConnection.localDescription
            console.warn(`Answer from pc2:\n${desc2.sdp}`);
            localPeerConnection.setRemoteDescription(desc2);
        }else {
            console.log('remote.candidate:', e.candidate.candidate)
        }
    };

    remotePeerConnection.ontrack = function(e) {
        if(e.streams[0].getVideoTracks().length) {
            if (!remoteVideo.srcObject) {
                console.log('remotePeerConnection got stream ', e.streams[0]);
                remoteVideo.srcObject = e.streams[0];
            } else {
                console.warn("remotePeerConnection get stream: ", e.streams[0])
                let parent = document.getElementById('remoteVideoS')
                let video = document.createElement('video')
                video.id = 'video' + videoIndex
                video.srcObject = e.streams[0]
                video.autoplay = true
                video.controls = true
                parent.appendChild(video)
                videoIndex++
            }
        }
    };

    localPeerConnection.createOffer().then(
        function(desc) {
            console.log('localPeerConnection offering');
            console.log(`Offer from pc1 ${desc.sdp}`);
            localPeerConnection.setLocalDescription(desc);
        },
        function(err) {
            console.log(err);
        }
    );
}

function hangup() {
    console.log('Ending call');
    localPeerConnection.close();
    remotePeerConnection.close();
    window.location.reload();

    // query stats one last time.
    Promise.all([
        remotePeerConnection.getStats(null)
            .then(showRemoteStats, function(err) {
                console.log(err);
            }),
        localPeerConnection.getStats(null)
            .then(showLocalStats, function(err) {
                console.log(err);
            })
    ]).then(() => {
        localPeerConnection = null;
        remotePeerConnection = null;
    });

    localStream.getTracks().forEach(function(track) {
        track.stop();
    });
    localStream = null;

    hangupButton.disabled = true;
}

function showRemoteStats(results) {
    var statsString = dumpStats(results);

    receiverStatsDiv.innerHTML = '<h2>Receiver stats</h2>' + statsString;
    // calculate video bitrate
    results.forEach(function(report) {
        var now = report.timestamp;

        var bitrate;
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            var bytes = report.bytesReceived;
            if (timestampPrev) {
                bitrate = 8 * (bytes - bytesPrev) / (now - timestampPrev);
                bitrate = Math.floor(bitrate);
            }
            bytesPrev = bytes;
            timestampPrev = now;
        }
        if (bitrate) {
            bitrate += ' kbits/sec';
            bitrateDiv.innerHTML = '<strong>Bitrate:</strong> ' + bitrate;
        }
    });

    // figure out the peer's ip
    var activeCandidatePair = null;
    var remoteCandidate = null;

    // Search for the candidate pair, spec-way first.
    results.forEach(function(report) {
        if (report.type === 'transport') {
            activeCandidatePair = results.get(report.selectedCandidatePairId);
        }
    });
    // Fallback for Firefox and Chrome legacy stats.
    if (!activeCandidatePair) {
        results.forEach(function(report) {
            if (report.type === 'candidate-pair' && report.selected || report.type === 'googCandidatePair' && report.googActiveConnection === 'true') {
                activeCandidatePair = report;
            }
        });
    }
    if (activeCandidatePair && activeCandidatePair.remoteCandidateId) {
        remoteCandidate = results.get(activeCandidatePair.remoteCandidateId);
    }
    if (remoteCandidate) {
        if (remoteCandidate.ip && remoteCandidate.port) {
            peerDiv.innerHTML = '<strong>Connected to:</strong> ' + remoteCandidate.ip + ':' + remoteCandidate.port;
        } else if (remoteCandidate.ipAddress && remoteCandidate.portNumber) {
            // Fall back to old names.
            peerDiv.innerHTML = '<strong>Connected to:</strong> ' + remoteCandidate.ipAddress + ':' + remoteCandidate.portNumber;
        }
    }
}

function showLocalStats(results) {
    var statsString = dumpStats(results);
    senderStatsDiv.innerHTML = '<h2>Sender stats</h2>' + statsString;
}
// Display statistics
setInterval(function() {
    if (localPeerConnection && remotePeerConnection) {
        remotePeerConnection.getStats(null).then(showRemoteStats, function(err) {
                console.log(err);
            });
        localPeerConnection.getStats(null).then(showLocalStats, function(err) {
                console.log(err);
            });
    } else {
        // console.log('Not connected yet');
    }
    // Collect some stats from the video tags.
    if (localVideo.videoWidth) {
        localVideoStatsDiv.innerHTML = '<strong>Video dimensions:</strong> ' +
            localVideo.videoWidth + 'x' + localVideo.videoHeight + 'px';
    }
    if (remoteVideo.videoWidth) {
        remoteVideoStatsDiv.innerHTML = '<strong>Video dimensions:</strong> ' +
            remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight + 'px';
    }
}, 1000);

// Dumping a stats variable as a string.1
// might be named toString?
function dumpStats(results) {
    var statsString = '';
    results.forEach(function(res) {
        statsString += '<h3>Report type=';
        statsString += res.type;
        statsString += '</h3>\n';
        statsString += 'id ' + res.id + '<br>\n';
        statsString += 'time ' + res.timestamp + '<br>\n';
        Object.keys(res).forEach(function(k) {
            if (k !== 'timestamp' && k !== 'type' && k !== 'id') {
                statsString += k + ': ' + res[k] + '<br>\n';
            }
        });
    });
    return statsString;
}

function closeStream() {
    // clear first
    var stream = cameraPrev.srcObject
    if (stream){
        try {
            stream.oninactive = null;
            var tracks = stream.getTracks();
            for (var track in tracks) {
                tracks[track].onended = null;
                log.info("close stream");
                tracks[track].stop();
            }
        }
        catch (error) {
            log.info('closeStream: Failed to close stream');
            log.error(error);
        }
        stream = null;
        cameraPrev.srcObject = null
    }

    if (localStream) {
        localStream.getTracks().forEach(function(track) {
            track.stop();
        });
        var videoTracks = localStream.getVideoTracks();
        for (var i = 0; i !== videoTracks.length; ++i) {
            videoTracks[i].stop();
        }
    }
}


