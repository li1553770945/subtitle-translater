/**
 * Electron API 类型定义
 */
export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  settings: {
    read: () => Promise<any>;
    write: (settings: any) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
