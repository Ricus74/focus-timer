const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, Notification, screen
} = require('electron')
const path = require('path')

let mainWin    = null
let tray       = null
let postitWins = {}
let panelSide  = 'right'
let panelOpen  = false

const PANEL_W_OPEN   = 400
const PANEL_W_CLOSED = 36

function getWorkArea() {
  return screen.getPrimaryDisplay().workAreaSize
}

function getPanelBounds(open) {
  const { width: sw, height: sh } = getWorkArea()
  const w = open ? PANEL_W_OPEN : PANEL_W_CLOSED
  const x = panelSide === 'right' ? sw - w : 0
  return { x, y: 0, width: w, height: sh }
}

function createMainWindow() {
  const bounds = getPanelBounds(false)
  mainWin = new BrowserWindow({
    ...bounds,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Focus Timer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWin.loadFile('index.html')
  mainWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })
  mainWin.on('close', e => { if (!app.isQuiting) e.preventDefault() })
}

function togglePanel() {
  panelOpen = !panelOpen
  mainWin.setBounds(getPanelBounds(panelOpen), true)
  mainWin.webContents.send('panel-state', { open: panelOpen, side: panelSide })
}

function openPanel() {
  if (!panelOpen) togglePanel()
}

function setSide(side) {
  panelSide = side
  mainWin.setBounds(getPanelBounds(panelOpen), true)
  mainWin.webContents.send('panel-state', { open: panelOpen, side: panelSide })
}

// ── post-its como janelas desktop independentes ──
function createPostitWindow(data) {
  const { id, x, y, w, h, color, text } = data
  if (postitWins[id] && !postitWins[id].isDestroyed()) return

  const { width: sw, height: sh } = getWorkArea()
  const win = new BrowserWindow({
    x: Math.min(x || 200, sw - 220),
    y: Math.min(y || 200, sh - 180),
    width: w || 200,
    height: h || 160,
    minWidth: 160,
    minHeight: 120,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const params = new URLSearchParams({
    mode: 'postit', id,
    color: encodeURIComponent(color || '#FAF0A0'),
    text:  encodeURIComponent(text  || '')
  })
  win.loadFile('index.html', { search: params.toString() })
  win.setVisibleOnAllWorkspaces(true)
  postitWins[id] = win

  const saveBounds = () => {
    if (win.isDestroyed()) return
    const b = win.getBounds()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('postit-moved', { id, x: b.x, y: b.y, w: b.width, h: b.height })
    }
  }
  win.on('moved', saveBounds)
  win.on('resized', saveBounds)
  win.on('closed', () => {
    delete postitWins[id]
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('postit-closed', { id })
    }
  })
}

function closePostitWindow(id) {
  if (postitWins[id] && !postitWins[id].isDestroyed()) {
    postitWins[id].destroy()
    delete postitWins[id]
  }
}

function updatePostitText(id, text, color) {
  if (postitWins[id] && !postitWins[id].isDestroyed()) {
    postitWins[id].webContents.send('postit-text-update', { text, color })
  }
}

// ── IPC ──
ipcMain.on('toggle-panel',    ()         => togglePanel())
ipcMain.on('set-side',        (e, side)  => setSide(side))
ipcMain.on('open-postit',     (e, data)  => createPostitWindow(data))
ipcMain.on('close-postit',    (e, { id }) => closePostitWindow(id))
ipcMain.on('postit-text',     (e, { id, text, color }) => {
  updatePostitText(id, text, color)
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('postit-updated', { id, text, color })
  }
})
ipcMain.on('notify',      (e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show()
})
ipcMain.on('alarm-fired', () => { openPanel() })

// ── bandeja ──
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Mostrar/ocultar painel', click: () => togglePanel() },
    { type: 'separator' },
    { label: 'Lado direito',  type: 'radio', checked: panelSide === 'right', click: () => setSide('right') },
    { label: 'Lado esquerdo', type: 'radio', checked: panelSide === 'left',  click: () => setSide('left')  },
    { type: 'separator' },
    { label: 'Sair', click: () => { app.isQuiting = true; app.quit() } }
  ])
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty())
  tray.setToolTip('Focus Timer')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => togglePanel())
}

// ── init ──
app.whenReady().then(() => {
  createMainWindow()
  createTray()
})
app.on('window-all-closed', () => {})
app.on('before-quit', () => { app.isQuiting = true })
