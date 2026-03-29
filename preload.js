const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Painel
  togglePanel: ()       => ipcRenderer.send('toggle-panel'),
  setSide:     (side)   => ipcRenderer.send('set-side', side),
  onPanelState:(fn)     => ipcRenderer.on('panel-state', (e, data) => fn(data)),

  // Notificações
  notify:     (title, body) => ipcRenderer.send('notify', { title, body }),
  alarmFired: ()            => ipcRenderer.send('alarm-fired'),

  // Post-its (painel → main)
  openPostit:  (data)       => ipcRenderer.send('open-postit', data),
  closePostit: (id)         => ipcRenderer.send('close-postit', { id }),
  postitText:  (id, text, color) => ipcRenderer.send('postit-text', { id, text, color }),

  // Post-its (main → painel): posição atualizada, fechado externamente
  onPostitMoved:  (fn) => ipcRenderer.on('postit-moved',   (e, d) => fn(d)),
  onPostitClosed: (fn) => ipcRenderer.on('postit-closed',  (e, d) => fn(d)),
  onPostitUpdated:(fn) => ipcRenderer.on('postit-updated', (e, d) => fn(d)),

  // Post-it window → recebe texto atualizado do painel
  onPostitTextUpdate: (fn) => ipcRenderer.on('postit-text-update', (e, d) => fn(d)),

  // Lê parâmetros da URL (para modo post-it)
  getUrlParams: () => Object.fromEntries(new URLSearchParams(window.location.search))
})
