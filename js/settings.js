/**
 * Página de Configuración de EasyOS iA
 * Contiene la lógica completa de gestión de configuración (AppConfig).
 */
import { isElectron, ipcRenderer } from './env.js';

const BASE_CONFIG_PATH = 'js/config.js';

const DEFAULT_CONFIG = {
    model: {
        name: 'local-model',
        url: 'http://192.168.18.3:8080/v1/chat/completions',
        apiKey: ''
    }
};

function configToJS(data) {
    return `// EasyOS iA - Configuración del usuario
export default ${JSON.stringify(data, null, 4)};
`;
}

function parseConfigJS(content) {
    try {
        const stripped = content.replace(/^[\s\S]*?export\s+default\s+/, '').replace(/;\s*$/, '');
        return new Function('return ' + stripped)();
    } catch (e) {
        console.warn('>> CONFIG: Error parseando config:', e.message);
    }
    return { ...DEFAULT_CONFIG };
}

window.AppConfig = {
    data: { ...DEFAULT_CONFIG },
    currentUser: null,
    initialized: false,

    getUserConfigPath: (username) => `EasyOS iA/users/${username}/config/config.js`,

    init: async (username) => {
        window.AppConfig.currentUser = username;
        const userPath = window.AppConfig.getUserConfigPath(username);

        if (isElectron) {
            const userConfigContent = await ipcRenderer.invoke('read-file', userPath);
            if (userConfigContent) {
                window.AppConfig.data = parseConfigJS(userConfigContent);
            } else {
                await window.AppConfig.copyBaseToUser(username);
                const fallback = await ipcRenderer.invoke('read-file', userPath);
                window.AppConfig.data = fallback ? parseConfigJS(fallback) : { ...DEFAULT_CONFIG };
            }
        }

        window.AppConfig.initialized = true;
        console.log(`>> CONFIG: Configuración cargada para ${username}`);
        return window.AppConfig.data;
    },

    get: (path) => {
        const keys = path.split('.');
        let val = window.AppConfig.data;
        for (const key of keys) {
            if (val == null) return undefined;
            val = val[key];
        }
        return val;
    },

    set: (path, value) => {
        const keys = path.split('.');
        let obj = window.AppConfig.data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
    },

    getApiUrl: () => window.AppConfig.data.model.url,
    getApiKey: () => window.AppConfig.data.model.apiKey,
    getModelName: () => window.AppConfig.data.model.name,

    copyBaseToUser: async (username) => {
        if (!isElectron) return;
        try {
            const userPath = window.AppConfig.getUserConfigPath(username);
            const exists = await ipcRenderer.invoke('read-file', userPath);
            if (!exists) {
                let baseContent = await ipcRenderer.invoke('read-file', BASE_CONFIG_PATH);
                if (!baseContent) {
                    await ipcRenderer.invoke('save-file', {
                        filePath: BASE_CONFIG_PATH,
                        content: configToJS(DEFAULT_CONFIG)
                    });
                    baseContent = await ipcRenderer.invoke('read-file', BASE_CONFIG_PATH);
                }
                await ipcRenderer.invoke('make-dir', `EasyOS iA/users/${username}/config`);
                await ipcRenderer.invoke('save-file', {
                    filePath: userPath,
                    content: baseContent || configToJS(DEFAULT_CONFIG)
                });
                console.log(`>> CONFIG: Config base copiada para ${username}`);
            }
        } catch (e) {
            console.error('>> CONFIG: Error copiando config base:', e);
        }
    },

    save: async () => {
        if (!isElectron || !window.AppConfig.currentUser) return;
        try {
            const userPath = window.AppConfig.getUserConfigPath(window.AppConfig.currentUser);
            await ipcRenderer.invoke('make-dir', `EasyOS iA/users/${window.AppConfig.currentUser}/config`);
            await ipcRenderer.invoke('save-file', {
                filePath: userPath,
                content: configToJS(window.AppConfig.data)
            });
        } catch (e) {
            console.error('Error saving config:', e);
        }
    }
};

// ── UI de Configuración ──────────────────────────────────────────────

let settingsPage = null;

function openSettings() {
    if (settingsPage) return;

    settingsPage = document.createElement('div');
    settingsPage.className = 'settings-page';
    settingsPage.innerHTML = `
        <div class="settings-container">
            <aside class="settings-sidebar">
                <h2>Configuración</h2>
                <button class="settings-nav-btn active" data-panel="model">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 2.51-1.11 4.83-2.78 6.5C16.04 21 13.31 22 10.58 22S5.12 21 3.74 18.6C.56 15.47.56 10.4 3.74 7.27c3.18-3.14 8.34-3.14 11.52 0L18 4.5V10.12z"/></svg>
                    Modelo IA
                </button>
                <button class="settings-nav-btn" data-panel="users">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    Usuarios
                </button>
                <button class="close-btn" id="settings-close-btn">✕ Cerrar</button>
            </aside>
            <div class="settings-content">
                <div class="settings-panel active" id="panel-model">
                    <h3>Modelo IA</h3>
                    <p class="subtitle">Configura la conexión con tu modelo de inteligencia artificial local.</p>
                    <div class="config-group">
                        <label>Nombre del Modelo</label>
                        <input type="text" id="cfg-model-name" placeholder="local-model">
                    </div>
                    <div class="config-group">
                        <label>URL de la API</label>
                        <input type="text" id="cfg-url" placeholder="http://192.168.18.3:8080/v1/chat/completions">
                    </div>
                    <div class="config-group">
                        <label>API Key (opcional)</label>
                        <input type="password" id="cfg-api-key" placeholder="sk-...">
                    </div>
                    <button class="config-save-btn" id="cfg-save-model">💾 Guardar Configuración</button>
                </div>
                <div class="settings-panel" id="panel-users">
                    <h3>Usuarios</h3>
                    <p class="subtitle">Gestiona los usuarios y sus sesiones.</p>
                    <div class="user-list-settings" id="settings-user-list">
                        <p style="color:var(--text-dim);font-size:0.9rem;">Cargando...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(settingsPage);
    populateModelConfig();
    setupSettingsEvents();
    loadUserList();
}

function closeSettings() {
    if (settingsPage) {
        settingsPage.remove();
        settingsPage = null;
    }
}

function populateModelConfig() {
    document.getElementById('cfg-model-name').value = window.AppConfig.getModelName();
    document.getElementById('cfg-url').value = window.AppConfig.getApiUrl();
    document.getElementById('cfg-api-key').value = window.AppConfig.getApiKey();
}

async function saveModelConfig() {
    window.AppConfig.set('model.name', document.getElementById('cfg-model-name').value.trim());
    window.AppConfig.set('model.url', document.getElementById('cfg-url').value.trim());
    window.AppConfig.set('model.apiKey', document.getElementById('cfg-api-key').value.trim());
    await window.AppConfig.save();

    const btn = document.getElementById('cfg-save-model');
    btn.textContent = '✅ Guardado';
    btn.style.background = '#10b981';
    btn.style.pointerEvents = 'none';

    setTimeout(() => {
        btn.textContent = '💾 Guardar Configuración';
        btn.style.background = '';
        btn.style.pointerEvents = '';
    }, 2000);
}

async function loadUserList() {
    const container = document.getElementById('settings-user-list');
    if (!isElectron || !container) {
        if (container) container.innerHTML = '<p style="color:var(--text-dim)">Solo disponible en modo Electron.</p>';
        return;
    }

    try {
        const users = await window.SystemAPI.listUsers();
        if (!users.length) {
            container.innerHTML = '<p style="color:var(--text-dim)">No hay usuarios creados.</p>';
            return;
        }

        let html = '';
        for (const user of users) {
            const isCurrent = user === window.SystemAPI?.currentUser;
            const sessions = await getUserSessions(user);

            const safeUser = user.replace(/'/g, "\\'");
            html += `
                <div class="user-list-item ${isCurrent ? 'current' : ''}" data-user="${safeUser}">
                    <div>
                        <div class="user-info">
                            <div class="avatar-sm">👤</div>
                            <span class="name">${safeUser}</span>
                            ${isCurrent ? '<span class="badge">Activo</span>' : ''}
                        </div>
                        ${sessions.length ? `
                            <div class="user-sessions">
                                ${sessions.map(s => `<span class="session-tag">${s}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="user-actions">
                        ${!isCurrent ? `<button class="btn-switch" onclick="window.__settings.switchUser('${safeUser}')">Cambiar</button>` : ''}
                        <button class="btn-delete" onclick="window.__settings.deleteUser('${safeUser}')">Eliminar</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p style="color:#ef4444">Error: ${e.message}</p>`;
    }
}

async function getUserSessions(username) {
    if (!isElectron) return [];
    const configPath = `EasyOS iA/users/${username}/config`;
    const files = await ipcRenderer.invoke('read-dir', configPath);
    const sessions = [];
    for (const f of files) {
        if (f.name.startsWith('chat_') && f.name.endsWith('.json')) {
            const sessionName = f.name.replace('chat_', '').replace('.json', '');
            sessions.push(sessionName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        }
    }
    if (!sessions.includes('Bienvenida EasyOS iA')) {
        sessions.unshift('Bienvenida EasyOS iA');
    }
    return sessions;
}

function setupSettingsEvents() {
    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const panel = document.getElementById(`panel-${btn.dataset.panel}`);
            if (panel) panel.classList.add('active');
            if (btn.dataset.panel === 'users') loadUserList();
        };
    });

    document.getElementById('settings-close-btn').onclick = closeSettings;

    settingsPage.addEventListener('click', (e) => {
        if (e.target === settingsPage) closeSettings();
    });

    document.getElementById('cfg-save-model').onclick = saveModelConfig;
}

window.__settings = {
    async switchUser(username) {
        window.SystemAPI.currentUser = username;
        await window.AppConfig.init(username);
        await window.SystemAPI.restoreSession();
        await window.loadHistory?.();
        closeSettings();
        window.EasyOS.notify(`Sesión de ${username} activada`);
    },
    async deleteUser(username) {
        if (username === window.SystemAPI?.currentUser) {
            alert('No puedes eliminar el usuario activo.');
            return;
        }
        if (!confirm(`¿Eliminar permanentemente al usuario "${username}" y todos sus datos?`)) return;
        if (!isElectron) return;
        const userPath = `EasyOS iA/users/${username}`;
        const result = await ipcRenderer.invoke('delete-item', userPath);
        if (result) {
            window.EasyOS.notify(`Usuario ${username} eliminado`);
            loadUserList();
        } else {
            window.EasyOS.notify('Error al eliminar usuario');
        }
    }
};

document.getElementById('settings-btn').addEventListener('click', openSettings);
