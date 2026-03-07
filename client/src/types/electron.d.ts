// Electron API types
export interface ElectronAPI {
  getAssetPath: (assetPath: string) => string;
  getUserDataPath: () => Promise<string>;
  getVersion: () => string;
  getPlatform: () => string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
