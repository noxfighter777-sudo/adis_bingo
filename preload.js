const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get asset paths
  getAssetPath: (assetPath) => {
    return `app-resource://${assetPath}`;
  },
  
  // Get user data path
  getUserDataPath: () => {
    return ipcRenderer.invoke('get-user-data-path');
  },

  // App info
  getVersion: () => {
    return process.env.npm_package_version || '1.0.0';
  },

  // Platform info
  getPlatform: () => {
    return process.platform;
  }
});

// Remove console.log in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}
