/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';
let connectButton = document.querySelector('button#connect');
let hangupButton = document.querySelector('button#hangup');
let bitrateDiv = document.querySelector('div#bitrate');
let peerDiv = document.querySelector('div#peer');
let senderStatsDiv = document.querySelector('div#senderStats');
let receiverStatsDiv = document.querySelector('div#receiverStats');

let cameraPrev = document.getElementById('cameraPrev')
let localPeerConnection;
let remotePeerConnection;
let localStream;
let bytesPrev;
let timestampPrev;

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
    let selectedIndex = document.getElementById('videoList').options.selectedIndex
    let selectedOption = document.getElementById('videoList').options[selectedIndex]
    return selectedOption.value
}

async function selectDeviceAndGum(){
    let deviceId = getUsingDeviceId()
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
            console.log(`localPeerConnection.setLocalDescription ${desc.sdp}`);
            localPeerConnection.setLocalDescription(desc).then(function (){
                remotePeerConnection.setRemoteDescription(desc);
                remotePeerConnection.createAnswer().then(
                    function(desc2) {
                        remotePeerConnection.setLocalDescription(desc2).then(function (){
                            console.log('localPeerConnection.setRemoteDescription: ', desc2.sdp);
                            localPeerConnection.setRemoteDescription(desc2)
                        }).catch(function (error){
                            console.error(error)
                        })
                    },
                    function(err) {
                        console.log(err);
                    }
                );
            }).catch(function (error){
                console.error(error)
            })
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
        sdpSemantics: 'unified-plan',
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle'
    }
    console.warn("RTCPeerConnection Config: ", JSON.stringify(config, null, '    '))
    localPeerConnection = new RTCPeerConnection(config);
    remotePeerConnection = new RTCPeerConnection(config);

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localPeerConnection.addStream(localStream)

    let stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            frameRate: 15,
            width: 1920,
            height: 1080,
        }
    });
    localPeerConnection.addStream(stream)

    let stream2 = await navigator.mediaDevices.getUserMedia( {
        audio: false,
        video: {
            frameRate: 15,
            width: 640,
            height: 360,
        }
    });
    remotePeerConnection.addStream(stream2)

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
            remotePeerConnection.createAnswer().then(
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

    let localPeerStreamArray = []
    localPeerConnection.ontrack = function(e) {
        if(e.streams[0].getVideoTracks().length) {
            let stream = e.streams[0]
            if(!localPeerStreamArray.includes(stream)){
                console.warn("localPeerConnection get stream: ", e.streams[0])
                let parent = document.getElementById('localPeerStreams')
                let video = document.createElement('video')
                video.id = 'video' + videoIndex
                video.srcObject = e.streams[0]
                video.autoplay = true
                video.controls = true
                parent.appendChild(video)
                videoIndex++
                localPeerStreamArray.push(stream)
            }else {
                console.log('remotePeerConnection already got this stream ', stream);
            }
        }
    };

    let remotePeerStreamArray = []
    remotePeerConnection.ontrack = function(e) {
        if(e.streams[0].getVideoTracks().length) {
            let stream = e.streams[0]
            if(!remotePeerStreamArray.includes(stream)){
                console.warn("remotePeerConnection get stream: ", e.streams[0])
                let parent = document.getElementById('remotePeerStreams')
                let video = document.createElement('video')
                video.id = 'video' + videoIndex
                video.srcObject = e.streams[0]
                video.autoplay = true
                video.controls = true
                parent.appendChild(video)
                videoIndex++
                remotePeerStreamArray.push(stream)
            }else {
                console.log('remotePeerConnection already got this stream ', stream);
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

    localStream.getTracks().forEach(function(track) {
        track.stop();
    });
    localStream = null;

    hangupButton.disabled = true;
}

function closeStream() {
    // clear first
    let stream = cameraPrev.srcObject
    if (stream){
        try {
            stream.oninactive = null;
            let tracks = stream.getTracks();
            for (let track in tracks) {
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
        let videoTracks = localStream.getVideoTracks();
        for (let i = 0; i !== videoTracks.length; ++i) {
            videoTracks[i].stop();
        }
    }
}


