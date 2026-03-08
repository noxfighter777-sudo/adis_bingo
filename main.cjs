const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');

// Mandatory: node-machine-id must be available
let machineId;
const possiblePaths = [];

if (app.isPackaged) {
  // Try multiple possible locations in packaged app
  possiblePaths.push(
    path.join(process.resourcesPath, 'node_modules/node-machine-id'),
    path.join(__dirname, 'node_modules/node-machine-id'),
    path.join(path.dirname(__dirname), 'node_modules/node-machine-id'),
    path.join(process.resourcesPath, 'app', 'node_modules/node-machine-id'),
    'node-machine-id'
  );
} else {
  possiblePaths.push('node-machine-id', path.join(__dirname, 'node_modules/node-machine-id'));
}

// Check if files exist before requiring
console.log('Checking for node-machine-id module...');
for (const modulePath of possiblePaths) {
  const checkPath = modulePath === 'node-machine-id' ? 
    path.join(__dirname, 'node_modules/node-machine-id') : modulePath;
  
  try {
    if (fsSync.existsSync(checkPath)) {
      console.log('Found module at:', checkPath);
      try {
        machineId = require(modulePath).machineId;
        console.log('Successfully loaded node-machine-id from:', modulePath);
        break;
      } catch (requireError) {
        console.log('Found module but require failed:', checkPath, requireError.message);
      }
    } else {
      console.log('Module not found at:', checkPath);
    }
  } catch (error) {
    console.log('Error checking path:', checkPath, error.message);
  }
}

if (!machineId) {
  console.error('FATAL: node-machine-id module is required but not found');
  console.error('Require paths attempted:');
  possiblePaths.forEach(p => console.error('  -', p));
  console.error('App path:', process.resourcesPath);
  console.error('Main path:', __dirname);
  
  // List what's actually available
  try {
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (fsSync.existsSync(nodeModulesPath)) {
      console.log('Available node_modules:', fsSync.readdirSync(nodeModulesPath).slice(0, 10));
    }
  } catch (e) {
    console.log('Could not list node_modules:', e.message);
  }
  
  process.exit(1);
}

// Professional Pathing Logic
const isPackaged = app.isPackaged;
const assetPath = isPackaged 
  ? path.join(process.resourcesPath, 'resources') 
  : path.join(__dirname, 'resources');

// Validate machine-id is working before starting app
async function validateMachineId() {
  try {
    const testId = await machineId();
    if (!testId || testId.length === 0) {
      throw new Error('Machine ID returned empty value');
    }
    console.log('Machine ID validation passed:', testId.substring(0, 8) + '...');
  } catch (error) {
    console.error('FATAL: Machine ID validation failed - app cannot start');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Global error handling with robust logging
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Log to file if possible
  try {
    const userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'error.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] UNCAUGHT EXCEPTION: ${error.stack || error.message}\n`;
    fsSync.appendFileSync(logPath, logMessage);
  } catch (logError) {
    console.error('Failed to write error log:', logError);
  }
  
  // Prevent ugly error popup and exit gracefully
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log to file if possible
  try {
    const userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'error.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] UNHANDLED REJECTION: ${reason}\nPromise: ${promise}\n`;
    fsSync.appendFileSync(logPath, logMessage);
  } catch (logError) {
    console.error('Failed to write error log:', logError);
  }
  
  // Don't exit process for unhandled rejections, but log them
  // This allows the app to continue running while logging the error
});

// Register custom protocol schemes BEFORE app is ready
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

// IPC Handlers for secure communication
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-machine-id', async () => {
  try {
    return await machineId();
  } catch (error) {
    console.error('FATAL: Failed to get machine ID - this is required for app to function');
    console.error('Error:', error);
    throw new Error('Machine ID is mandatory for application to run');
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    // Security: Validate file path to prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new Error('Invalid file path');
    }
    
    return await fs.readFile(normalizedPath, 'utf8');
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    // Security: Validate file path to prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new Error('Invalid file path');
    }
    
    // Ensure directory exists
    const dir = path.dirname(normalizedPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(normalizedPath, data, 'utf8');
  } catch (error) {
    console.error('Failed to write file:', error);
    throw error;
  }
});

ipcMain.handle('db-operation', async (event, operation, ...args) => {
  // This would integrate with your database operations
  // For now, return a placeholder
  console.log('DB Operation:', operation, args);
  return { success: true, operation, args };
});

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
      icon: path.join(assetPath, 'images/go_bingo.png'),
      show: false
    });

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Load app with proper ASAR pathing
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

  // Register custom protocol for secure asset loading with ASAR awareness
  function registerCustomProtocol() {
    app.whenReady().then(() => {
      protocol.registerFileProtocol('app-resource', (request, callback) => {
        const url = request.url.substr(16); // Remove 'app-resource://' prefix
        let assetPath;
        
        if (app.isPackaged) {
          // In production, check both unpacked and packed locations
          const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', url);
          const packedPath = path.join(process.resourcesPath, 'app.asar', url);
          
          // Try unpacked first (better for media files), then packed
          if (fs.existsSync(unpackedPath)) {
            assetPath = unpackedPath;
          } else {
            assetPath = packedPath;
          }
        } else {
          // In development, use regular path
          assetPath = path.join(__dirname, url);
        }
        
        callback({ path: assetPath });
      });
    });
  }

  app.whenReady().then(async () => {
    registerCustomProtocol();
  
    // Validate machine-id before starting app
    await validateMachineId();
    
    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Set environment variables for database paths
    const dbPath = path.join(app.getPath('userData'), 'bingo.db');
    process.env.USER_DATA_PATH = userDataPath;
    process.env.PRISMA_DATABASE_URL = `file:${dbPath}`;
    process.env.SESSION_DB_PATH = path.join(userDataPath, 'sessions.db');

    // Start Express server in separate process
    const serverPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'app.asar', 'dist', 'index.js')
      : path.join(__dirname, 'dist', 'index.js');
    
    serverProcess = fork(serverPath, {
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
