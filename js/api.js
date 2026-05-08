/**
 * API de Sistema para EasyOS - Versión Real Filesystem
 */
import { isElectron, ipcRenderer, path } from './env.js';
import { askAI } from './ai.js';

export const SystemAPI = {
    currentUser: null, // Se elegirá al inicio
    state: {
        windows: [],
        currentSession: 'Bienvenida EasyOS iA'
    },

    // Métodos protegidos del sistema que no deben ser borrados ni sobrescritos por skills
    coreMethods: [
        'createFolder', 'saveFile', 'createWindow', 'createIcon',
        'runCommand', 'removeItem', 'notify', 'currentUser', 'showLoginScreen',
        'listUsers', 'createUser', 'syncBaseExtensions', 'loadState', 'saveState', 'saveChat',
        'loadChat', 'customPrompt', 'newSession', 'openFolder', 'handleFileClick', 'makeDraggable',
        'makeResizable', 'makeDraggableIcon', 'parseIconAndTitle', 'restoreSession',
        'loadUserExtensions', 'state', 'toggleChat', 'askAI', 'coreMethods',
        'App', 'buildSkill', 'editSkill', 'showOpenWithDialog', 'openWith', 'appRegistry', 'getAbsolutePath',
        'virtualToReal', 'realToVirtual'
    ],

    // Gestión de Usuarios
    listUsers: async () => {
        if (!isElectron) return ['Legna'];
        const users = await ipcRenderer.invoke('read-dir', 'EasyOS iA/users');
        return users.filter(f => f.isDirectory).map(f => f.name);
    },

    createUser: async (username) => {
        if (!isElectron) return;
        const base = `EasyOS iA/users/${username}`;
        await ipcRenderer.invoke('make-dir', `${base}/documents`);
        await ipcRenderer.invoke('make-dir', `${base}/config`);
        await ipcRenderer.invoke('make-dir', `${base}/extensions`);
        await window.AppConfig.copyBaseToUser(username);
        await SystemAPI.syncBaseExtensions(username);
        SystemAPI.notify(`Usuario ${username} creado`);
    },

    syncBaseExtensions: async (username) => {
        if (!isElectron) return;
        const baseDir = 'extensions'; // Carpeta maestra del proyecto
        const userExtensionsDir = `EasyOS iA/users/${username}/extensions`;

        const baseFiles = await ipcRenderer.invoke('read-dir', baseDir);
        for (const file of baseFiles) {
            if (!file.isDirectory && file.name.endsWith('.js')) {
                const userFilePath = `${userExtensionsDir}/${file.name}`;
                const isOfficial = file.name.startsWith('EasyOS_');
                
                if (isOfficial) {
                    // Si es oficial, forzamos actualización y borramos la versión antigua si existe
                    const oldName = file.name.replace('EasyOS_', '');
                    const oldPath = `${userExtensionsDir}/${oldName}`;
                    const oldExists = await ipcRenderer.invoke('read-file', oldPath);
                    if (oldExists) {
                        await ipcRenderer.invoke('delete-item', oldPath);
                    }
                    
                    // Copiar la nueva versión oficial
                    const content = await ipcRenderer.invoke('read-file', `${baseDir}/${file.name}`);
                    await ipcRenderer.invoke('save-file', { filePath: userFilePath, content: content });
                } else {
                    // Para otras skills, solo copiar si no existen
                    const exists = await ipcRenderer.invoke('read-file', userFilePath);
                    if (!exists) {
                        const content = await ipcRenderer.invoke('read-file', `${baseDir}/${file.name}`);
                        await ipcRenderer.invoke('save-file', { filePath: userFilePath, content: content });
                    }
                }
            }
        }
    },

    // Integración de funciones core
    askAI: askAI,

    loadState: async () => {
        // Resetear estado antes de cargar el nuevo usuario
        SystemAPI.state = { windows: [], currentSession: 'Bienvenida EasyOS iA' };

        if (isElectron && SystemAPI.currentUser) {
            const path = `EasyOS iA/users/${SystemAPI.currentUser}/config/desktop_state.json`;
            const saved = await ipcRenderer.invoke('read-file', path);
            if (saved) {
                try {
                    SystemAPI.state = JSON.parse(saved);
                } catch (e) { console.error("Error parseando estado:", e); }
            }
            if (!SystemAPI.state.windows) SystemAPI.state.windows = [];
        }
    },

    saveState: async () => {
        if (isElectron) {
            const path = `EasyOS iA/users/${SystemAPI.currentUser}/config/desktop_state.json`;
            await ipcRenderer.invoke('save-file', {
                filePath: path,
                content: JSON.stringify(SystemAPI.state, null, 2)
            });
        }
    },

    saveChat: async (messages) => {
        if (isElectron) {
            // Limpiar nombre de sesión para el archivo
            const safeName = SystemAPI.state.currentSession.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const path = `EasyOS iA/users/${SystemAPI.currentUser}/config/chat_${safeName}.json`;
            await ipcRenderer.invoke('save-file', {
                filePath: path,
                content: JSON.stringify(messages, null, 2)
            });
        }
    },

    loadChat: async () => {
        if (isElectron) {
            const safeName = SystemAPI.state.currentSession.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const path = `EasyOS iA/users/${SystemAPI.currentUser}/config/chat_${safeName}.json`;
            const saved = await ipcRenderer.invoke('read-file', path);
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    },

    customPrompt: (title, defaultValue, callback) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <h3>${title}</h3>
                <input type="text" id="modal-input" autocomplete="off">
                <div class="modal-btns">
                    <button class="modal-btn secondary" id="modal-cancel">Cancelar</button>
                    <button class="modal-btn primary" id="modal-ok">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#modal-input');
        input.value = defaultValue;

        // Foco inmediato y forzado
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

        const close = (val) => {
            overlay.remove();
            if (val !== null) callback(val);
        };

        overlay.querySelector('#modal-cancel').onclick = () => close(null);
        overlay.querySelector('#modal-ok').onclick = () => close(input.value);

        // Usar onkeydown para mayor compatibilidad
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                close(input.value);
            }
            if (e.key === 'Escape') {
                close(null);
            }
        };
    },

    newSession: () => {
        SystemAPI.customPrompt("Crear nueva sesión", "Nueva Sesión", (name) => {
            if (name) {
                SystemAPI.state.currentSession = name;
                SystemAPI.saveState();
                SystemAPI.notify(`Iniciando sesión: ${name}`);
                // Forzar recarga de chat
                window.dispatchEvent(new CustomEvent('session-changed'));
            }
        });
    },

    /**
     * -- Crear Carpeta: Permite crear carpetas para el usuario de forma física.
     * Comando: EasyOS.createFolder({EMOJI}, {NAME})
     * Ejemplo: EasyOS.createFolder({💼}, {Proyectos})
     */
    createFolder: async (emoji, name) => {
        const finalEmoji = emoji || '📁';
        const finalName = name || 'Nueva Carpeta';

        const folderPath = `EasyOS iA/users/${SystemAPI.currentUser}/documents/${finalName}`;
        if (isElectron) await ipcRenderer.invoke('make-dir', folderPath);

        SystemAPI.createIcon({
            title: finalName,
            icon: finalEmoji,
            type: 'folder',
            path: folderPath
        });

        SystemAPI.notify(`Carpeta física creada: ${finalName}`);
    },

    /**
     * Ejecuta un comando en el sistema (restringido al directorio del usuario).
     */
    runCommand: async (command) => {
        if (!isElectron) return { error: 'No Electron context' };
        let cmd = typeof command === 'string' ? command : (command.command || command.cmd || '');
        
        // Traducir rutas virtuales (C:\EasyOS\...) a rutas reales para el sistema operativo anfitrión
        if (SystemAPI.virtualToReal && cmd.includes('C:\\EasyOS')) {
            cmd = cmd.replace(/C:\\EasyOS\\[^" ]+|C:\\EasyOS/gi, (match) => {
                return SystemAPI.virtualToReal(match);
            });
        }

        return await ipcRenderer.invoke('run-command', {
            command: cmd,
            user: SystemAPI.currentUser
        });
    },

    /**
     * -- Guardar Archivo: Permite crear archivo para el usuario de forma física, con el contenido de texto indicado.
     * Comando: EasyOS.saveFile({EMOJI}, {NAME}, {CONTENT})
     * Ejemplo: EasyOS.saveFile({📄}, {notas.txt}, {Contenido...})
     */
    saveFile: async (emoji, name, content) => {
        const finalEmoji = emoji || '📄';
        const finalName = name || 'nuevo_archivo.txt';
        const finalContent = content || '';
        const filePath = `EasyOS iA/users/${SystemAPI.currentUser}/documents/${finalName}`;

        if (isElectron) {
            await ipcRenderer.invoke('save-file', { filePath: filePath, content: finalContent });

            // SOLO crear icono en el escritorio si el archivo NO está dentro de una subcarpeta
            if (!finalName.includes('/')) {
                const exists = SystemAPI.state.windows.find(w => w.path === filePath);
                if (!exists) {
                    SystemAPI.createIcon({
                        title: finalName,
                        icon: finalEmoji,
                        type: 'file',
                        path: filePath
                    });
                }
            }

            SystemAPI.notify(`Archivo guardado: ${finalName}`);
        }
    },

    /**
     * -- Ejecutar App: Inyecta HTML, CSS y JS en una ventana temporal.
     * Uso: EasyOS.App({ title, html, css, js })
     */
    App: (nameOrOpts, html, css, js) => {
        let title, h, c, j;
        if (typeof nameOrOpts === 'object' && nameOrOpts !== null) {
            title = nameOrOpts.title;
            h = nameOrOpts.html;
            c = nameOrOpts.css;
            j = nameOrOpts.js;
        } else {
            title = nameOrOpts; h = html; c = css; j = js;
        }

        const id = 'app-' + Math.random().toString(36).substr(2, 9);
        
        // Estilo y HTML inyectado directamente (como la Terminal)
        const content = `
            <style>
                #${id} {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: #1e1e1e;
                    color: #ccc;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    border-radius: 0 0 10px 10px;
                    overflow: hidden; /* Evitar scrolls feos */
                }
                ${c || ''}
            </style>
            <div id="${id}" class="easyos-app-instance">
                ${h || ''}
            </div>
        `;

        SystemAPI.createWindow({
            id: id,
            title: title || 'Aplicación',
            content: content,
            width: nameOrOpts.width || '600px',
            height: nameOrOpts.height || '400px'
        });

        // Ejecución del JS en el contexto global (como la Terminal)
        setTimeout(() => {
            try {
                // Usamos _appRoot para evitar colisiones con 'container' que pueda usar la IA
                const scriptBlob = `
                    (function(App) {
                        const _appRoot = App.root;
                        const _appId = App.id;
                        const EasyOS = window.EasyOS;
                        
                        // Alias para compatibilidad si la IA usa 'container'
                        const container = _appRoot;
                        
                        ${(j || '').replace(/const\s+container\s*=\s*container;?/g, '// [Auto-Fix] Redundant container ignored')}
                    })({
                        root: document.getElementById('${id}'),
                        id: '${id}'
                    });
                `;
                const scriptEl = document.createElement('script');
                scriptEl.textContent = scriptBlob;
                document.body.appendChild(scriptEl);
                // Limpieza del script tag para no ensuciar el DOM
                setTimeout(() => scriptEl.remove(), 100);

            } catch(e) { 
                console.error("Error ejecutando App Nativa:", e); 
            }
        }, 50);
    },

    /**
     * -- Crear Skill: Guarda una aplicación persistente en el sistema.
     * Uso: EasyOS.buildSkill({ name, js, html, css }) o EasyOS.buildSkill(NAME, JS, HTML, CSS)
     */
    buildSkill: async (nameOrOpts, html, css, js, emoji) => {
        let name, h, c, j, e;
        if (typeof nameOrOpts === 'object' && nameOrOpts !== null) {
            name = nameOrOpts.name;
            h = nameOrOpts.html;
            c = nameOrOpts.css;
            j = nameOrOpts.js;
            // Capturar emoji o icon, y limpiar espacios en blanco
            e = (nameOrOpts.emoji || nameOrOpts.icon || '').trim(); 
        } else {
            name = nameOrOpts; h = html; c = css; j = js; e = (emoji || '').trim();
        }

        if (!name) return SystemAPI.notify("Error: Falta el nombre de la skill");

        const safeName = name.replace(/\s+/g, '').toLowerCase();
        const filePath = `EasyOS iA/users/${SystemAPI.currentUser}/extensions/${safeName}.js`;

        // Creamos el contenido de la extensión como una función que devuelve una función (factory)
        const skillContent = `
() => {
    return (options) => {
        const config = {
            name: "${name}",
            emoji: "${e || '🧩'}",
            html: \`${(h || '').replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`,
            css: \`${(c || '').replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`,
            js: \`${(j || '').replace(/const\s+container\s*=\s*container;?/g, '// [Auto-Fix] Removed redundant container declaration').replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`
        };

        SystemAPI.App({
            title: config.name,
            html: config.html,
            css: config.css,
            js: config.js
        });
    }
}
`.trim();

        if (isElectron) {
            await ipcRenderer.invoke('save-file', { filePath, content: skillContent });
            SystemAPI.notify(`Skill '${name}' creada y guardada`);
            // Recargar para que esté disponible inmediatamente
            await SystemAPI.loadUserExtensions();
        }
    },

    /**
     * -- Editar Skill: Abre el editor con el código de una skill existente.
     */
    editSkill: async (name) => {
        if (!name) return SystemAPI.notify("Dime qué skill quieres editar");
        const safeName = name.toLowerCase().replace(/\s+/g, '');
        const filePath = `EasyOS iA/users/${SystemAPI.currentUser}/extensions/${safeName}.js`;

        if (isElectron) {
            const content = await ipcRenderer.invoke('read-file', filePath);
            if (content) {
                SystemAPI.notify(`Abriendo editor para: ${name}`);
                // Aquí podrías abrir tu Editor() con el contenido
                // Por ahora, simulamos la edición notificando
                SystemAPI.createWindow({
                    title: `Editando Skill: ${name}`,
                    content: `<textarea style="width:100%; height:100%; background:#1e1e1e; color:#d4d4d4; border:none; font-family:monospace; padding:10px;">${content}</textarea>`,
                    width: '700px',
                    height: '500px'
                });
            } else {
                SystemAPI.notify(`No se encontró la skill: ${name}`);
            }
        }
    },

    /**
     * Abre una ventana que muestra el contenido REAL de una carpeta del disco.
     */
    openFolder: async (dirPath, title) => {
        const files = await ipcRenderer.invoke('read-dir', dirPath);
        let contentHtml = `<div class="file-grid" style="display: grid; grid-template-columns: repeat(auto-fill, 80px); gap: 20px; padding: 20px;">`;

        files.forEach(file => {
            const parsed = SystemAPI.parseIconAndTitle(file.name, file.isDirectory ? '📁' : '📄');
            const safeName = file.name.replace(/'/g, "\\'");
            const safePath = (dirPath + '/' + file.name).replace(/'/g, "\\'");

            contentHtml += `
                <div class="desktop-icon" ondblclick="EasyOS.handleFileClick('${safePath}', ${file.isDirectory}, '${safeName}')">
                    <div class="icon-visual">${parsed.icon}</div>
                    <div class="icon-label">${parsed.title}</div>
                </div>
            `;
        });

        contentHtml += `</div>`;

        const winId = SystemAPI.createWindow({
            title: title || 'Explorador',
            content: contentHtml,
            width: '500px',
            height: '400px',
            path: dirPath // Guardamos la ruta en el objeto de la ventana
        });

        // También la guardamos físicamente en el DOM para detección de colisiones
        document.getElementById(winId).dataset.path = dirPath;
    },

    handleFileClick: (path, isDir, name) => {
        if (isDir) {
            SystemAPI.openFolder(path, name);
        } else {
            SystemAPI.showOpenWithDialog(path, name);
        }
    },

    showOpenWithDialog: (path, name) => {
        const ext = name.split('.').pop().toLowerCase();
        const skills = Object.keys(SystemAPI).filter(key => 
            !SystemAPI.coreMethods.includes(key) && typeof SystemAPI[key] === 'function'
        );

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal open-with-modal" style="min-width: 380px; padding: 25px; background: rgba(15, 15, 20, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <h3 style="margin-bottom: 10px; font-size: 1.2rem; color: #fff;">Abrir archivo</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 2rem;">${SystemAPI.parseIconAndTitle(name, '📄').icon}</span>
                    <span style="font-weight: 600; color: #eee;">${name}</span>
                </div>
                
                <div class="open-options" style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- Acciones recomendadas -->
                    ${['html', 'htm', 'pdf'].includes(ext) ? `
                        <button class="modal-btn primary" style="justify-content: flex-start; gap: 15px; padding: 12px 20px;" onclick="SystemAPI.openWith('${path.replace(/\\/g, '/')}', 'easyos_webbrowser')">
                            <span>🌐</span> Ver en Navegador
                        </button>
                    ` : ''}
                    
                    <button class="modal-btn primary" style="justify-content: flex-start; gap: 15px; padding: 12px 20px;" onclick="SystemAPI.openWith('${path.replace(/\\/g, '/')}', 'easyos_editor')">
                        <span>📝</span> Editar Código / Ver Texto
                    </button>
                    
                    ${['js', 'py', 'sh', 'bat'].includes(ext) ? `
                        <button class="modal-btn primary" style="justify-content: flex-start; gap: 15px; padding: 12px 20px; background: #10b981;" onclick="SystemAPI.openWith('${path.replace(/\\/g, '/')}', 'easyos_terminal', true)">
                            <span>💻</span> Ejecutar en Terminal
                        </button>
                    ` : ''}

                    <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                        <span style="font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px;">Otras aplicaciones</span>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
                            ${skills.map(s => {
                                const displayName = s.replace('easyos_', '').charAt(0).toUpperCase() + s.replace('easyos_', '').slice(1);
                                return `<button class="modal-btn secondary" style="font-size: 0.75rem; padding: 8px; justify-content: center;" onclick="SystemAPI.openWith('${path.replace(/\\/g, '/')}', '${s}')">${displayName}</button>`;
                            }).join('')}
                            <button class="modal-btn secondary" style="font-size: 0.75rem; padding: 8px; justify-content: center; background: rgba(59, 130, 246, 0.2); color: #60a5fa;" onclick="SystemAPI.openWithAI('${path.replace(/\\/g, '/')}', '${name}')">🧠 Usar IA...</button>
                        </div>
                    </div>
                </div>

                <div class="modal-btns" style="margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    <button class="modal-btn secondary" style="width: 100%;" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    openWith: (path, skillName, execute = false) => {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();

        if (SystemAPI[skillName]) {
            const options = { path: path };
            if (execute) {
                const ext = path.split('.').pop().toLowerCase();
                if (ext === 'js') options.execute = `node "${path}"`;
                else if (ext === 'py') options.execute = `python "${path}"`;
                else options.execute = `"${path}"`;
            }
            SystemAPI[skillName](options);
        } else {
            SystemAPI.notify(`Error: Aplicación ${skillName} no encontrada`);
        }
    },

    openWithAI: (path, name) => {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
        const event = new CustomEvent('open-item', {
            detail: { title: name, path: path, action: `Analiza y abre el archivo ${name} en la ruta ${path}. Decide si debo verlo, editarlo o ejecutarlo según su contenido.` }
        });
        window.dispatchEvent(event);
    },

    createWindow: (options) => {
        const desktop = document.getElementById('desktop');
        const id = options.id || 'win-' + Math.random().toString(36).slice(2, 11);
        const win = document.createElement('div');
        win.className = 'window';
        win.id = id;
        win.style.width = options.width || '400px';
        win.style.height = options.height || '300px';
        win.style.left = options.x || '100px';
        win.style.top = options.y || '100px';
        win.style.position = 'absolute';

        win.innerHTML = `
            <div class="window-header">
                <span class="window-title">${options.title || 'Sistema'}</span>
                <div class="window-controls">
                    <button class="dot-btn dot-min"></button>
                    <button class="dot-btn dot-max"></button>
                    <button class="dot-btn dot-close"></button>
                </div>
            </div>
            <div class="window-content" style="height: calc(100% - 40px); overflow: auto;">
                ${options.content || ''}
            </div>
            <div class="resizer n"></div><div class="resizer s"></div>
            <div class="resizer e"></div><div class="resizer w"></div>
            <div class="resizer ne"></div><div class="resizer nw"></div>
            <div class="resizer se"></div><div class="resizer sw"></div>
        `;

        desktop.appendChild(win);
        SystemAPI.makeDraggable(win);
        SystemAPI.makeResizable(win);

        // Ejecutar scripts internos si los hay (ya que innerHTML no los ejecuta automáticamente)
        const scripts = win.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });

        // Registrar siempre en la memoria actual
        SystemAPI.state.windows.push({ ...options, id, type: 'window' });

        if (!options.isRestoring) {
            SystemAPI.saveState();
        }

        win.querySelector('.dot-close').onclick = () => {
            win.remove();
            SystemAPI.state.windows = SystemAPI.state.windows.filter(w => w.id !== id);
            SystemAPI.saveState();
        };

        return id;
    },

    parseIconAndTitle: (rawText, defaultIcon) => {
        if (!rawText) rawText = 'Nueva Carpeta';
        const match = rawText.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])\s*(.*)$/);
        if (match) {
            return {
                icon: match[1],
                title: match[2].trim().replace(/_/g, ' ')
            };
        }
        return {
            icon: defaultIcon || '📁',
            title: rawText.replace(/_/g, ' ')
        };
    },

    createIcon: (options) => {
        const parent = options.parentId ? document.getElementById(options.parentId).querySelector('.window-content') : document.getElementById('desktop');
        const id = options.id || 'icon-' + Math.random().toString(36).slice(2, 11);
        const icon = document.createElement('div');
        icon.className = 'desktop-icon';
        icon.id = id;

        const finalIcon = options.icon || (options.type === 'folder' ? '📁' : '📄');
        const rawTitle = options.title.replace(/_/g, ' ');

        if (!options.parentId) {
            // Calcular posición automática en rejilla (110px de ancho, 120px de alto)
            const iconWidth = 130;
            const iconHeight = 130;
            const iconsPerRow = Math.floor(window.innerWidth / iconWidth);
            const index = SystemAPI.state.windows.filter(w => w.type !== 'window' && !w.parentId).length;

            const col = Math.floor(index / Math.floor(window.innerHeight / iconHeight));
            const row = index % Math.floor(window.innerHeight / iconHeight);

            icon.style.left = options.x || (col * iconWidth + 30) + 'px';
            icon.style.top = options.y || (row * iconHeight + 30) + 'px';
            icon.style.position = 'absolute';

            SystemAPI.makeDraggableIcon(icon);
        } else {
            icon.style.position = 'relative';
            icon.style.display = 'inline-flex';
        }

        icon.innerHTML = `
            <div class="icon-visual">${finalIcon}</div>
            <div class="icon-label">${rawTitle || 'Nuevo'}</div>
        `;

        parent.appendChild(icon);

        // Registrar siempre en la memoria actual
        SystemAPI.state.windows.push({ ...options, id, type: options.type || 'icon' });

        if (!options.isRestoring) {
            SystemAPI.saveState();
        }

        icon.ondblclick = () => {
            if (options.type === 'folder' || options.icon === '📁') {
                const path = options.path || `EasyOS iA/users/${SystemAPI.currentUser}/documents/${options.title}`;
                SystemAPI.openFolder(path, options.title);
            } else {
                SystemAPI.handleFileClick(options.path, false, options.title);
            }
        };

        // Context menu para borrar físico
        icon.oncontextmenu = (e) => {
            e.preventDefault();
            console.log(">> CLICK DERECHO DETECTADO EN:", options.title);

            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.innerHTML = `<div class="menu-item" id="delete-btn-${id}">Eliminar</div>`;
            document.body.appendChild(menu);

            const btn = document.getElementById(`delete-btn-${id}`);
            btn.onclick = (event) => {
                event.stopPropagation();
                console.log(">> PULSADO BOTÓN ELIMINAR");
                SystemAPI.removeItem(id);
                menu.remove();
            };

            setTimeout(() => {
                document.addEventListener('click', () => { if (menu) menu.remove(); }, { once: true });
            }, 100);
        };

        return id;
    },

    makeDraggable: (el) => {
        const header = el.querySelector('.window-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        header.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
                const winData = SystemAPI.state.windows.find(w => w.id === el.id);
                if (winData) {
                    winData.x = el.style.left;
                    winData.y = el.style.top;
                    SystemAPI.saveState();
                }
            };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                let newTop = el.offsetTop - pos2;
                let newLeft = el.offsetLeft - pos1;
                const desktop = document.getElementById('desktop');
                if (newTop < 0) newTop = 0;
                if (newLeft < 0) newLeft = 0;
                if (newLeft + el.offsetWidth > desktop.offsetWidth) newLeft = desktop.offsetWidth - el.offsetWidth;
                if (newTop + el.offsetHeight > desktop.offsetHeight) newTop = desktop.offsetHeight - el.offsetHeight;
                el.style.top = newTop + "px";
                el.style.left = newLeft + "px";
            };
        };
    },

    makeResizable: (el) => {
        const resizers = el.querySelectorAll('.resizer');
        const minimum_size = 150;
        let original_width, original_height, original_x, original_y, original_mouse_x, original_mouse_y;

        for (let resizer of resizers) {
            resizer.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                original_width = parseFloat(getComputedStyle(el, null).getPropertyValue('width').replace('px', ''));
                original_height = parseFloat(getComputedStyle(el, null).getPropertyValue('height').replace('px', ''));
                original_x = el.offsetLeft;
                original_y = el.offsetTop;
                original_mouse_x = e.clientX;
                original_mouse_y = e.clientY;

                const resize = (e) => {
                    const dx = e.clientX - original_mouse_x;
                    const dy = e.clientY - original_mouse_y;
                    if (resizer.classList.contains('se')) {
                        el.style.width = original_width + dx + 'px';
                        el.style.height = original_height + dy + 'px';
                    } else if (resizer.classList.contains('sw')) {
                        el.style.width = original_width - dx + 'px';
                        el.style.height = original_height + dy + 'px';
                        el.style.left = original_x + dx + 'px';
                    } else if (resizer.classList.contains('ne')) {
                        el.style.width = original_width + dx + 'px';
                        el.style.height = original_height - dy + 'px';
                        el.style.top = original_y + dy + 'px';
                    } else if (resizer.classList.contains('nw')) {
                        el.style.width = original_width - dx + 'px';
                        el.style.height = original_height - dy + 'px';
                        el.style.top = original_y + dy + 'px';
                        el.style.left = original_x + dx + 'px';
                    } else if (resizer.classList.contains('e')) el.style.width = original_width + dx + 'px';
                    else if (resizer.classList.contains('w')) { el.style.width = original_width - dx + 'px'; el.style.left = original_x + dx + 'px'; }
                    else if (resizer.classList.contains('s')) el.style.height = original_height + dy + 'px';
                    else if (resizer.classList.contains('n')) { el.style.height = original_height - dy + 'px'; el.style.top = original_y + dy + 'px'; }

                    if (parseFloat(el.style.width) < minimum_size) el.style.width = minimum_size + 'px';
                    if (parseFloat(el.style.height) < minimum_size) el.style.height = minimum_size + 'px';
                };

                const stopResize = () => {
                    window.removeEventListener('mousemove', resize);
                    window.removeEventListener('mouseup', stopResize);
                    const winData = SystemAPI.state.windows.find(w => w.id === el.id);
                    if (winData) {
                        winData.width = el.style.width; winData.height = el.style.height;
                        winData.x = el.style.left; winData.y = el.style.top;
                        SystemAPI.saveState();
                    }
                };
                window.addEventListener('mousemove', resize);
                window.addEventListener('mouseup', stopResize);
            };
        }
    },

    makeDraggableIcon: (el) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        el.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = async (e) => {
                document.onmouseup = null;
                document.onmousemove = null;

                // DETECTAR DROP SOBRE CARPETA
                el.style.display = 'none'; // Ocultar temporalmente para ver qué hay debajo
                const target = document.elementFromPoint(e.clientX, e.clientY);
                el.style.display = 'flex'; // Volver a mostrar

                const windowTarget = target ? target.closest('.window') : null;
                const iconData = SystemAPI.state.windows.find(w => w.id === el.id);

                if (windowTarget && windowTarget.dataset.path && iconData) {
                    const oldPath = iconData.path;
                    const fileName = iconData.title;
                    const newPath = `${windowTarget.dataset.path}/${fileName}`;

                    if (oldPath !== newPath) {
                        SystemAPI.notify(`Moviendo ${fileName}...`);
                        const result = await ipcRenderer.invoke('move-item', { oldPath, newPath });

                        if (result.success) {
                            el.remove();
                            SystemAPI.state.windows = SystemAPI.state.windows.filter(w => w.id !== el.id);
                            SystemAPI.saveState();
                            SystemAPI.notify('Movido con éxito');

                            // Refrescar la ventana de destino limpiando el estado previo
                            const oldId = windowTarget.id;
                            SystemAPI.state.windows = SystemAPI.state.windows.filter(w => w.id !== oldId);
                            windowTarget.remove();

                            SystemAPI.openFolder(windowTarget.dataset.path, windowTarget.querySelector('.window-title').textContent);
                        } else {
                            SystemAPI.notify('Error al mover');
                        }
                    }
                } else if (iconData) {
                    // Guardar posición en el escritorio si no se movió a una carpeta
                    iconData.x = el.style.left;
                    iconData.y = el.style.top;
                    SystemAPI.saveState();
                }
            };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                let newTop = el.offsetTop - pos2;
                let newLeft = el.offsetLeft - pos1;
                const desktop = document.getElementById('desktop');
                if (newTop < 0) newTop = 0;
                if (newLeft < 0) newLeft = 0;
                if (newLeft + el.offsetWidth > desktop.offsetWidth) newLeft = desktop.offsetWidth - el.offsetWidth;
                if (newTop + el.offsetHeight > desktop.offsetHeight) newTop = desktop.offsetHeight - el.offsetHeight;
                el.style.top = newTop + "px";
                el.style.left = newLeft + "px";
            };
        };
    },

    removeItem: async (idOrPath) => {
        const targetId = typeof idOrPath === 'string' ? idOrPath : idOrPath.id;
        const el = document.getElementById(targetId);

        // Caso 1: Es un elemento visual (Icono o Ventana) en el escritorio
        if (el) {
            const itemData = SystemAPI.state.windows.find(w => w.id === targetId);
            if (isElectron && itemData && itemData.type !== 'window') {
                // Confirmación para archivos del escritorio
                const confirm = await new Promise(resolve => {
                    SystemAPI.customPrompt(`¿Eliminar ${itemData.title}?`, "si", (val) => {
                        resolve(val && val.toLowerCase() === 'si');
                    });
                });
                if (!confirm) return;

                await ipcRenderer.invoke('delete-item', itemData.path);
            }
            el.remove();
            SystemAPI.state.windows = SystemAPI.state.windows.filter(w => w.id !== targetId);
            SystemAPI.saveState();
            SystemAPI.notify('Eliminado');
        } 
        // Caso 2: Es una ruta directa (usado por el Lanzador de Apps)
        else if (typeof idOrPath === 'string' && (idOrPath.includes('/') || idOrPath.includes('\\'))) {
            if (isElectron) {
                const success = await ipcRenderer.invoke('delete-item', idOrPath);
                if (success) SystemAPI.notify('Archivo eliminado');
                return success;
            }
        }
    },




    loadUserExtensions: async () => {
        if (isElectron && SystemAPI.currentUser) {
            console.log(`>> SISTEMA: Cargando extensiones de ${SystemAPI.currentUser}...`);

            // Limpiar métodos de usuarios anteriores para evitar persistencia cruzada
            Object.keys(SystemAPI).forEach(key => {
                if (!SystemAPI.coreMethods.includes(key)) {
                    delete SystemAPI[key];
                }
            });

            // IMPORTANTE: Limpiar el registro de apps para que las borradas desaparezcan
            SystemAPI.appRegistry = {};

            const path = `EasyOS iA/users/${SystemAPI.currentUser}/extensions`;
            let files = await ipcRenderer.invoke('read-dir', path);

            // Filtrar para que si existe 'EasyOS_Skill.js', ignoremos 'Skill.js' (evitar duplicados)
            files = files.filter(f => {
                if (!f.name.startsWith('EasyOS_')) {
                    const officialName = 'EasyOS_' + f.name.charAt(0).toUpperCase() + f.name.slice(1);
                    const officialExists = files.find(ff => ff.name.toLowerCase() === officialName.toLowerCase());
                    if (officialExists) return false;
                }
                return true;
            });

            for (const file of files) {
                if (!file.isDirectory && file.name.endsWith('.js')) {
                    const content = await ipcRenderer.invoke('read-file', `${path}/${file.name}`);
                    if (content) {
                        let name = (file.name.substring(0, file.name.lastIndexOf('.')) || file.name).toLowerCase();

                        // Protección contra sobrescritura de funciones core
                        if (SystemAPI.coreMethods.includes(name)) {
                            console.warn(`>> SISTEMA: Intento de sobrescribir método core '${name}' bloqueado.`);
                            continue;
                        }

                        try {
                            const wrapperFn = new Function('return (' + content + ')')();
                            if (typeof wrapperFn === 'function') {
                                // Ejecutar el wrapper una vez para obtener el config (y por tanto el emoji)
                                const result = wrapperFn();
                                let appEmoji = '🚀'; // Default
                                
                                // Buscar emoji en el código (ya sea en el config de buildSkill o en un comentario de metadatos)
                                const emojiMatch = content.match(/(?:emoji|icon):\s*["']\s*(.+?)\s*["']/i);
                                if (emojiMatch) appEmoji = emojiMatch[1];
                                
                                SystemAPI[name] = (...args) => {
                                    if (typeof result === 'function') return result(...args);
                                    return result;
                                };
                                
                                // Guardar en el registro de aplicaciones para el lanzador
                                if (!SystemAPI.appRegistry) SystemAPI.appRegistry = {};
                                SystemAPI.appRegistry[name] = {
                                    name: name,
                                    emoji: appEmoji // Por ahora 🚀, pero el registro permitirá extenderlo
                                };

                                console.log(`   [OK] Extensión '${name}' cargada.`);
                            }
                        } catch (e) {
                            console.error(`>> SISTEMA: Error cargando extensión '${file.name}':`, e);
                        }
                    }
                }
            }
        }
    },

    notify: (msg) => {
        const status = document.querySelector('.status-text');
        if (status) {
            status.textContent = msg;
            setTimeout(() => status.textContent = 'Kernel Listo', 3000);
        }
    },

    restoreSession: async () => {
        await SystemAPI.loadState();
        const chat = document.getElementById('chat-history');
        const btn = document.getElementById('hide-chat-btn');
        if (SystemAPI.state.chatHidden) {
            chat.style.display = 'none';
            btn.style.opacity = '0.5';
        } else {
            chat.style.display = 'flex';
            btn.style.opacity = '1';
        }

        // Limpiar el escritorio actual para evitar duplicados visuales
        const desktop = document.getElementById('desktop');
        desktop.querySelectorAll('.desktop-icon').forEach(i => i.remove());
        desktop.querySelectorAll('.window').forEach(w => w.remove());

        const saved = [...SystemAPI.state.windows];
        SystemAPI.state.windows = [];

        // 1. Restaurar iconos y ventanas guardados en el estado
        saved.forEach(item => {
            if (item.type === 'window') {
                SystemAPI.createWindow({ ...item, isRestoring: true });
            } else {
                SystemAPI.createIcon({ ...item, isRestoring: true });
            }
        });

        // 2. Sincronizar con archivos físicos REALES en el escritorio
        const desktopPath = `EasyOS iA/users/${SystemAPI.currentUser}/documents`;
        const files = await ipcRenderer.invoke('read-dir', desktopPath);

        for (const file of files) {
            const fullPath = `${desktopPath}/${file.name}`;
            // Normalizar y comparar por ruta física para evitar duplicados visuales
            const exists = saved.find(s => s.path === fullPath);
            if (!exists) {
                SystemAPI.createIcon({
                    title: file.name,
                    icon: file.isDirectory ? '📁' : '📄', // createIcon ya detectará si el nombre trae un emoji
                    type: file.isDirectory ? 'folder' : 'file',
                    path: `${desktopPath}/${file.name}`,
                    isRestoring: true
                });
            }
        }
    },

    // Traducción de Rutas (Soberanía de EasyOS)
    virtualToReal: (vPath) => {
        let rel = vPath.replace(/^C:\\EasyOS/i, '').replace(/\\/g, '/');
        if (rel.startsWith('/')) rel = rel.substring(1);
        // Devolvemos la ruta relativa con barras de Windows
        return rel ? rel.replace(/\//g, '\\') : '.';
    },

    realToVirtual: (rPath) => {
        const user = SystemAPI.currentUser || 'default';
        const base = `EasyOS iA/users/${user}/documents`.replace(/\\/g, '/');
        const cleanPath = rPath.replace(/\\/g, '/');
        if (cleanPath.includes(base)) {
            let rel = cleanPath.split(base)[1];
            if (rel.startsWith('/')) rel = rel.substring(1);
            return `C:\\EasyOS\\${rel.replace(/\//g, '\\')}`;
        }
        return rPath;
    },

    getAbsolutePath: async (relPath) => {
        if (!relPath) return '';
        if (relPath.match(/^[a-zA-Z]:/) || relPath.startsWith('/')) return relPath;
        
        if (!SystemAPI.state.rootPath && isElectron) {
            SystemAPI.state.rootPath = await ipcRenderer.invoke('get-app-path');
        }
        
        const base = SystemAPI.state.rootPath || '';
        // Normalizar barras para Windows
        return path.join(base, relPath).replace(/\\/g, '/');
    },

    toggleChat: () => {
        const chat = document.getElementById('chat-history');
        const btn = document.getElementById('hide-chat-btn');
        const isHidden = chat.style.display === 'none';
        chat.style.display = isHidden ? 'flex' : 'none';
        btn.style.opacity = isHidden ? '1' : '0.5';
        SystemAPI.state.chatHidden = !isHidden;
        SystemAPI.saveState();
    },

    showLoginScreen: async (onLogin) => {
        const users = await SystemAPI.listUsers();
        const screen = document.createElement('div');
        screen.className = 'login-screen';

        let userHtml = users.map(u => `
            <div class="user-card" data-user="${u}">
                <div class="user-avatar">👤</div>
                <div class="user-name">${u}</div>
            </div>
        `).join('');

        screen.innerHTML = `
            <h1 class="login-title">Bienvenido a EasyOS iA</h1>
            <div class="user-list">
                ${userHtml}
            </div>
            <button class="new-user-btn" id="create-user-btn">Nuevo Usuario</button>
        `;

        document.body.appendChild(screen);

        // Configurar clics de forma segura
        screen.querySelectorAll('.user-card').forEach(card => {
            card.onclick = async () => {
                const username = card.dataset.user;
                SystemAPI.currentUser = username;
                screen.remove();
                await onLogin();
            };
        });

        document.getElementById('create-user-btn').onclick = () => {
            SystemAPI.customPrompt("Nombre del nuevo usuario", "", async (name) => {
                if (name) {
                    await SystemAPI.createUser(name);
                    screen.remove();
                    SystemAPI.showLoginScreen(onLogin);
                }
            });
        };
    }
};
