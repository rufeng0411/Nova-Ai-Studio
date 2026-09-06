"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    getSnapshot: () => electron_1.ipcRenderer.invoke('launcher:getSnapshot'),
    startOrRestart: () => electron_1.ipcRenderer.invoke('launcher:startOrRestart'),
    shutdownAll: () => electron_1.ipcRenderer.invoke('launcher:shutdownAll'),
    openBrowser: () => electron_1.ipcRenderer.invoke('launcher:openBrowser'),
    clearLogs: () => electron_1.ipcRenderer.invoke('launcher:clearLogs'),
    setLogFilter: (channel) => electron_1.ipcRenderer.invoke('launcher:setLogFilter', channel),
    onSnapshot(callback) {
        const handler = (_event, snapshot) => callback(snapshot);
        electron_1.ipcRenderer.on('launcher:snapshot', handler);
        return () => electron_1.ipcRenderer.removeListener('launcher:snapshot', handler);
    },
    windowMinimize: () => electron_1.ipcRenderer.invoke('launcher:windowMinimize'),
    windowToggleMaximize: () => electron_1.ipcRenderer.invoke('launcher:windowToggleMaximize'),
    windowClose: () => electron_1.ipcRenderer.invoke('launcher:windowClose'),
};
electron_1.contextBridge.exposeInMainWorld('launcher', api);
