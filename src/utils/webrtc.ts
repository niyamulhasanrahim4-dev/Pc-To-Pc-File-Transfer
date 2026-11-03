// WebRTC Connection and Signaling Manager
export interface SignalData {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export class PeerConnectionManager {
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private selfId: string;
  private sendSignal: (targetId: string, data: SignalData) => void;
  private onDataReceived: (peerId: string, data: ArrayBuffer | string) => void;
  private onConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void;

  constructor(
    selfId: string,
    sendSignal: (targetId: string, data: SignalData) => void,
    onDataReceived: (peerId: string, data: ArrayBuffer | string) => void,
    onConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void
  ) {
    selfId = selfId;
    this.selfId = selfId;
    this.sendSignal = sendSignal;
    this.onDataReceived = onDataReceived;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  public updateSelfId(id: string) {
    this.selfId = id;
  }

  private getConfiguration(): RTCConfiguration {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };
  }

  public getOrCreateConnection(targetPeerId: string, isInitiator = false): RTCPeerConnection {
    let pc = this.peerConnections.get(targetPeerId);
    if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
      return pc;
    }

    pc = new RTCPeerConnection(this.getConfiguration());
    this.peerConnections.set(targetPeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetPeerId, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(targetPeerId, pc!.connectionState);
      if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        this.cleanupPeer(targetPeerId);
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('fileTransfer', {
        ordered: true,
      });
      this.setupDataChannel(targetPeerId, dc);
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(targetPeerId, event.channel);
      };
    }

    return pc;
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      // Data channel open
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
    };

    dc.onerror = (err) => {
      console.warn(`DataChannel error with ${peerId}:`, err);
    };

    dc.onmessage = (event) => {
      this.onDataReceived(peerId, event.data);
    };
  }

  public async initiateConnection(targetPeerId: string): Promise<boolean> {
    try {
      const pc = this.getOrCreateConnection(targetPeerId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(targetPeerId, {
        type: 'offer',
        sdp: offer,
      });
      return true;
    } catch (err) {
      console.warn('Failed to initiate WebRTC connection:', err);
      return false;
    }
  }

  public async handleSignal(senderId: string, signal: SignalData) {
    try {
      if (signal.type === 'offer' && signal.sdp) {
        const pc = this.getOrCreateConnection(senderId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(senderId, {
          type: 'answer',
          sdp: answer,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        const pc = this.peerConnections.get(senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        const pc = this.peerConnections.get(senderId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err) {
      console.warn('Error handling WebRTC signal:', err);
    }
  }

  public isDataChannelOpen(targetPeerId: string): boolean {
    const dc = this.dataChannels.get(targetPeerId);
    return !!dc && dc.readyState === 'open';
  }

  public getDataChannel(targetPeerId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(targetPeerId);
  }

  public cleanupPeer(peerId: string) {
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      try { dc.close(); } catch {}
      this.dataChannels.delete(peerId);
    }
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(peerId);
    }
  }

  public cleanupAll() {
    for (const [id] of this.peerConnections) {
      this.cleanupPeer(id);
    }
  }
}
