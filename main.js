require('dotenv').config()
const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, Notification, screen, shell
} = require('electron')
const path  = require('path')
const http  = require('http')
const https = require('https')
const url   = require('url')
const crypto = require('crypto')

let loginWin    = null
let mainWin     = null
let tray        = null
let postitWins  = {}
let panelSide   = 'right'
let panelOpen   = false
let currentUser = null
let authServer  = null

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI  = 'http://127.0.0.1:7777/auth/callback'
const PANEL_W_OPEN   = 420
const PANEL_W_CLOSED = 36
const ICON_PATH      = path.join(__dirname, 'icon.png')

// Teste do ícone
const fs = require('fs')
if (fs.existsSync(ICON_PATH)) {
  console.log('✅ Ícone encontrado:', ICON_PATH)
  const testIcon = nativeImage.createFromPath(ICON_PATH)
  console.log('📐 Tamanho do ícone:', testIcon.getSize())
  console.log('🖼️  Ícone vazio?', testIcon.isEmpty())
} else {
  console.log('❌ Ícone NÃO encontrado:', ICON_PATH)
}

function getWorkArea() {
  return screen.getPrimaryDisplay().workAreaSize
}

function getPanelBounds(open) {
  const { width: sw, height: sh } = getWorkArea()
  const w = open ? PANEL_W_OPEN : PANEL_W_CLOSED
  const x = panelSide === 'right' ? sw - w : 0
  return { x, y: 0, width: w, height: sh }
}

// ── troca code por tokens via Google ──
function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code'
    }).toString()

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch(e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── servidor local para capturar callback do Google ──
function startAuthServer(_unused, callback) {
  if (authServer) { try { authServer.close() } catch(e){} authServer = null }

  authServer = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true)

    if (parsed.pathname !== '/auth/callback') {
      res.writeHead(404); res.end(); return
    }

    const code  = parsed.query.code
    const error = parsed.query.error

    // Página de resposta
    const successHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:sans-serif;background:#1a1a1a;color:#e8e8e8;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;}
      .icon{font-size:48px;color:#1D9E75;} p{color:#999;font-size:14px;text-align:center;line-height:1.6;}</style></head>
      <body><div class="icon">✓</div><p>Login realizado com sucesso!<br>Pode fechar esta aba e voltar ao app.</p>
      <script>setTimeout(()=>window.close(),2500)</script></body></html>`

    const errorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>*{margin:0;padding:0;}body{font-family:sans-serif;background:#1a1a1a;color:#f08080;display:flex;align-items:center;justify-content:center;height:100vh;font-size:16px;}</style></head>
      <body>Erro no login. Feche esta aba e tente novamente.</body></html>`

    if (error || !code) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(errorHtml)
      authServer.close(); authServer = null
      callback({ error: error || 'Código não recebido' })
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(successHtml)

    authServer.close(); authServer = null

    // Troca code por id_token
    try {
      const tokens = await exchangeCodeForTokens(code)
      if (tokens.id_token) {
        callback({ idToken: tokens.id_token, accessToken: tokens.access_token })
      } else {
        callback({ error: 'id_token não recebido: ' + JSON.stringify(tokens) })
      }
    } catch(e) {
      callback({ error: 'Falha na troca de tokens: ' + e.message })
    }
  })

  authServer.on('error', (e) => {
    callback({ error: 'Servidor local falhou: ' + e.message })
  })

  authServer.listen(7777, '127.0.0.1')
}

// ── gera code_verifier e code_challenge para PKCE ──
function generatePKCE() {
  const verifier  = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

// ── janela de login ──
function createLoginWindow() {
  if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return }
  const { width: sw, height: sh } = getWorkArea()
  loginWin = new BrowserWindow({
    width: 400, height: 580,
    x: Math.floor((sw - 400) / 2),
    y: Math.floor((sh - 580) / 2),
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: ICON_PATH,
    title: 'Focus Timer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  loginWin.loadFile('login.html')
  loginWin.on('closed', () => { loginWin = null })
}

// ── painel principal ──
function createMainWindow() {
  if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); return }
  const bounds = getPanelBounds(false)
  mainWin = new BrowserWindow({
    ...bounds,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: ICON_PATH,
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

function openPanel() { if (!panelOpen) togglePanel() }

function setSide(side) {
  panelSide = side
  mainWin.setBounds(getPanelBounds(panelOpen), true)
  mainWin.webContents.send('panel-state', { open: panelOpen, side: panelSide })
}

// ── post-its ──
function createPostitWindow(data) {
  const { id, x, y, w, h, color, text } = data
  if (postitWins[id] && !postitWins[id].isDestroyed()) {
    postitWins[id].focus(); return
  }
  const { width: sw, height: sh } = getWorkArea()
  const win = new BrowserWindow({
    x: Math.max(0, Math.min(x || 300, sw - 220)),
    y: Math.max(0, Math.min(y || 200, sh - 180)),
    width: w || 200, height: h || 160,
    minWidth: 160, minHeight: 120,
    frame: false, transparent: true, resizable: true,
    alwaysOnTop: false, skipTaskbar: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
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
    if (mainWin && !mainWin.isDestroyed())
      mainWin.webContents.send('postit-moved', { id, x: b.x, y: b.y, w: b.width, h: b.height })
  }
  win.on('moved', saveBounds)
  win.on('resized', saveBounds)
  win.on('closed', () => {
    delete postitWins[id]
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('postit-closed', { id })
  })
}

function closePostitWindow(id) {
  if (postitWins[id] && !postitWins[id].isDestroyed()) {
    postitWins[id].destroy(); delete postitWins[id]
  }
}

// ── IPC ──
ipcMain.on('quit-app', () => { app.isQuiting = true; app.quit() })

ipcMain.on('login-success', (e, data) => {
  currentUser = data.name
  if (loginWin && !loginWin.isDestroyed()) loginWin.destroy()
  createMainWindow()
  updateTray()
})

// Google Auth: gera PKCE, inicia servidor local, abre navegador
ipcMain.on('google-auth-start', () => {
  startAuthServer(null, (result) => {
    if (loginWin && !loginWin.isDestroyed()) {
      loginWin.webContents.send('google-auth-result', result)
    }
  })

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + [
    'client_id='             + encodeURIComponent(CLIENT_ID),
    'redirect_uri='          + encodeURIComponent(REDIRECT_URI),
    'response_type=code',
    'scope='                 + encodeURIComponent('openid email profile'),
    'access_type=offline',
    'prompt=select_account'
  ].join('&')

  shell.openExternal(authUrl)

  if (loginWin && !loginWin.isDestroyed()) {
    loginWin.webContents.send('google-auth-waiting')
  }
})

ipcMain.on('logout', () => {
  currentUser = null
  Object.keys(postitWins).forEach(id => closePostitWindow(id))
  if (mainWin && !mainWin.isDestroyed()) mainWin.hide()
  createLoginWindow()
  updateTray()
})

ipcMain.on('toggle-panel', () => togglePanel())
ipcMain.on('set-side', (e, side) => setSide(side))

ipcMain.on('open-postit',  (e, data)   => createPostitWindow(data))
ipcMain.on('close-postit', (e, { id }) => closePostitWindow(id))
ipcMain.on('postit-text',  (e, { id, text, color }) => {
  if (postitWins[id] && !postitWins[id].isDestroyed())
    postitWins[id].webContents.send('postit-text-update', { text, color })
  if (mainWin && !mainWin.isDestroyed())
    mainWin.webContents.send('postit-updated', { id, text, color })
})

ipcMain.on('notify', (e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show()
})
ipcMain.on('alarm-fired', () => openPanel())

// ── bandeja ──
function buildTrayMenu() {
  const items = []
  if (currentUser) {
    items.push({ label: `👤 ${currentUser}`, enabled: false })
    items.push({ type: 'separator' })
    items.push({ label: panelOpen ? 'Ocultar painel' : 'Mostrar painel', click: () => { if (mainWin) togglePanel() } })
    items.push({ type: 'separator' })
    items.push({ label: 'Lado direito',  type: 'radio', checked: panelSide==='right', click: () => setSide('right') })
    items.push({ label: 'Lado esquerdo', type: 'radio', checked: panelSide==='left',  click: () => setSide('left')  })
  } else {
    items.push({ label: 'Fazer login', click: () => createLoginWindow() })
  }
  items.push({ type: 'separator' })
  items.push({ label: 'Sair do Focus Timer', click: () => { app.isQuiting = true; app.quit() } })
  return Menu.buildFromTemplate(items)
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Focus Timer')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    if (currentUser && mainWin) togglePanel()
    else createLoginWindow()
  })
}

function updateTray() {
  if (tray) tray.setContextMenu(buildTrayMenu())
}

// ── init ──
app.whenReady().then(() => {
  createLoginWindow()
  createTray()
})
app.on('window-all-closed', () => {})
app.on('before-quit', () => {
  app.isQuiting = true
  if (authServer) { try { authServer.close() } catch(e){} authServer = null }
})
