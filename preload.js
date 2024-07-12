const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  readExcel: (filePath) => ipcRenderer.invoke('read-excel', filePath),
  exportExcel: (source, compare) => {
    ipcRenderer.send('export-excel', source, compare);
  },
});
