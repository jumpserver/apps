import { join, resolve } from 'path';
import { execFile } from 'node:child_process';
import { Conf, useConf } from 'electron-conf/main';
import icon from '../../resources/icon.png?asset';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { app, shell, BrowserWindow, ipcMain, session } from 'electron';

let mainWindow: BrowserWindow | null = null;

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

const conf = new Conf();

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    show: false,
    frame: false, // 无边框窗口
    center: true,
    autoHideMenuBar: true,
    title: 'JumpServer Player',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      height: 30,
      color: '#1f1f1f',
      symbolColor: '#ffffff'
    },
    ...(process.platform === 'linux' ? { icon } : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders;

    // 移除 'Cross-Origin-Opener-Policy' 头
    delete headers?.['Cross-Origin-Opener-Policy'];

    callback({
      cancel: false,
      responseHeaders: headers
    });
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};
const setDefaultProtocol = () => {
  if (process.platform === 'darwin') {
    const isDefaultApp = process.defaultApp && process.argv.length >= 2;
    const protocolArgs = isDefaultApp ? [resolve(process.argv[1])] : undefined;

    app.setAsDefaultProtocolClient('test', process.execPath, protocolArgs);
  } else {
    app.setAsDefaultProtocolClient('test');
  }
};

app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  conf.registerRendererListener();
  useConf();

  // 设置一些默认全局配置
  conf.set('defaultSetting', {
    // 默认的布局
    layout: 'list',
    // 默认的语言
    language: 'en',
    // 默认的主题
    theme: 'light'
  });

  await createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (is.dev) {
    if (process.platform === 'win32') {
      process.on('message', data => {
        if (data === 'graceful-exit') {
          app.quit();
        }
      });
    } else {
      process.on('SIGTERM', () => {
        app.quit();
      });
    }
  }
});

// 除外 macOS 外，关闭所有窗口时退出 app
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 从 web 唤起 Client
// @ts-ignore
app.on('open-url', (_event: Event, url: string) => {
  let subPath: string = '';
  let platForm: string = process.platform;

  console.log(platForm);

  is.dev ? (subPath = 'bin') : process.resourcesPath + '/bin';

  switch (platForm) {
    case 'linux': {
      switch (process.arch) {
        // ia32 为 x86
        case 'ia32':
        case 'x64':
          subPath += '/linux-amd64';
          break;
        case 'arm':
        case 'arm64':
          subPath += '/linux-arm64';
          break;
      }
      break;
    }
    case 'darwin': {
      subPath += '/darwin';
      break;
    }
  }

  let exeFilePath = join(subPath, 'JumpServerClient');

  execFile(exeFilePath, [url], err => {
    if (err) {
      console.log('Error in open-url');
    }
  });
});

setDefaultProtocol();
