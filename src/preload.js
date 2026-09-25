const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('upscayl', {
  getInfo: () => ipcRenderer.invoke('app-info'),
  selectInputFolder: () => ipcRenderer.invoke('select-input-folder'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  getThumbnail: filePath => ipcRenderer.invoke('get-thumbnail', filePath),
  openFolder: folder => ipcRenderer.invoke('open-folder', folder),
  openFile: filePath => ipcRenderer.invoke('open-file', filePath),
  ensureEngine: () => ipcRenderer.invoke('ensure-engine'),
  startBatch: options => ipcRenderer.invoke('start-batch', options),
  cancelBatch: () => ipcRenderer.invoke('cancel-batch'),
  on: (channel, handler) => {
    const allowed = new Set(['engine-progress', 'engine-status', 'engine-log', 'batch-progress', 'batch-finished']);
    if (!allowed.has(channel)) return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
