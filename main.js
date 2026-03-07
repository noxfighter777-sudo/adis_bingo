const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;
  let serverProcess;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'client/public/go_bingo.png'),
      show: false
    });

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Load the app
    const startUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5000' 
      : 'http://localhost:5000';
    
    mainWindow.loadURL(startUrl);

    // Disable DevTools in production
    if (process.env.NODE_ENV === 'production') {
      mainWindow.webContents.setDevToolsWebContents(null);
      mainWindow.webContents.on('devtools-opened', () => {
        mainWindow.webContents.closeDevTools();
      });
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
      if (serverProcess) {
        serverProcess.kill();
      }
    });
  }

  // Register custom protocol for secure asset loading
  function registerCustomProtocol() {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'app-resource',
        privileges: {
          standard: true,
          secure: true,
          allowServiceWorkers: true,
          supportFetchAPI: true,
          corsEnabled: true
        }
      }
    ]);

    app.whenReady().then(() => {
      protocol.registerFileProtocol('app-resource', (request, callback) => {
        const url = request.url.substr(16); // Remove 'app-resource://' prefix
        const assetPath = app.isPackaged 
          ? path.join(process.resourcesPath, 'app.asar', url)
          : path.join(__dirname, url);
        
        callback({ path: assetPath });
      });
    });
  }

  app.whenReady().then(() => {
    registerCustomProtocol();
    
    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Set environment variables for database paths
    process.env.USER_DATA_PATH = userDataPath;
    process.env.PRISMA_DATABASE_URL = `file:${path.join(userDataPath, 'bingo.db')}`;
    process.env.SESSION_DB_PATH = path.join(userDataPath, 'sessions.db');

    // Start Express server in separate process
    serverProcess = fork(path.join(__dirname, 'server/index.js'), {
      silent: false,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production'
      }
    });

    // Wait a moment for server to start
    setTimeout(() => {
      createWindow();
    }, 2000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  // Handle second instance
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
