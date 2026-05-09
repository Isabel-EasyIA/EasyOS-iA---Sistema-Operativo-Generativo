// emoji: "📝"
// EasyOS iA - Editor de Código (Skill)
// Formato: () => { return function(options){...}; }

() => {
    return function(pathOrOpts) {
        let path, options;
        if (typeof pathOrOpts === 'string') {
            path = pathOrOpts;
            options = arguments[1] || {};
        } else {
            options = pathOrOpts || {};
            path = options.path;
        }

        const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        const { ipcRenderer } = isElectron ? require('electron') : { ipcRenderer: null };
        const EasyOS = window.EasyOS;
        const user = EasyOS ? EasyOS.currentUser : 'default';
        const id = 'win-ed-' + Math.random().toString(36).substr(2, 9);

        const state = { filePath: null, content: '', isDirty: false, termPath: 'C:\\EasyOS' };

        function docsRoot() { return `EasyOS iA/users/${user}/documents`; }

        function getFileIcon(name) {
            const ext = (name.split('.').pop() || '').toLowerCase();
            if (ext === 'js') return '📜';
            if (ext === 'py') return '🐍';
            if (ext === 'html' || ext === 'htm') return '🌐';
            if (ext === 'css') return '🎨';
            if (ext === 'json') return '📋';
            if (ext === 'md') return '📝';
            return '📄';
        }

        const html = `
        <div style="display:flex;height:100%;background:#1e1e1e;color:#ccc;font-family:'Consolas',monospace;overflow:hidden;border-radius:0 0 10px 10px;">
            <div style="width:175px;background:#252526;border-right:1px solid #333;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;">
                <div style="padding:7px 12px;font-size:0.68rem;color:#888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
                    <span>Explorador</span>
                    <span onclick="window['edRefresh_${id}']()" style="cursor:pointer;font-size:1rem;opacity:0.7;" title="Actualizar">↻</span>
                </div>
                <div id="ed-tree-${id}" style="flex:1;overflow-y:auto;font-size:0.77rem;padding:4px 0;"></div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
                <div style="background:#2d2d2d;border-bottom:1px solid #333;padding:5px 10px;display:flex;gap:6px;align-items:center;">
                    <button onclick="window['edNew_${id}']()" style="background:transparent;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:0.72rem;">＋ Nuevo</button>
                    <button onclick="window['edSave_${id}']()" style="background:#007acc;border:none;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:0.72rem;">💾 Guardar</button>
                    <button onclick="window['edRun_${id}']()" style="background:#10b981;border:none;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:0.72rem;">▶ Ejecutar</button>
                    <div id="ed-path-${id}" style="flex:1;font-size:0.7rem;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:6px;">Sin título</div>
                </div>
                <textarea id="ed-area-${id}" spellcheck="false"
                    style="flex:2;resize:none;background:#1e1e1e;color:#d4d4d4;font-family:'Consolas','Courier New',monospace;font-size:13px;border:none;outline:none;padding:12px;line-height:1.65;tab-size:4;min-height:0;"
                    placeholder="// Abre un archivo o empieza a escribir..."></textarea>
                <div style="flex:1;border-top:1px solid #333;display:flex;flex-direction:column;background:#0c0c0c;min-height:75px;">
                    <div style="background:#2d2d2d;padding:3px 10px;font-size:0.67rem;color:#888;display:flex;justify-content:space-between;align-items:center;">
                        <span>TERMINAL</span>
                        <span onclick="document.getElementById('ed-tout-${id}').innerHTML=''" style="cursor:pointer;opacity:0.6;" title="Limpiar">🗑</span>
                    </div>
                    <div id="ed-term-${id}" onclick="document.getElementById('ed-tin-${id}').focus()"
                        style="flex:1;overflow-y:auto;padding:6px 10px;cursor:text;display:flex;flex-direction:column;gap:1px;">
                        <div id="ed-tout-${id}" style="white-space:pre-wrap;font-size:0.8rem;"></div>
                        <div style="display:flex;gap:6px;align-items:center;font-size:0.8rem;">
                            <span id="ed-tprompt-${id}" style="color:#10b981;white-space:nowrap;">PS C:\\EasyOS&gt;</span>
                            <input id="ed-tin-${id}" type="text" autocomplete="off" spellcheck="false"
                                style="flex:1;background:transparent;border:none;outline:none;color:#ccc;font-family:'Consolas',monospace;font-size:0.8rem;">
                        </div>
                    </div>
                </div>
                <div style="background:#007acc;color:#fff;font-size:0.67rem;padding:2px 10px;display:flex;justify-content:space-between;flex-shrink:0;">
                    <span id="ed-status-${id}">Listo</span>
                    <span id="ed-cursor-${id}">Lín 1, Col 1</span>
                </div>
            </div>
        </div>`;

        if (EasyOS && EasyOS.createWindow) {
            EasyOS.createWindow({
                id,
                title: options.title || '📝 Editor de Código',
                content: html,
                width: options.width || '820px',
                height: options.height || '560px',
                x: options.x || '100px',
                y: options.y || '60px'
            });
        }

        setTimeout(() => {
            const area    = document.getElementById(`ed-area-${id}`);
            const tout    = document.getElementById(`ed-tout-${id}`);
            const tin     = document.getElementById(`ed-tin-${id}`);
            const statusEl= document.getElementById(`ed-status-${id}`);
            const cursorEl= document.getElementById(`ed-cursor-${id}`);
            const pathEl  = document.getElementById(`ed-path-${id}`);
            if (!area) return;

            function setStatus(msg, ms) {
                if (statusEl) { statusEl.textContent = msg; if (ms) setTimeout(() => { if(statusEl) statusEl.textContent = 'Listo'; }, ms); }
            }
            function updatePath() {
                if (pathEl) {
                    const displayPath = state.filePath ? window.EasyOS.realToVirtual(state.filePath) : 'Sin título';
                    pathEl.textContent = displayPath + (state.isDirty ? ' •' : '');
                }
            }
            function termScroll() {
                const tc = document.getElementById(`ed-term-${id}`);
                if (tc) tc.scrollTop = tc.scrollHeight;
            }
            function termPrint(html, color) {
                if (!tout) return;
                const d = document.createElement('div');
                d.innerHTML = html;
                if (color) d.style.color = color;
                tout.appendChild(d);
                termScroll();
            }

            area.addEventListener('keyup', () => {
                const val = area.value.substring(0, area.selectionStart);
                const lines = val.split('\n');
                if (cursorEl) cursorEl.textContent = `Lín ${lines.length}, Col ${lines[lines.length-1].length + 1}`;
            });

            area.addEventListener('input', () => { state.content = area.value; state.isDirty = true; updatePath(); });
            area.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = area.selectionStart, en = area.selectionEnd;
                    area.value = area.value.substring(0, s) + '    ' + area.value.substring(en);
                    area.selectionStart = area.selectionEnd = s + 4;
                    state.content = area.value; state.isDirty = true;
                }
            });

            function renderTree(files, basePath, depth) {
                files.sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
                return files.map(f => {
                    const fullPath = basePath.replace(/'/g, "\\'") + '/' + f.name.replace(/'/g, "\\'");
                    const pl = 10 + depth * 12;
                    if (f.isDirectory) {
                        return `<div onclick="window['edToggleDir_${id}'](this,'${fullPath}',${depth})"
                            style="padding:3px ${pl}px;cursor:pointer;display:flex;align-items:center;gap:5px;user-select:none;"
                            onmouseenter="this.style.background='#37373d'" onmouseleave="this.style.background=''">
                            <span style="display:inline-block;font-size:0.6rem;transition:transform 0.15s;" class="chev-${id}">▶</span> 📁 ${f.name}
                        </div>
                        <div style="display:none;"></div>`;
                    } else {
                        return `<div onclick="window['edOpenFile_${id}']('${fullPath}')"
                            style="padding:3px ${pl + 14}px;cursor:pointer;display:flex;align-items:center;gap:5px;user-select:none;"
                            onmouseenter="this.style.background='#37373d'" onmouseleave="this.style.background=''">
                            ${getFileIcon(f.name)} ${f.name}
                        </div>`;
                    }
                }).join('');
            }

            window[`edRefresh_${id}`] = async function() {
                const treeEl = document.getElementById(`ed-tree-${id}`);
                if (!treeEl || !isElectron) return;
                const files = await ipcRenderer.invoke('read-dir', docsRoot()) || [];
                treeEl.innerHTML = renderTree(files, docsRoot(), 0);
            };

            window[`edToggleDir_${id}`] = async function(el, path, depth) {
                const childEl = el.nextElementSibling;
                const chev = el.querySelector(`.chev-${id}`);
                if (!childEl) return;
                if (childEl.style.display === 'none') {
                    childEl.style.display = 'block';
                    if (chev) chev.style.transform = 'rotate(90deg)';
                    if (!childEl.innerHTML.trim()) {
                        childEl.innerHTML = '<div style="padding:4px 20px;color:#555;font-size:0.7rem;">Cargando...</div>';
                        const files = await ipcRenderer.invoke('read-dir', path) || [];
                        childEl.innerHTML = renderTree(files, path, depth + 1);
                    }
                } else {
                    childEl.style.display = 'none';
                    if (chev) chev.style.transform = 'rotate(0deg)';
                }
            };

            window[`edOpenFile_${id}`] = async function(path) {
                if (!isElectron) return;
                const content = await ipcRenderer.invoke('read-file', path);
                if (content !== null && content !== undefined) {
                    state.filePath = path;
                    state.content = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                    state.isDirty = false;
                    area.value = state.content;
                    updatePath();
                    setStatus('Archivo abierto', 1500);
                }
            };

            window[`edNew_${id}`] = function() {
                state.filePath = null; state.content = ''; state.isDirty = false;
                area.value = ''; updatePath();
            };

            window[`edSave_${id}`] = async function() {
                if (!isElectron) return;
                if (!state.filePath) {
                    const name = prompt('Nombre del archivo (con extensión):');
                    if (!name) return;
                    state.filePath = docsRoot() + '/' + name;
                }
                setStatus('Guardando...');
                await ipcRenderer.invoke('save-file', { filePath: state.filePath, content: area.value });
                state.isDirty = false; state.content = area.value;
                updatePath(); setStatus('✓ Guardado', 2000);
                window[`edRefresh_${id}`]();
            };

            window[`edRun_${id}`] = async function() {
                if (!state.filePath) { 
                    await window[`edSave_${id}`]();
                    if (!state.filePath) return;
                }
                const ext = state.filePath.split('.').pop().toLowerCase();
                const vPath = window.EasyOS.realToVirtual(state.filePath);
                const fileName = vPath.split('\\').pop();
                
                setStatus(`Ejecutando ${fileName}...`, 2000);

                if (ext === 'html' || ext === 'htm') {
                    if (EasyOS && (EasyOS.easyos_webbrowser || EasyOS.webbrowser)) { 
                        const openWeb = EasyOS.easyos_webbrowser || EasyOS.webbrowser;
                        openWeb({ path: state.filePath, title: `Vista Previa: ${fileName}` }); 
                        return; 
                    }
                }

                let cmd = '';
                if (ext === 'js' || ext === 'py') {
                    const vPath = window.EasyOS.realToVirtual(state.filePath);
                    if (ext === 'js') cmd = `node "${vPath}"`;
                    else if (ext === 'py') cmd = `python "${vPath}"`;
                }

                if (cmd) {
                    // Imprimimos el comando en la consola de abajo
                    termPrint(`<span style="color:#10b981">PS C:\\EasyOS&gt;</span> <span style="color:#ccc">${cmd}</span>`);
                    
                    // Ejecutamos REALMENTE en el motor de EasyOS
                    if (EasyOS && EasyOS.runCommand) {
                        setStatus('Ejecutando...', 0);
                        const r = await EasyOS.runCommand(cmd);
                        if (r.stdout) termPrint(r.stdout.replace(/</g,'&lt;').replace(/\n/g, '<br>'));
                        if (r.stderr) termPrint(r.stderr.replace(/</g,'&lt;').replace(/\n/g, '<br>'), '#ff5f57');
                        if (r.error && !r.stdout && !r.stderr) termPrint(r.error, '#ff5f57');
                        setStatus('Listo', 2000);
                    }
                } else {
                    setStatus(`Sin ejecutor para .${ext}`, 2000);
                }
            };

            window[`edRefresh_${id}`]();
            area.focus();
            if (options.path) setTimeout(() => window[`edOpenFile_${id}`](options.path), 300);
        }, 150);
    };
}
