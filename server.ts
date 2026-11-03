import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AI Studio dev server must strictly run on port 3000
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '100mb' }));

// Enable CORS for LAN cross-origin communication between multiple PCs
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const server = http.createServer(app);

// Peer structure
interface PeerInfo {
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

// Map ws -> PeerInfo
const clients = new Map<WebSocket, PeerInfo>();

// WebSocket Server for LAN auto-discovery and WebRTC signaling
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const [ws, peer] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN && peer.roomId === roomId && ws !== excludeWs) {
      ws.send(payload);
    }
  }
}

function sendToPeer(targetPeerId: string, message: any) {
  const payload = JSON.stringify(message);
  // 1. Direct ID match
  for (const [ws, peer] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN && peer.id === targetPeerId) {
      ws.send(payload);
      return true;
    }
  }

  // 2. IP address match
  const cleanTarget = targetPeerId.replace(/^peer-/, '').replace(/-/g, '.');
  for (const [ws, peer] of clients.entries()) {
    if (
      ws.readyState === WebSocket.OPEN &&
      peer.ip &&
      (peer.ip === cleanTarget || targetPeerId.includes(peer.ip) || peer.id.includes(targetPeerId))
    ) {
      ws.send(payload);
      return true;
    }
  }

  // 3. Fallback: if only one other client is connected, route to it
  const activeClients = Array.from(clients.entries()).filter(([ws]) => ws.readyState === WebSocket.OPEN);
  if (activeClients.length === 2) {
    const other = activeClients.find(([_, p]) => p.id !== message.fromId);
    if (other) {
      other[0].send(payload);
      return true;
    }
  }

  return false;
}

function getRoomPeers(roomId: string): PeerInfo[] {
  const list: PeerInfo[] = [];
  for (const [ws, peer] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN && peer.roomId === roomId) {
      list.push(peer);
    }
  }
  return list;
}

wss.on('connection', (ws, req) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '';

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const type = msg.type;

      switch (type) {
        case 'join': {
          const clientCleanIp = clientIp.replace(/^.*:/, '');
          const peerInfo: PeerInfo = {
            id: msg.id,
            name: msg.name || 'PC / Laptop',
            deviceType: msg.deviceType || 'desktop',
            os: msg.os || 'Windows',
            networkTag: msg.networkTag || 'Wi-Fi Dongle',
            targetDrives: msg.targetDrives || ['C:\\', 'D:\\', 'E:\\', 'Downloads'],
            roomId: msg.roomId || 'local-mesh',
            ip: msg.ip || clientCleanIp || '192.168.1.x',
            joinedAt: Date.now(),
          };
          clients.set(ws, peerInfo);

          // Reply with current peers in room and detected IP
          const peers = getRoomPeers(peerInfo.roomId).filter(p => p.id !== peerInfo.id);
          ws.send(JSON.stringify({
            type: 'room:peers',
            selfId: peerInfo.id,
            detectedIp: peerInfo.ip,
            peers,
          }));

          // Notify others in room
          broadcastToRoom(peerInfo.roomId, {
            type: 'peer:joined',
            peer: peerInfo,
          }, ws);
          break;
        }

        case 'update:profile': {
          const existing = clients.get(ws);
          if (existing) {
            existing.name = msg.name ?? existing.name;
            existing.targetDrives = msg.targetDrives ?? existing.targetDrives;
            existing.networkTag = msg.networkTag ?? existing.networkTag;
            existing.ip = msg.ip ?? existing.ip;

            broadcastToRoom(existing.roomId, {
              type: 'peer:updated',
              peer: existing,
            });
          }
          break;
        }

        case 'switch:room': {
          const existing = clients.get(ws);
          if (existing) {
            const oldRoom = existing.roomId;
            const newRoom = msg.newRoomId || 'local-mesh';
            
            // Notify old room
            broadcastToRoom(oldRoom, {
              type: 'peer:left',
              peerId: existing.id,
            }, ws);

            existing.roomId = newRoom;

            // Send peers in new room
            const peers = getRoomPeers(newRoom).filter(p => p.id !== existing.id);
            ws.send(JSON.stringify({
              type: 'room:peers',
              selfId: existing.id,
              peers,
            }));

            // Notify new room
            broadcastToRoom(newRoom, {
              type: 'peer:joined',
              peer: existing,
            }, ws);
          }
          break;
        }

        case 'signal': {
          // WebRTC signaling: offer, answer, ice-candidate
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'signal',
              fromId: msg.fromId,
              data: msg.data,
            });
          }
          break;
        }

        case 'file:offer': {
          // Send transfer request to recipient
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'file:offer',
              fromId: msg.fromId,
              file: msg.file,
              transferId: msg.transferId,
            });
          }
          break;
        }

        case 'file:response': {
          // Recipient accepted or declined
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'file:response',
              fromId: msg.fromId,
              transferId: msg.transferId,
              accepted: msg.accepted,
              chosenDrive: msg.chosenDrive,
              reason: msg.reason,
            });
          }
          break;
        }

        case 'file:relay:chunk': {
          // Fallback direct relay via WebSocket if WebRTC P2P is not direct
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'file:relay:chunk',
              fromId: msg.fromId,
              transferId: msg.transferId,
              chunkIndex: msg.chunkIndex,
              totalChunks: msg.totalChunks,
              data: msg.data,
            });
          }
          break;
        }

        case 'file:cancel': {
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'file:cancel',
              fromId: msg.fromId,
              transferId: msg.transferId,
            });
          }
          break;
        }

        case 'batch:complete': {
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'batch:complete',
              fromId: msg.fromId,
            });
          }
          break;
        }

        case 'scan:request': {
          const peer = clients.get(ws);
          if (peer) {
            const peers = getRoomPeers(peer.roomId).filter(p => p.id !== peer.id);
            ws.send(JSON.stringify({
              type: 'scan:response',
              peers,
            }));
          }
          break;
        }

        case 'pair:request': {
          if (msg.targetId) {
            const sender = clients.get(ws);
            sendToPeer(msg.targetId, {
              type: 'pair:request',
              fromPeer: sender,
              autoAccept: msg.autoAccept ?? true,
            });
          }
          break;
        }

        case 'pair:accept': {
          if (msg.targetId) {
            const sender = clients.get(ws);
            sendToPeer(msg.targetId, {
              type: 'pair:accepted',
              fromPeer: sender,
              targetId: msg.targetId,
            });
            ws.send(JSON.stringify({
              type: 'pair:confirmed',
              pairedWithId: msg.targetId,
            }));
          }
          break;
        }

        case 'pair:disconnect': {
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'pair:disconnected',
              fromId: msg.fromId,
            });
          }
          break;
        }

        case 'pair:by-ip': {
          const rawTarget = (msg.targetIp || '').trim().toLowerCase();
          const cleanTarget = rawTarget.replace(/^https?:\/\//, '').replace(/:[0-9]+.*$/, '').trim();

          const sender = clients.get(ws);
          let matchedPeer: PeerInfo | undefined;

          for (const [pws, peer] of clients.entries()) {
            if (peer.id !== msg.fromId) {
              const peerIp = (peer.ip || '').toLowerCase();
              if (
                peerIp === cleanTarget ||
                peerIp.includes(cleanTarget) ||
                cleanTarget.includes(peerIp) ||
                peer.name.toLowerCase().includes(cleanTarget)
              ) {
                matchedPeer = peer;
                break;
              }
            }
          }

          if (matchedPeer) {
            sendToPeer(matchedPeer.id, {
              type: 'pair:request',
              fromPeer: sender,
              autoAccept: true,
            });
            ws.send(JSON.stringify({
              type: 'pair:ip-found',
              peer: matchedPeer,
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'pair:ip-not-found',
              searchedIp: msg.targetIp,
            }));
          }
          break;
        }

        case 'clipboard:send': {
          // Text/link sharing
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'clipboard:received',
              fromId: msg.fromId,
              text: msg.text,
              timestamp: Date.now(),
            });
          } else {
            const peer = clients.get(ws);
            if (peer) {
              broadcastToRoom(peer.roomId, {
                type: 'clipboard:received',
                fromId: peer.id,
                text: msg.text,
                timestamp: Date.now(),
              }, ws);
            }
          }
          break;
        }

        case 'open:folder:request': {
          if (msg.targetId) {
            sendToPeer(msg.targetId, {
              type: 'open:folder:request',
              fromId: msg.fromId,
              path: msg.path,
            });
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    const peer = clients.get(ws);
    if (peer) {
      clients.delete(ws);
      broadcastToRoom(peer.roomId, {
        type: 'peer:left',
        peerId: peer.id,
      });
    }
  });

  ws.on('error', () => {
    const peer = clients.get(ws);
    if (peer) {
      clients.delete(ws);
      broadcastToRoom(peer.roomId, {
        type: 'peer:left',
        peerId: peer.id,
      });
    }
  });
});

function detectLocalDrives(): string[] {
  const drives: string[] = [];
  // Add Desktop as a top-level direct target
  drives.push('Desktop');

  if (process.platform === 'win32') {
    const letters = ['C', 'D', 'E', 'F', 'G', 'H'];
    for (const letter of letters) {
      try {
        if (fs.existsSync(`${letter}:\\`)) {
          if (letter === 'C') drives.push('C:\\ (System Disk)');
          else if (letter === 'D') drives.push('D:\\ (Data / Files)');
          else if (letter === 'E') drives.push('E:\\ (Storage / Media)');
          else if (letter === 'F') drives.push('F:\\ (USB / External)');
          else drives.push(`${letter}:\\ (Drive ${letter})`);
        }
      } catch {}
    }
  }
  if (drives.length <= 1) {
    drives.push('C:\\ (System / Local Disk)');
    drives.push('D:\\ (Data / Files)');
    drives.push('E:\\ (Storage / Backup)');
  }
  drives.push('Downloads');
  return drives;
}

// Endpoint to get server LAN network addresses
app.get('/api/network-info', (_req, res) => {
  const nets = os.networkInterfaces();
  const results: { name: string; address: string; family: string }[] = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push({
          name,
          address: net.address,
          family: net.family,
        });
      }
    }
  }

  res.json({
    hostname: os.hostname(),
    port: PORT,
    localIps: results,
    activePeersCount: clients.size,
    drives: detectLocalDrives(),
  });
});

app.get('/api/system-drives', (_req, res) => {
  res.json({ drives: detectLocalDrives() });
});

app.get('/api/peers', (_req, res) => {
  const peers = Array.from(clients.values());
  res.json({ peers });
});

app.post('/api/direct-connect', (req, res) => {
  const fromPeer = req.body?.peer;
  if (fromPeer) {
    broadcastToRoom(fromPeer.roomId || 'local-mesh', {
      type: 'peer:joined',
      peer: fromPeer,
    });
    broadcastToRoom(fromPeer.roomId || 'local-mesh', {
      type: 'pair:request',
      fromPeer: fromPeer,
      autoAccept: true,
    });
  }
  const peers = Array.from(clients.values());
  res.json({ success: true, peers });
});

// Browse subfolders on a given drive / directory
app.get('/api/browse-folders', (req, res) => {
  try {
    let targetPath = ((req.query.path as string) || (req.query.drive as string) || 'Desktop').trim();
    if (targetPath.toLowerCase() === 'desktop' || targetPath.toLowerCase().startsWith('desktop')) {
      const sub = targetPath.replace(/^desktop[\\\/]?/i, '').trim();
      targetPath = sub ? path.join(os.homedir(), 'Desktop', sub) : path.join(os.homedir(), 'Desktop');
    } else if (targetPath.toLowerCase() === 'downloads' || targetPath.toLowerCase().startsWith('downloads')) {
      const sub = targetPath.replace(/^downloads[\\\/]?/i, '').trim();
      targetPath = sub ? path.join(os.homedir(), 'Downloads', sub) : path.join(os.homedir(), 'Downloads');
    } else {
      targetPath = targetPath.split(' ')[0] || targetPath;
      if (!targetPath.endsWith('\\') && !targetPath.endsWith('/')) {
        targetPath += '\\';
      }
    }

    if (!fs.existsSync(targetPath)) {
      return res.json({ success: true, currentPath: targetPath, folders: [] });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('$') && !e.name.startsWith('.') && e.name !== 'System Volume Information')
      .map((e) => e.name)
      .slice(0, 60);

    res.json({ success: true, currentPath: targetPath, folders });
  } catch (err: any) {
    res.json({ success: false, error: err.message, folders: [] });
  }
});

// Create a new folder on the PC
app.post('/api/create-folder', (req, res) => {
  try {
    const folderPath = req.body?.path;
    if (!folderPath) {
      return res.status(400).json({ success: false, error: 'Path required' });
    }
    const cleanPath = normalizeTargetPath(folderPath);
    if (!fs.existsSync(cleanPath)) {
      fs.mkdirSync(cleanPath, { recursive: true });
    }
    res.json({ success: true, createdPath: cleanPath });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Normalize destination paths, supporting Desktop, drive roots and subfolders (e.g. D:\Rahim File Transfer)
function normalizeTargetPath(rawPath: string): string {
  let target = (rawPath || '').trim();
  // Strip trailing drive/folder labels like "(Data / Files)", "(System Disk)", "(ডেস্কটপ)", etc.
  target = target.replace(/\s*\([^)]*\)/gi, '').trim();

  if (target.toLowerCase() === 'desktop' || target.toLowerCase().startsWith('desktop')) {
    const sub = target.replace(/^desktop[\\\/]?/i, '').trim();
    const desktopDir = path.join(os.homedir(), 'Desktop');
    return sub ? path.join(desktopDir, sub) : desktopDir;
  }

  if (target.toLowerCase() === 'downloads' || target.toLowerCase().startsWith('downloads')) {
    const sub = target.replace(/^downloads[\\\/]?/i, '').trim();
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    return sub ? path.join(downloadsDir, sub) : downloadsDir;
  }

  // Windows drive format e.g. "D:", "D:\"
  if (/^[a-zA-Z]:$/.test(target)) {
    target += '\\';
  }

  return path.normalize(target);
}

// Direct high-speed save file to disk on destination PC with streaming (zero memory bloat)
app.post('/api/save-file', (req, res) => {
  try {
    const rawFileName = (req.headers['x-file-name'] as string) || 'received-file';
    const decodedFileName = decodeURIComponent(rawFileName);
    const rawTargetPath = (req.headers['x-target-path'] as string) || 'Desktop';
    const targetDir = normalizeTargetPath(decodeURIComponent(rawTargetPath));

    // CRITICAL: On Windows, calling fs.mkdirSync('D:\\') throws EPERM because drive roots cannot be created!
    // Only call mkdirSync if directory does not exist and is NOT a root drive:
    const isRootDrive = /^[a-zA-Z]:[\\\/]?$/.test(targetDir);
    if (!isRootDrive && !fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Verify if directory is accessible; if specified drive doesn't exist on this machine, fallback to Desktop
    let effectiveDir = targetDir;
    if (!fs.existsSync(effectiveDir)) {
      effectiveDir = path.join(os.homedir(), 'Desktop');
      if (!fs.existsSync(effectiveDir)) {
        effectiveDir = path.join(os.homedir(), 'Downloads');
      }
    }

    const fullFilePath = path.join(effectiveDir, decodedFileName);
    // Recursively ensure any parent folders exist (for dropped folders and nested directories)
    const parentDir = path.dirname(fullFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(fullFilePath);
    let bytesWritten = 0;

    req.on('data', (chunk) => {
      bytesWritten += chunk.length;
    });

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      console.log(`[SaveFile] Successfully saved ${decodedFileName} (${bytesWritten} bytes) to ${fullFilePath}`);
      const senderName = req.headers['x-sender-name']
        ? decodeURIComponent(req.headers['x-sender-name'] as string)
        : 'Connected PC';

      broadcastToRoom('local-mesh', {
        type: 'file:disk:received',
        fileName: decodedFileName,
        fileSize: bytesWritten,
        targetDrive: effectiveDir,
        senderName,
        fullFilePath,
      });

      res.json({ success: true, savedPath: fullFilePath, bytesWritten });
    });

    writeStream.on('error', (err) => {
      console.error('[SaveFile] Stream write error:', err);
      res.status(500).json({ success: false, error: err.message });
    });

    req.on('error', (err) => {
      console.error('[SaveFile] Request stream error:', err);
      writeStream.destroy();
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err: any) {
    console.error('[SaveFile] Error saving file to disk:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Open folder in Windows File Explorer
app.post('/api/open-folder', (req, res) => {
  try {
    const rawPath = (req.body?.path as string) || path.join(os.homedir(), 'Downloads');
    const folderPath = normalizeTargetPath(rawPath);
    if (process.platform === 'win32') {
      exec(`explorer.exe "${folderPath}"`);
    }
    res.json({ success: true, openedPath: folderPath });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Download endpoints for built Windows executables
app.get('/api/download/status', (_req, res) => {
  const portablePath = path.resolve(__dirname, 'release/WiFi-LAN-File-Drop-Portable.zip');
  const setupPath = path.resolve(__dirname, 'release/WiFi LAN File Drop Setup 1.0.0.exe');
  const unpackedExePath = path.resolve(__dirname, 'release/win-unpacked/WiFi LAN File Drop.exe');

  res.json({
    portableAvailable: fs.existsSync(portablePath),
    setupAvailable: fs.existsSync(setupPath),
    unpackedExeAvailable: fs.existsSync(unpackedExePath),
  });
});

app.get('/api/download/portable', (_req, res) => {
  const portablePath = path.resolve(__dirname, 'release/WiFi-LAN-File-Drop-Portable.zip');
  if (fs.existsSync(portablePath)) {
    return res.download(portablePath, 'WiFi-LAN-File-Drop-Windows-Portable.zip');
  }
  return res.status(404).send('Portable build archive not found. Please build first.');
});

app.get('/api/download/setup', (_req, res) => {
  const setupPath = path.resolve(__dirname, 'release/WiFi LAN File Drop Setup 1.0.0.exe');
  if (fs.existsSync(setupPath)) {
    return res.download(setupPath, 'WiFi-LAN-File-Drop-Setup-1.0.0.exe');
  }
  return res.status(404).send('Setup installer not found. Please build first.');
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Wi-Fi LAN File Drop server listening on port ${PORT}`);
  });
}

startServer();
