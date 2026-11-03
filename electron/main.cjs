const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
let startEmbeddedServer;
try {
  startEmbeddedServer = require('./embedded-server.bundle.cjs').startEmbeddedServer;
} catch (e) {
  startEmbeddedServer = require('./embedded-server.cjs').startEmbeddedServer;
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let embeddedServer = null;
const PORT = 3000;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'WiFi LAN File Drop - দ্রুত পিসি ফাইল ট্রান্সফার',
    icon: iconPath,
    backgroundColor: '#0a0f1d',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // When window is ready to display
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      // mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Open external links in user's default browser instead of electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load URL or local index
  const targetUrl = `http://localhost:${PORT}`;
  
  // Try loading local server
  const loadWithRetry = (attempts = 10, delay = 500) => {
    mainWindow.loadURL(targetUrl).catch((err) => {
      if (attempts > 0) {
        setTimeout(() => loadWithRetry(attempts - 1, delay), delay);
      } else {
        // Fallback to direct file loading if server doesn't respond
        const indexPath = path.join(__dirname, '../dist/index.html');
        mainWindow.loadFile(indexPath).catch((fileErr) => {
          console.error('Failed to load application:', fileErr);
        });
      }
    });
  };

  loadWithRetry();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Second instance focus
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    const result = await startEmbeddedServer(PORT);
    if (result && result.server) {
      embeddedServer = result.server;
    }
  } catch (err) {
    console.error('Embedded server startup error:', err);
  }

  // Register IPC handlers
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.on('open-external', (_event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle('open-path', async (_event, folderPath) => {
    if (folderPath) {
      const res = await shell.openPath(folderPath);
      return res === ''; // empty string means success
    }
    return false;
  });

  ipcMain.handle('get-system-info', () => {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
    };
  });

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (embeddedServer) {
    embeddedServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
