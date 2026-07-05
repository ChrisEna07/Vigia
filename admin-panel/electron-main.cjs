const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Vigia Desktop - Control de Acceso Offline',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0a'
  });

  // Remove default menu for clean tactical look
  Menu.setApplicationMenu(null);

  // In production desktop mode, we load the locally compiled Astro site.
  // In development, you can toggle it to load the local dev server (http://localhost:4321)
  const indexPath = path.join(__dirname, 'dist', 'client', 'index.html');
  
  mainWindow.loadFile(indexPath).catch(() => {
    // If not packaged yet, try to load the local dev port
    mainWindow.loadURL('http://localhost:4321').catch(() => {
      mainWindow.loadURL('data:text/html,<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:40px;text-align:center;"><h2>VIGIA Offline</h2><p>Servidor local no detectado. Por favor compila el proyecto usando <code>npm run build</code> o inicia el dev server.</p></body></html>');
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
