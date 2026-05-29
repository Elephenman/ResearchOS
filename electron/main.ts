import { app, BrowserWindow, Menu, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerAllIPC } from './ipc/register';
import { DatabaseService } from './services/database';
import { startSidecar, stopSidecar } from './services/sidecar';

// Guard: detect ELECTRON_RUN_AS_NODE mode (sandbox CI) and exit gracefully
if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  console.log('[ResearchOS] Running in Node.js mode (ELECTRON_RUN_AS_NODE=1). GUI not available.');
  console.log('[ResearchOS] This is expected in sandbox/CI environments. The app works correctly when launched normally.');
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService;

// --- Window state persistence ---
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf-8');
    const state = JSON.parse(data) as WindowState;
    // Validate — ensure window is visible on any connected display
    const displays = screen.getAllDisplays();
    const visible = displays.some(d => {
      return (
        (state.x ?? 0) >= d.bounds.x - 300 &&
        (state.x ?? 0) <= d.bounds.x + d.bounds.width &&
        (state.y ?? 0) >= d.bounds.y - 300 &&
        (state.y ?? 0) <= d.bounds.y + d.bounds.height
      );
    });
    if (!visible) {
      return { width: 1400, height: 900, isMaximized: false };
    }
    return state;
  } catch {
    return { width: 1400, height: 900, isMaximized: false };
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const bounds = win.getBounds();
    const isMaximized = win.isMaximized();
    const state: WindowState = { ...bounds, isMaximized };
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
  } catch {
    // Silently ignore write errors
  }
}

// --- Single instance lock ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Initialize database
    const dbPath = path.join(app.getPath('userData'), 'researchos.db');
    db = new DatabaseService(dbPath);
    await db.initialize();

    // Register all IPC handlers
    registerAllIPC(db, mainWindow);

    // Start Python sidecar (RAG engine) — non-blocking, pass settings getter
    const getSettingForSidecar = async (key: string): Promise<string | undefined> => {
      try {
        return db.getSetting(key);
      } catch {
        return undefined;
      }
    };
    startSidecar(getSettingForSidecar).then((ok) => {
      if (ok) {
        console.log('[Main] Sidecar RAG engine started successfully');
      } else {
        console.log('[Main] Sidecar not available — RAG features disabled');
      }
    });

    // Create main window
    createWindow();
    createMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : {}),
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    backgroundColor: '#141414',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: true, // Show immediately for debugging — if blank, renderer load failed
  });

  // Restore maximized state
  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Log renderer errors (critical for diagnosing production build issues)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] Renderer failed to load:', errorCode, errorDescription, validatedURL);
  });

  // Development: load Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'bottom' });
  } else {
    // Production: load built files
    const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
    console.log('[Main] Loading renderer from:', rendererPath);
    mainWindow.loadFile(rendererPath);
  }

  // Save window state on move/resize/close
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Debounced state saving on resize/move
  let saveTimeout: NodeJS.Timeout | null = null;
  mainWindow.on('move', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => { if (mainWindow) saveWindowState(mainWindow); }, 500);
  });
  mainWindow.on('resize', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => { if (mainWindow) saveWindowState(mainWindow); }, 500);
  });
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '导入 PDF', accelerator: 'CmdOrCtrl+I', click: () => mainWindow?.webContents.send('menu:import-pdf') },
        { label: '导出文献', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:export-papers') },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 ResearchOS', click: () => mainWindow?.webContents.send('menu:about') },
        { label: '检查更新', click: () => mainWindow?.webContents.send('menu:check-update') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (db) {
    db.close();
  }
  await stopSidecar();
});
