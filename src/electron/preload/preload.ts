// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Secure Preload Context Bridge
// ─────────────────────────────────────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron';

export interface SpeechData {
  text: string;
  duration?: number;
  buttonText?: string;
  action?: string;
}

export interface DebugData {
  isDebug: boolean;
  state: string;
  platform: any;
  position: { x: number; y: number };
}

export interface GrumpyDuckApi {
  getSpriteConfigs: () => Promise<any>;
  getInitialState: () => Promise<string>;
  getDebugState: () => Promise<DebugData>;
  onStateChanged: (callback: (state: string) => void) => () => void;
  onPlatformChanged: (callback: (platform: any) => void) => () => void;
  onDebugChanged: (callback: (debug: DebugData) => void) => () => void;
  onShowSpeech: (callback: (data: SpeechData) => void) => () => void;
  onBounce: (callback: () => void) => () => void;
  notifyClick: () => void;
  notifyDragStart: () => void;
  notifyDragMove: (pos: { x: number; y: number }) => void;
  notifyDragEnd: (pos?: { x: number; y: number }) => void;
  showContextMenu: () => void;
  scanDirectory: (path: string) => Promise<void>;
  openCleanupWindow: () => Promise<void>;
  getCleanupData: () => Promise<any>;
  revealInFinder: (filePath: string) => Promise<boolean>;
  moveToTrash: (filePath: string) => Promise<{ success: boolean; error?: string; size?: number; reclaimedBytes?: number }>;
  moveToTrashBatch: (filePaths: string[]) => Promise<{ successCount: number; failureCount: number; reclaimedBytes?: number }>;
  onCleanupDataUpdated: (callback: (data: any) => void) => () => void;
  notifyPetSpeech: (text: string, duration?: number) => void;
}

const api: GrumpyDuckApi = {
  getSpriteConfigs: () => ipcRenderer.invoke('pet:get-sprite-configs'),
  getInitialState: () => ipcRenderer.invoke('pet:get-state'),
  getDebugState: () => ipcRenderer.invoke('pet:get-debug-state'),
  onStateChanged: (callback) => {
    const handler = (_event: any, state: string) => callback(state);
    ipcRenderer.on('pet:state-changed', handler);
    return () => ipcRenderer.removeListener('pet:state-changed', handler);
  },
  onPlatformChanged: (callback) => {
    const handler = (_event: any, platform: any) => callback(platform);
    ipcRenderer.on('pet:platform-changed', handler);
    return () => ipcRenderer.removeListener('pet:platform-changed', handler);
  },
  onDebugChanged: (callback) => {
    const handler = (_event: any, debug: DebugData) => callback(debug);
    ipcRenderer.on('pet:debug-changed', handler);
    return () => ipcRenderer.removeListener('pet:debug-changed', handler);
  },
  onShowSpeech: (callback) => {
    const handler = (_event: any, data: SpeechData) => callback(data);
    ipcRenderer.on('pet:show-speech', handler);
    return () => ipcRenderer.removeListener('pet:show-speech', handler);
  },
  onBounce: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('pet:bounce', handler);
    return () => ipcRenderer.removeListener('pet:bounce', handler);
  },
  notifyClick: () => ipcRenderer.send('pet:on-click'),
  notifyDragStart: () => ipcRenderer.send('pet:drag-start'),
  notifyDragMove: (pos) => ipcRenderer.send('pet:drag-move', pos),
  notifyDragEnd: (pos) => ipcRenderer.send('pet:drag-end', pos),
  showContextMenu: () => ipcRenderer.send('pet:show-context-menu'),
  scanDirectory: (path: string) => ipcRenderer.invoke('pet:scan-directory', path),
  openCleanupWindow: () => ipcRenderer.invoke('pet:open-cleanup-window'),
  getCleanupData: () => ipcRenderer.invoke('pet:get-cleanup-data'),
  revealInFinder: (filePath: string) => ipcRenderer.invoke('pet:reveal-in-finder', filePath),
  moveToTrash: (filePath: string) => ipcRenderer.invoke('pet:trash-item', filePath),
  moveToTrashBatch: (filePaths: string[]) => ipcRenderer.invoke('pet:trash-batch', filePaths),
  onCleanupDataUpdated: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('cleanup:data-updated', handler);
    return () => ipcRenderer.removeListener('cleanup:data-updated', handler);
  },
  notifyPetSpeech: (text: string, duration?: number) => ipcRenderer.send('pet:custom-speech', { text, duration }),
};

contextBridge.exposeInMainWorld('grumpyDuckApi', api);
