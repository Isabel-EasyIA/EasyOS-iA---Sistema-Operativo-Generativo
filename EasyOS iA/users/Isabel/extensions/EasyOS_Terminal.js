// EasyOS iA - Terminal Skill
// emoji: ">_"

() => {
    return function(pathOrOpts) {
        let path, options;
        if (typeof pathOrOpts === 'string') {
            path = pathOrOpts;
            const secondArg = arguments[1];
            if (typeof secondArg === 'string') {
                options = { execute: secondArg };
            } else {
                options = secondArg || {};
            }
        } else {
            options = pathOrOpts || {};
            path = options.path;
        }

        const id = 'win-term-' + Math.random().toString(36).substr(2, 9);
        const startPath = path || 'C:\\EasyOS';
        const state = { path: startPath };

        const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
        const EasyOS = window.EasyOS;

        // ── Ejecutar comando ─────────────────────────────────────────────
        async function execCmd(cmdLine, outputEl) {
            const print = (html, color) => {
                const d = document.createElement('div');
                d.innerHTML = html;
                if (color) d.style.color = color;
                outputEl.appendChild(d);
            };

            const cmdTrim = cmdLine.trim();
            const cmdLower = cmdTrim.split(' ')[0].toLowerCase();

            if (cmdLower === 'cls' || cmdLower === 'clear') {
                outputEl.innerHTML = '';
                return;
            }
            if (cmdLower === 'help') {
                print('EasyOS Terminal - Entorno de ejecución soberano');
                print('Comandos: cls, clear, help, cd [ruta], ls');
                return;
            }

            if (EasyOS && EasyOS.runCommand) {
                // El comando se envía tal cual (con rutas virtuales). 
                // SystemAPI.runCommand se encargará de traducirlas a reales para Windows.
                const r = await EasyOS.runCommand(cmdTrim);
                if (r.stdout) print(r.stdout.replace(/</g, '&lt;').replace(/\n/g, '<br>'));
                if (r.stderr) print(r.stderr.replace(/</g, '&lt;').replace(/\n/g, '<br>'), '#ff5f57');
                if (r.error && !r.stdout && !r.stderr) print(r.error, '#ff5f57');
            } else {
                print('Error: SystemAPI.runCommand no disponible', '#ff5f57');
            }
        }

        const content = `
            <div id="term-wrap-${id}" style="background:#0c0c0c; height:100%; border-radius:0 0 10px 10px; padding:10px 12px; font-family:'Consolas',monospace; font-size:0.875rem; color:#ccc; display:flex; flex-direction:column; overflow:hidden; cursor:text;" onclick="document.getElementById('term-input-${id}').focus()">
                <div style="color:#569cd6;">EasyOS PowerShell</div>
                <div style="color:#888;">Entorno soberano de ejecución iA.</div>
                <br>
                <div id="term-out-${id}" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:3px; margin-bottom:8px;"></div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <span id="term-prompt-${id}" style="color:#10b981; white-space:nowrap;">PS ${state.path}&gt;</span>
                    <input id="term-input-${id}" type="text" autocomplete="off" spellcheck="false"
                        style="flex:1; background:transparent; border:none; color:#ccc; font-family:inherit; font-size:inherit; outline:none;">
                </div>
            </div>
        `;

        if (EasyOS && EasyOS.createWindow) {
            EasyOS.createWindow({
                id: id,
                title: options.title || '💻 Terminal',
                content: content,
                width: options.width || '620px',
                height: options.height || '400px'
            });
        }

        setTimeout(() => {
            const input = document.getElementById('term-input-' + id);
            const outputEl = document.getElementById('term-out-' + id);
            if (!input || !outputEl) return;

            input.focus();

            input.addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter') return;
                const cmdLine = input.value.trim();
                input.value = '';
                if (!cmdLine) return;

                const echo = document.createElement('div');
                echo.innerHTML = `<span style="color:#10b981">PS ${state.path}&gt;</span> ${cmdLine}`;
                outputEl.appendChild(echo);

                input.disabled = true;
                await execCmd(cmdLine, outputEl);
                input.disabled = false;
                input.focus();
                outputEl.scrollTop = outputEl.scrollHeight;
            });

            // Soporte para comando inicial (desde el Editor por ejemplo)
            const initialCmd = options.execute || options.command;
            if (initialCmd) {
                setTimeout(async () => {
                    const echo = document.createElement('div');
                    echo.innerHTML = `<span style="color:#10b981">PS ${state.path}&gt;</span> ${initialCmd}`;
                    outputEl.appendChild(echo);
                    input.disabled = true;
                    await execCmd(initialCmd, outputEl);
                    input.disabled = false;
                    input.focus();
                    outputEl.scrollTop = outputEl.scrollHeight;
                }, 500);
            }
        }, 100);
    };
}
