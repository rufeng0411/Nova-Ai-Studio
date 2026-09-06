import { app, dialog } from 'electron';

/**
 * 错误只写入日志与界面内提示，禁止 Electron / Windows 原生 Error 弹窗。
 */
export function suppressErrorDialogs() {
  process.on('uncaughtException', (err) => {
    console.error('[nova-launcher] 未捕获异常:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[nova-launcher] 未处理的 Promise 拒绝:', reason);
  });

  dialog.showErrorBox = ((_title: string, content: string) => {
    console.error('[nova-launcher] 已拦截弹窗:', content);
  }) as typeof dialog.showErrorBox;

  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error('[nova-launcher] 渲染进程退出:', details.reason, details.exitCode);
  });

  app.on('child-process-gone', (_event, details) => {
    console.error('[nova-launcher] 子进程退出:', details.type, details.reason);
  });
}
