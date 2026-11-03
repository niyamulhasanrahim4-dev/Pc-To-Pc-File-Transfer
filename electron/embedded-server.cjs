const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { WebSocketServer, WebSocket } = require('ws');

function startEmbeddedServer(preferredPort = 3000) {
  return new Promise((resolve, reject) => {
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
    const clients = new Map();

    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      try {
        const urlObj = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
        if (urlObj.pathname === '/ws') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      } catch (err) {
        socket.destroy();
      }
    });

    function broadcastToRoom(roomId, message, excludeWs) {
      const payload = JSON.stringify(message);
      for (const [ws, peer] of clients.entries()) {
        if (ws.readyState === WebSocket.OPEN && peer.roomId === roomId && ws !== excludeWs) {
          ws.send(payload);
        }
      }
    }

    function sendToPeer(targetPeerId, message) {
      const payload = JSON.stringify(message);
      // 1. Direct ID match
      for (const [ws, peer] of clients.entries()) {
        if (ws.readyState === WebSocket.OPEN && peer.id === targetPeerId) {
          ws.send(payload);
          return true;
        }
      }

      // 2. IP address match
      const cleanTarget = (targetPeerId || '').replace(/^peer-/, '').replace(/-/g, '.');
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

    function getRoomPeers(roomId) {
      const list = [];
      for (const [ws, peer] of clients.entries()) {
        if (ws.readyState === WebSocket.OPEN && peer.roomId === roomId) {
          list.push(peer);
        }
      }
      return list;
    }

    wss.on('connection', (ws, req) => {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const type = msg.type;

          switch (type) {
            case 'join': {
              const clientCleanIp = clientIp.replace(/^.*:/, '');
              const peerInfo = {
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

              const peers = getRoomPeers(peerInfo.roomId).filter((p) => p.id !== peerInfo.id);
              ws.send(JSON.stringify({
                type: 'room:peers',
                selfId: peerInfo.id,
                detectedIp: peerInfo.ip,
                peers,
              }));

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

                broadcastToRoom(oldRoom, {
                  type: 'peer:left',
                  peerId: existing.id,
                }, ws);

                existing.roomId = newRoom;

                const peers = getRoomPeers(newRoom).filter((p) => p.id !== existing.id);
                ws.send(JSON.stringify({
                  type: 'room:peers',
                  selfId: existing.id,
                  peers,
                }));

                broadcastToRoom(newRoom, {
                  type: 'peer:joined',
                  peer: existing,
                }, ws);
              }
              break;
            }

            case 'signal': {
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
                const peers = getRoomPeers(peer.roomId).filter((p) => p.id !== peer.id);
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
              let matchedPeer;

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

            default:
              break;
          }
        } catch (err) {
          console.error('[Embedded Server] WS message error:', err);
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

    function detectLocalDrives() {
      const drives = [];
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
          } catch (e) {}
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

    // Endpoint for network info
    app.get('/api/network-info', (_req, res) => {
      const nets = os.networkInterfaces();
      const results = [];

      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
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
        port: preferredPort,
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
      const fromPeer = req.body && req.body.peer;
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
        let targetPath = ((req.query.path) || (req.query.drive) || 'C:\\').trim();
        if (targetPath.toLowerCase() === 'downloads' || targetPath.toLowerCase().startsWith('downloads')) {
          targetPath = path.join(os.homedir(), 'Downloads');
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
      } catch (err) {
        res.json({ success: false, error: err.message, folders: [] });
      }
    });

    // Create a new folder on the PC
    app.post('/api/create-folder', (req, res) => {
      try {
        const folderPath = req.body && req.body.path;
        if (!folderPath) {
          return res.status(400).json({ success: false, error: 'Path required' });
        }
        let cleanPath = folderPath.trim();
        if (cleanPath.toLowerCase().startsWith('downloads')) {
          const sub = cleanPath.replace(/^downloads[\\\/]?/i, '');
          cleanPath = path.join(os.homedir(), 'Downloads', sub);
        }
        fs.mkdirSync(cleanPath, { recursive: true });
        res.json({ success: true, createdPath: cleanPath });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Normalize destination paths, supporting Desktop, drive roots and subfolders (e.g. D:\Rahim File Transfer)
    function normalizeTargetPath(rawPath) {
      let target = (rawPath || '').trim();
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

      if (/^[a-zA-Z]:$/.test(target)) {
        target += '\\';
      }

      return path.normalize(target);
    }

    // Direct save file to disk on destination PC with streaming & directory creation
    app.post('/api/save-file', (req, res) => {
      try {
        const rawFileName = req.headers['x-file-name'] || 'received-file';
        const decodedFileName = decodeURIComponent(rawFileName);
        const rawTargetPath = req.headers['x-target-path'] || 'Desktop';
        const targetDir = normalizeTargetPath(decodeURIComponent(rawTargetPath));

        const isRootDrive = /^[a-zA-Z]:[\\\/]?$/.test(targetDir);
        if (!isRootDrive && !fs.existsSync(targetDir)) {
          try {
            fs.mkdirSync(targetDir, { recursive: true });
          } catch (e) {}
        }

        let effectiveDir = targetDir;
        if (!isRootDrive && !fs.existsSync(effectiveDir)) {
          effectiveDir = path.join(os.homedir(), 'Desktop');
          if (!fs.existsSync(effectiveDir)) {
            effectiveDir = path.join(os.homedir(), 'Downloads');
          }
        }

        const fullFilePath = path.join(effectiveDir, decodedFileName);
        // Recursively create any parent directory for nested folder transfers
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
            ? decodeURIComponent(req.headers['x-sender-name'])
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
          console.error('[SaveFile] Stream error:', err);
          res.status(500).json({ success: false, error: err.message });
        });

        req.on('error', (err) => {
          console.error('[SaveFile] Request error:', err);
          writeStream.destroy();
          res.status(500).json({ success: false, error: err.message });
        });
      } catch (err) {
        console.error('[SaveFile] Error saving file to disk:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Open folder in Windows File Explorer
    app.post('/api/open-folder', (req, res) => {
      try {
        const rawPath = (req.body && req.body.path) || path.join(os.homedir(), 'Downloads');
        const folderPath = normalizeTargetPath(rawPath);
        if (process.platform === 'win32') {
          exec(`explorer.exe "${folderPath}"`);
        }
        res.json({ success: true, openedPath: folderPath });
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    });

    // Static assets
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });

    server.listen(preferredPort, '0.0.0.0', () => {
      console.log(`[Embedded Server] Running on http://localhost:${preferredPort}`);
      resolve({ server, port: preferredPort });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Embedded Server] Port ${preferredPort} in use, assuming external server is running.`);
        resolve({ server: null, port: preferredPort });
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { startEmbeddedServer };
