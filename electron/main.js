const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let nextServer = null;

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // 开发模式：Next.js dev服务器应该已经运行
      resolve();
      return;
    }

    // 生产模式：启动Next.js服务器
    const fs = require('fs');
    const serverPath = path.join(__dirname, '../.next/standalone/server.js');
    const serverDir = path.join(__dirname, '../.next/standalone');
    
    // 检查standalone模式的文件是否存在
    if (fs.existsSync(serverPath)) {
      // 使用standalone服务器
      nextServer = spawn('node', ['server.js'], {
        cwd: serverDir,
        stdio: 'inherit',
        env: { ...process.env, PORT: '3000' }
      });
    } else {
      // 使用next start（标准模式）
      const nextBin = process.platform === 'win32' 
        ? path.join(__dirname, '../node_modules/.bin/next.cmd')
        : path.join(__dirname, '../node_modules/.bin/next');
      
      nextServer = spawn(nextBin, ['start', '-p', '3000'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: { ...process.env, PORT: '3000' }
      });
    }

    nextServer.on('error', (err) => {
      reject(err);
    });

    // 等待服务器启动
    const checkServer = setInterval(() => {
      const http = require('http');
      const req = http.get('http://localhost:3000', (res) => {
        clearInterval(checkServer);
        resolve();
      });
      req.on('error', () => {
        // 服务器还没启动，继续等待
      });
    }, 500);

    // 10秒超时
    setTimeout(() => {
      clearInterval(checkServer);
      reject(new Error('服务器启动超时'));
    }, 10000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../build/icon.png'),
    titleBarStyle: 'default',
    show: false, // 先不显示，等加载完成后再显示
  });

  // 启动服务器并加载应用
  startNextServer()
    .then(() => {
      mainWindow.loadURL('http://localhost:3000');
      
      // 窗口准备好后显示
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // 开发模式下聚焦到窗口并打开开发者工具
        if (isDev) {
          mainWindow.focus();
          mainWindow.webContents.openDevTools();
        }
      });
    })
    .catch((err) => {
      console.error('启动服务器失败:', err);
      // 显示错误信息
      mainWindow.loadURL(`data:text/html,<html><body><h1>启动失败</h1><p>${err.message}</p></body></html>`);
      mainWindow.show();
    });

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 开发模式下聚焦到窗口
    if (isDev) {
      mainWindow.focus();
    }
  });

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
    // 关闭Next.js服务器
    if (nextServer) {
      nextServer.kill();
      nextServer = null;
    }
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS: 当点击dock图标且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  // 关闭Next.js服务器
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
});

// 安全：防止新窗口创建
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});
