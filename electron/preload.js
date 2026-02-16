const { contextBridge } = require('electron');

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 可以在这里添加需要在渲染进程中使用的Electron API
  // 例如：文件系统访问、窗口控制等
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
