const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // App
  quitApp:      ()     => ipcRenderer.send('quit-app'),
  loginSuccess: (data) => ipcRenderer.send('login-success', data),
  logout:       ()     => ipcRenderer.send('logout'),

  // Google Auth via navegador externo
  googleAuthStart:    ()   => ipcRenderer.send('google-auth-start'),
  onGoogleAuthResult: (fn) => ipcRenderer.on('google-auth-result', (_, d) => fn(d)),
  onGoogleAuthWaiting:(fn) => ipcRenderer.on('google-auth-waiting', () => fn()),

  // Painel
  togglePanel:  ()     => ipcRenderer.send('toggle-panel'),
  setSide:      (side) => ipcRenderer.send('set-side', side),
  onPanelState: (fn)   => ipcRenderer.on('panel-state', (_, d) => fn(d)),

  // Notificações
  notify:     (title, body) => ipcRenderer.send('notify', { title, body }),
  alarmFired: ()            => ipcRenderer.send('alarm-fired'),

  // Post-its
  openPostit:         (data)            => ipcRenderer.send('open-postit', data),
  closePostit:        (id)              => ipcRenderer.send('close-postit', { id }),
  postitText:         (id, text, color) => ipcRenderer.send('postit-text', { id, text, color }),
  onPostitMoved:      (fn) => ipcRenderer.on('postit-moved',       (_, d) => fn(d)),
  onPostitClosed:     (fn) => ipcRenderer.on('postit-closed',      (_, d) => fn(d)),
  onPostitUpdated:    (fn) => ipcRenderer.on('postit-updated',     (_, d) => fn(d)),
  onPostitTextUpdate: (fn) => ipcRenderer.on('postit-text-update', (_, d) => fn(d)),

  // URL params
  getUrlParams: () => Object.fromEntries(new URLSearchParams(window.location.search))
})
