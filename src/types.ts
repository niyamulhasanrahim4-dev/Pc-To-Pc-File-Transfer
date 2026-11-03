export interface PeerInfo {
  id: string;
  name: string;
  deviceType: 'desktop' | 'laptop' | 'mobile';
  os: string;
  networkTag: string;
  targetDrives?: string[];
  roomId: string;
  ip?: string;
  joinedAt: number;
}

export type TransferStatus =
  | 'waiting_approval'
  | 'queued'
  | 'transferring'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'error';

export interface TransferItem {
  id: string;
  transferId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  progress: number; // 0 - 100
  transferredBytes: number;
  speedBytesPerSec: number;
  status: TransferStatus;
  mode: 'webrtc' | 'relay';
  sourceDrive?: string;
  targetDrive?: string;
  blobUrl?: string;
  errorMsg?: string;
  startTime: number;
  endTime?: number;
}

export interface IncomingOffer {
  transferId: string;
  fromId: string;
  fromName: string;
  file: {
    name: string;
    size: number;
    type: string;
    sourceDrive?: string;
    suggestedDrive?: string;
  };
}

export interface SharedTextItem {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  timestamp: number;
  isSelf?: boolean;
}

export interface LocalNetworkInfo {
  hostname: string;
  port: number;
  localIps: { name: string; address: string; family: string }[];
  activePeersCount: number;
  drives?: string[];
}
