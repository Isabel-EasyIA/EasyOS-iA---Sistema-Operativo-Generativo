const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0a0a0c',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });

    // Content Security Policy restricto
        win.loadFile('index.html').then(() => {
            win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        ...details.responseHeaders,
                        'Content-Security-Policy': [
                            "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; " +
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
                            "style-src 'self' 'unsafe-inline' https:; " +
                            "font-src 'self' https: data:; " +
                            "img-src 'self' data: blob: https:; " +
                            "connect-src 'self' https: http://localhost:* http://127.0.0.1:*; " +
                            "media-src 'self' https: blob: data:; " +
                            "frame-src 'self' https: blob: data:; " +
                            "object-src 'none'; " +
                            "base-uri 'self'; " +
                            "form-action 'self';"
                        ]
                    }
                });
            });
        });

    win.maximize();
    win.show();
    win.webContents.openDevTools();

    const { session } = require('electron');
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => true);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(true));

    ipcMain.handle('get-app-path', () => app.getAppPath());

    ipcMain.handle('trigger-native-dictation', () => {
        const { exec } = require('child_process');
        const psCommand = `powershell.exe -command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class K { [DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte b, byte s, uint f, uint e); }'; [K]::keybd_event(0x5B, 0, 0, 0); [K]::keybd_event(0x48, 0, 0, 0); [K]::keybd_event(0x48, 0, 2, 0); [K]::keybd_event(0x5B, 0, 2, 0);"`;
        exec(psCommand);
        return true;
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Menú contextual nativo para copiar/pegar/cortar
    win.webContents.on('context-menu', (event, params) => {
        const { selectionText, isEditable } = params;
        
        const menuTemplate = [];
        
        if (isEditable || selectionText) {
            if (selectionText) {
                menuTemplate.push({ label: 'Copiar', role: 'copy' });
            }
            if (isEditable) {
                menuTemplate.push({ label: 'Cortar', role: 'cut' });
                menuTemplate.push({ label: 'Pegar', role: 'paste' });
            }
            menuTemplate.push({ type: 'separator' });
            menuTemplate.push({ label: 'Seleccionar todo', role: 'selectAll' });
        } else if (selectionText) {
            menuTemplate.push({ label: 'Copiar', role: 'copy' });
            menuTemplate.push({ type: 'separator' });
            menuTemplate.push({ label: 'Seleccionar todo', role: 'selectAll' });
        } else {
            menuTemplate.push({ label: 'Seleccionar todo', role: 'selectAll' });
        }
        
        if (menuTemplate.length > 0) {
            const menu = Menu.buildFromTemplate(menuTemplate);
            menu.popup();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─── Validación de Rutas IPC ──────────────────────────────────────────────

const PROJECT_ROOT = __dirname;
const USER_DATA_ROOT = path.join(PROJECT_ROOT, 'EasyOS iA', 'users');

function validatePath(reqPath) {
    const fullPath = path.resolve(PROJECT_ROOT, reqPath);
    const normalized = fullPath + (reqPath.endsWith(path.sep) ? path.sep : '');

    const allowedRoot = PROJECT_ROOT + path.sep;
    if (!normalized.startsWith(allowedRoot) && normalized !== PROJECT_ROOT) {
        return { valid: false, error: 'Ruta fuera del directorio del proyecto', fullPath: null };
    }

    return { valid: true, fullPath };
}

// ─── Handlers IPC Seguros ─────────────────────────────────────────────────

ipcMain.handle('save-file', (event, { filePath, content }) => {
    const v = validatePath(filePath);
    if (!v.valid) return { success: false, error: v.error };

    const dir = path.dirname(v.fullPath);
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(v.fullPath, content);
        return { success: true, path: v.fullPath };
    } catch (e) {
        console.error("Error saving file:", e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('read-file', (event, filePath) => {
    const v = validatePath(filePath);
    if (!v.valid) return null;
    if (fs.existsSync(v.fullPath)) {
        return fs.readFileSync(v.fullPath, 'utf-8');
    }
    return null;
});

ipcMain.handle('make-dir', (event, dirPath) => {
    const v = validatePath(dirPath);
    if (!v.valid) return false;
    if (!fs.existsSync(v.fullPath)) {
        fs.mkdirSync(v.fullPath, { recursive: true });
        return true;
    }
    return false;
});

ipcMain.handle('read-dir', (event, dirPath) => {
    const v = validatePath(dirPath);
    if (!v.valid) return [];
    if (fs.existsSync(v.fullPath) && fs.lstatSync(v.fullPath).isDirectory()) {
        return fs.readdirSync(v.fullPath).map(file => {
            const stats = fs.statSync(path.join(v.fullPath, file));
            return { name: file, isDirectory: stats.isDirectory(), size: stats.size };
        });
    }
    return [];
});

ipcMain.handle('run-command', async (event, { command, user }) => {
    const { exec } = require('child_process');
    const projectRoot = app.getAppPath().replace(/\\/g, '/').toLowerCase();
    const cleanCommand = command.replace(/\\/g, '/').toLowerCase();
    const userPath = path.join(USER_DATA_ROOT, user, 'documents');

    // Verificamos si intenta salir del proyecto (excepto comandos estándar)
    const hasPotentialEscape = cleanCommand.includes('..') || (cleanCommand.includes(':/') && !cleanCommand.includes(projectRoot));
    
    if (hasPotentialEscape) {
        return { error: 'ACCESO DENEGADO: El comando intenta acceder fuera del espacio soberano de EasyOS.' };
    }

    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });

    return new Promise((resolve) => {
        exec(command, { cwd: userPath }, (error, stdout, stderr) => {
            resolve({ stdout: stdout || '', stderr: stderr || '', error: error ? error.message : null });
        });
    });
});

ipcMain.handle('delete-item', (event, itemPath) => {
    const v = validatePath(itemPath);
    if (!v.valid) return false;
    if (fs.existsSync(v.fullPath)) {
        try {
            fs.rmSync(v.fullPath, { recursive: true, force: true });
            return true;
        } catch (e) {
            console.error(">> PROCESO PRINCIPAL: ERROR:", e);
            return false;
        }
    }
    return false;
});

ipcMain.handle('move-item', (event, { oldPath, newPath }) => {
    const vOld = validatePath(oldPath);
    const vNew = validatePath(newPath);
    if (!vOld.valid || !vNew.valid) return { success: false, error: 'Ruta no permitida' };

    try {
        if (fs.existsSync(vOld.fullPath)) {
            fs.renameSync(vOld.fullPath, vNew.fullPath);
            return { success: true };
        }
        return { success: false, error: 'Ruta de origen no existe' };
    } catch (e) {
        console.error("Error al mover item:", e);
        return { success: false, error: e.message };
    }
});
