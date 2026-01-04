import { writable } from 'svelte/store';

// 导出 writable stores
export const walletStore = writable(null);
export const endpointStore = writable(clusterApiUrl('devnet'));
