// Electron API types
export interface ElectronAPI {
  getAssetPath: (assetPath: string) => string;
  getUserDataPath: () => Promise<string>;
  getMachineId: () => Promise<string>;
  getVersion: () => string;
  getPlatform: () => string;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, data: string) => Promise<void>;
  dbOperation: (operation: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
