/**
 * Detección unificada del entorno de ejecución.
 */
export const isElectron = typeof window !== 'undefined' && window.process && window.process.type;

export const ipcRenderer = isElectron ? require('electron').ipcRenderer : null;
export const path = isElectron ? require('path') : null;
