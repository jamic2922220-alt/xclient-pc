const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xc', {
  store: { get: () => ipcRenderer.invoke('store:get'), set: (o) => ipcRenderer.invoke('store:set', o) },
  writeCfg: (t) => ipcRenderer.invoke('cfg:write', t),
  info: () => ipcRenderer.invoke('sys:info'),
  launch: (o) => ipcRenderer.invoke('game:launch', o),
  msList: () => ipcRenderer.invoke('ms:list'),
  query: (a, p) => ipcRenderer.invoke('srv:query', a, p),
  queryMany: (l) => ipcRenderer.invoke('srv:queryMany', l),
  lan: () => ipcRenderer.invoke('srv:lan'),
  get: (u) => ipcRenderer.invoke('net:get', u),
  maps: () => ipcRenderer.invoke('maps:list'),
  onServer: (cb) => ipcRenderer.on('srv:one', (e, r) => cb(r)),
  onLan: (cb) => ipcRenderer.on('srv:lanOne', (e, r) => cb(r)),
  min: () => ipcRenderer.send('win:min'),
  close: () => ipcRenderer.send('win:close'),
  openUrl: (u) => ipcRenderer.send('open:url', u),
  openFolder: (s) => ipcRenderer.send('open:folder', s),
});
