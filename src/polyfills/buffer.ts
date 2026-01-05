// Buffer polyfill for browser environment
import { Buffer } from 'buffer';

// 确保 Buffer 在全局可用
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = { 
    env: {},
    version: '',
    versions: {},
    nextTick: (fn: Function) => setTimeout(fn, 0),
  };
}

// 导出 Buffer 供其他模块使用
export { Buffer };

