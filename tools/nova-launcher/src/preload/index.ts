import { contextBridge, ipcRenderer } from 'electron';
import type { LauncherApi, LauncherSnapshot, LogChannel } from '../shared/types.js';

const api: LauncherApi = {
  getSnapshot: () => ipcRenderer.invoke('launcher:getSnapshot'),
  startOrRestart: () => ipcRenderer.invoke('launcher:startOrRestart'),
  shutdownAll: () => ipcRenderer.invoke('launcher:shutdownAll'),
  openBrowser: () => ipcRenderer.invoke('launcher:openBrowser'),
  clearLogs: () => ipcRenderer.invoke('launcher:clearLogs'),
  setLogFilter: (channel: LogChannel) => ipcRenderer.invoke('launcher:setLogFilter', channel),
  onSnapshot(callback) {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: LauncherSnapshot) => callback(snapshot);
    ipcRenderer.on('launcher:snapshot', handler);
    return () => ipcRenderer.removeListener('launcher:snapshot', handler);
  },
  windowMinimize: () => ipcRenderer.invoke('launcher:windowMinimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('launcher:windowToggleMaximize'),
  windowClose: () => ipcRenderer.invoke('launcher:windowClose'),
};

contextBridge.exposeInMainWorld('launcher', api);
