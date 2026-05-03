/**
 * @fileoverview Error management and global error boundary.
 */

import type { ErrorEntry, ErrorListener, UserErrorEntry } from '../types.js';

export class ErrorManager {
  private errors: ErrorEntry[] = [];
  private readonly maxErrors: number;
  private readonly listeners: ErrorListener[] = [];
  private readonly isProduction: boolean;

  constructor() {
    this.maxErrors = 50;
    this.isProduction = this.detectProduction();
  }

  private detectProduction(): boolean {
    return (
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    );
  }

  capture(error: unknown, context: Record<string, unknown> = {}): ErrorEntry {
    const errorEntry: ErrorEntry = {
      timestamp: Date.now(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack || '' : '',
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.errors.push(errorEntry);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    if (!this.isProduction) {
      console.error('[ErrorManager]', errorEntry.message, context);
    }

    this.notify(errorEntry);
    return errorEntry;
  }

  handle(error: unknown, context: Record<string, unknown> = {}): ErrorEntry {
    const entry = this.capture(error, context);
    if (this.isProduction) {
      this.showUserFriendlyError(entry);
    }
    return entry;
  }

  private showUserFriendlyError(entry: ErrorEntry): void {
    const userMessages: Record<string, string> = {
      NotFoundError: '请求的资源不存在',
      NotAllowedError: '操作被拒绝，请检查权限',
      NotReadableError: '无法读取数据',
      OverconstrainedError: '设备不支持所需功能',
      SecurityError: '安全限制，操作被阻止',
      TypeError: '数据格式错误',
      NetworkError: '网络连接失败',
      AbortError: '操作被取消',
    };

    const friendlyMessage =
      userMessages[entry.message?.split(':')[0]] || '操作失败，请稍后重试';

    this.notify({
      type: 'user_error',
      message: friendlyMessage,
      originalError: entry,
    });
  }

  wrap<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
    context: Record<string, unknown> = {},
  ): (...args: Args) => Promise<R> {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, { ...context, args: args.map((a) => typeof a) });
        throw error;
      }
    };
  }

  wrapSync<Args extends unknown[], R>(
    fn: (...args: Args) => R,
    context: Record<string, unknown> = {},
  ): (...args: Args) => R {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handle(error, { ...context, args: args.map((a) => typeof a) });
        throw error;
      }
    };
  }

  on(callback: ErrorListener): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback); if (idx > -1) this.listeners.splice(idx, 1);
    };
  }

  notify(entry: ErrorEntry | UserErrorEntry): void {
    this.listeners.forEach((callback) => {
      try {
        callback(entry);
      } catch (e) {
        console.error('[ErrorManager] Listener error:', e);
      }
    });
  }

  getErrors(): ErrorEntry[] {
    return [...this.errors];
  }

  clear(): void {
    this.errors = [];
  }
}

export const errorManager = new ErrorManager();

window.addEventListener('error', (event) => {
  errorManager.capture(event.error || new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  errorManager.capture(event.reason || new Error('Unhandled Promise Rejection'), {
    type: 'unhandledrejection',
  });
});

export default errorManager;
