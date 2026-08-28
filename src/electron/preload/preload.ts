// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Secure Preload Context Bridge
// ─────────────────────────────────────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron';

export interface SpeechData {
  text: string;
  duration?: number;
}

export interface GrumpyDuckApi {
  getSpriteConfigs: () => Promise<any>;
  getInitialState: () => Promise<string>;
  onStateChanged: (callback: (state: string) => void) => () => void;
  onShowSpeech: (callback: (data: SpeechData) => void) => () => void;
  onBounce: (callback: () => void) => () => void;
  notifyClick: () => void;
  notifyDragStart: () => void;
  notifyDragMove: (pos: { x: number; y: number }) => void;
  notifyDragEnd: (pos?: { x: number; y: number }) => void;
  showContextMenu: () => void;
  scanDirectory: (path: string) => Promise<void>;
}

const api: GrumpyDuckApi = {
  getSpriteConfigs: () => ipcRenderer.invoke('pet:get-sprite-configs'),
  getInitialState: () => ipcRenderer.invoke('pet:get-state'),
  onStateChanged: (callback) => {
    const handler = (_event: any, state: string) => callback(state);
    ipcRenderer.on('pet:state-changed', handler);
    return () => ipcRenderer.removeListener('pet:state-changed', handler);
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
};

contextBridge.exposeInMainWorld('grumpyDuckApi', api);
