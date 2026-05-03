export class ErrorManager {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.listeners = [];
        this.isProduction = this.detectProduction();
    }

    detectProduction() {
        return window.location.hostname !== 'localhost' &&
               window.location.hostname !== '127.0.0.1';
    }

    capture(error, context = {}) {
        const errorEntry = {
            timestamp: Date.now(),
            message: error.message || String(error),
            stack: error.stack || '',
            context,
            url: window.location.href,
            userAgent: navigator.userAgent
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

    handle(error, context = {}) {
        const entry = this.capture(error, context);

        if (this.isProduction) {
            this.showUserFriendlyError(entry);
        }

        return entry;
    }

    showUserFriendlyError(entry) {
        const userMessages = {
            'NotFoundError': '请求的资源不存在',
            'NotAllowedError': '操作被拒绝，请检查权限',
            'NotReadableError': '无法读取数据',
            'OverconstrainedError': '设备不支持所需功能',
            'SecurityError': '安全限制，操作被阻止',
            'TypeError': '数据格式错误',
            'NetworkError': '网络连接失败',
            'AbortError': '操作被取消'
        };

        const friendlyMessage = userMessages[entry.message?.split(':')[0]] ||
                               '操作失败，请稍后重试';

        this.notify({
            type: 'user_error',
            message: friendlyMessage,
            originalError: entry
        });
    }

    wrap(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handle(error, { ...context, args: args.map(a => typeof a) });
                throw error;
            }
        };
    }

    wrapSync(fn, context = {}) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handle(error, { ...context, args: args.map(a => typeof a) });
                throw error;
            }
        };
    }

    on(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify(entry) {
        this.listeners.forEach(callback => {
            try {
                callback(entry);
            } catch (e) {
                console.error('[ErrorManager] Listener error:', e);
            }
        });
    }

    getErrors() {
        return [...this.errors];
    }

    clear() {
        this.errors = [];
    }

    createErrorBoundary(component, fallback) {
        return {
            component,
            fallback,
            componentDidCatch: (error, errorInfo) => {
                this.capture(error, { componentStack: errorInfo.componentStack });
            }
        };
    }
}

export const errorManager = new ErrorManager();

window.addEventListener('error', (event) => {
    errorManager.capture(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    errorManager.capture(event.reason || new Error('Unhandled Promise Rejection'), {
        type: 'unhandledrejection'
    });
});
