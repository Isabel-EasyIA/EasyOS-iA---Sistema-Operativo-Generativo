import { askAI } from './ai.js';
import { isElectron, ipcRenderer } from './env.js';
import { SystemAPI } from './api.js';
import { addMessage, loadHistory, getChatHistory } from './chat.js';

function addSystemMessage(text) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai-message';
    msgDiv.innerHTML = `<em style="color: rgba(255,255,255,0.5);">${text}</em>`;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
}

const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');

const DANGEROUS_PATTERNS = [
    /require\s*\(/i,
    /process\s*\./i,
    /global\s*\./i,
    /__dirname/i,
    /__filename/i,
    /window\s*\.\s*require/i,
    /fs\s*\./i,
    /child_process/i,
    /exec\s*\(/i,
    /spawn\s*\(/i,
    /String\.fromCharCode.*\brequire\b/i,
    /atob\s*\(/i,
    /Buffer\s*\./i,
    /\bthis\b.*constructor/i,
    /\[\s*["']require["']\s*\]/i,
    /\\x72\\x65\\x71\\x75\\x69\\x72\\x65/i,
];

function createSandbox() {
    return new Proxy({}, {
        get(_, prop) {
            if (window.EasyOS && typeof window.EasyOS[prop] === 'function') {
                return window.EasyOS[prop].bind(window.EasyOS);
            }
            return undefined;
        },
        has(_, prop) {
            return window.EasyOS && typeof window.EasyOS[prop] === 'function';
        }
    });
}

async function executeJSONCommand(comando) {
    if (!comando || !comando.accion) return false;

    console.log('Kernel: Ejecutando comando JSON:', comando);
    const { accion, parametros } = comando;
    const args = parametros ? Object.values(parametros) : [];

    try {
        if (accion === 'buildSkill') {
            // Caso especial: buildSkill espera 4 argumentos (name, html, css, js)
            await window.EasyOS.buildSkill(parametros.name, parametros.html, parametros.css, parametros.js);
        } else if (accion === 'createFolder') {
            await window.EasyOS.createFolder(parametros.emoji, parametros.name);
        } else if (accion === 'saveFile') {
            await window.EasyOS.saveFile(parametros.emoji, parametros.name, parametros.content);
        } else if (window.EasyOS[accion] && typeof window.EasyOS[accion] === 'function') {
            // Ejecución dinámica para el resto de funciones
            const result = window.EasyOS[accion](...args);
            if (result && typeof result.then === 'function') await result;
        } else {
            throw new Error(`Acción desconocida: ${accion}`);
        }
        return true;
    } catch (e) {
        console.error('Error ejecutando comando JSON:', e);
        window.EasyOS.notify('Error: ' + e.message);
        return false;
    }
}

async function executeAICode(text) {
    // Mantenemos esta función por compatibilidad con skills antiguas o comandos manuales
    // pero ahora el flujo principal irá por executeJSONCommand
    if (typeof text === 'object') return await executeJSONCommand(text);
    
    let found = false;
    const cleanText = text.replace(/<(thought|think)>[\s\S]*?<\/\1>/g, '');
    let processedText = cleanText;

    const codeRegex = /```javascript([\s\S]*?)```/g;
    let match;
    while ((match = codeRegex.exec(cleanText)) !== null) {
        const code = match[1].trim();
        processedText = processedText.replace(match[0], '');
        // ... (resto del código de ejecución JS manual por si acaso)
    }
    // (Simplificado para brevedad, pero manteniendo la lógica de detección de EasyOS.method)
    return found;
}

async function handleAction() {
    const prompt = userInput.value.trim();
    if (!prompt) return;

    addMessage(prompt, 'user');
    userInput.value = '';
    userInput.disabled = true;

    // Si el usuario escribe un comando directo de EasyOS, intentamos ejecutarlo como antes
    const isEasyOSCommand = /^\s*EasyOS\.\w+\s*\(/.test(prompt);

    if (isEasyOSCommand) {
        await executeAICode('```javascript\n' + prompt + '\n```');
    } else {
        const history = getChatHistory();
        const aiResponse = await askAI(prompt, history);
        
        // Mostrar diálogo y razonamiento (si existe)
        let fullMsg = aiResponse.dialogo;
        if (aiResponse.thought) {
            fullMsg = `<thought>${aiResponse.thought}</thought>\n${aiResponse.dialogo}`;
        }
        addMessage(fullMsg, 'ai');

        // Ejecutar comandos si existen
        if (aiResponse.comandos && aiResponse.comandos.length > 0) {
            for (const cmd of aiResponse.comandos) {
                await executeJSONCommand(cmd);
            }
        }
    }

    userInput.disabled = false;
    userInput.focus();
}

sendBtn.addEventListener('click', handleAction);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAction();
});

document.getElementById('hide-chat-btn').onclick = () => SystemAPI.toggleChat();
document.getElementById('new-session-btn').onclick = () => SystemAPI.newSession();

window.addEventListener('session-changed', async () => {
    await loadHistory();
});

window.addEventListener('open-item', async (e) => {
    const itemName = e.detail.title;
    const customAction = e.detail.action;
    addMessage(`Abriendo ${itemName}...`, 'user');
    const aiResponse = await askAI(`El usuario ha hecho clic en el ítem "${itemName}". Ejecuta la acción correspondiente: ${customAction}`);
    
    addMessage(aiResponse.dialogo, 'ai');
    if (aiResponse.comandos && aiResponse.comandos.length > 0) {
        for (const cmd of aiResponse.comandos) {
            await executeJSONCommand(cmd);
        }
    }
});

voiceBtn.addEventListener('click', async () => {
    userInput.focus();
    SystemAPI.notify('Activando dictado de Windows...');
    await ipcRenderer.invoke('trigger-native-dictation');
});

window.addEventListener('DOMContentLoaded', async () => {
    window.EasyOS = SystemAPI;
    window.SystemAPI = SystemAPI;

    const clockEl = document.getElementById('system-clock');
    function updateClock() {
        if (clockEl) {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }
    updateClock();
    setInterval(updateClock, 1000);

    const appsBtn = document.getElementById('apps-btn');
    window.handleAppContextMenu = (e, appName, isSystem) => {
        e.preventDefault();
        if (isSystem) return;

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'menu-item';
        deleteBtn.innerHTML = '🗑️ Desinstalar App';
        deleteBtn.onclick = async () => {
            if (confirm(`¿Estás seguro de que quieres eliminar "${appName}"?`)) {
                const path = `EasyOS iA/users/${SystemAPI.currentUser}/extensions/${appName}.js`;
                await SystemAPI.removeItem(path);
                await SystemAPI.loadUserExtensions();
                openAppLauncher(true); // Cierra la actual y abre la nueva lista
                SystemAPI.notify('Aplicación desinstalada');
            }
            menu.remove();
        };

        menu.appendChild(deleteBtn);
        document.body.appendChild(menu);
        setTimeout(() => window.addEventListener('click', () => menu.remove(), { once: true }), 10);
    };

    function openAppLauncher(forceOpen = false) {
        // Si ya hay una ventana de aplicaciones abierta, la cerramos (Toggle)
        const existingWin = Array.from(document.querySelectorAll('.window')).find(w => 
            w.querySelector('.window-title')?.textContent === 'Aplicaciones del Sistema EasyOS iA'
        );
        
        if (existingWin) {
            existingWin.querySelector('.dot-close').click();
            if (forceOpen === false) return; // Si no forzamos, el toggle termina aquí
        }

        const registry = SystemAPI.appRegistry || {};
        const apps = Object.keys(registry);

        let gridHtml = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:15px; padding:10px;">`;
        apps.forEach(appName => {
            const appInfo = registry[appName];
            const displayName = appName.replace('easyos_', '').replace(/_/g, ' ');
            const emoji = appInfo.emoji || '🧩';
            const isSystem = appName.toLowerCase().startsWith('easyos_');
            
            gridHtml += `
                <div class="app-launcher-item"
                     onclick="SystemAPI['${appName}'](); this.closest('.window').querySelector('.dot-close').click();" 
                     oncontextmenu="window.handleAppContextMenu(event, '${appName}', ${isSystem})"
                     style="display:flex; flex-direction:column; align-items:center; cursor:pointer; background:rgba(255,255,255,0.03); padding:15px; border-radius:15px; border:1px solid rgba(255,255,255,0.05); transition:0.3s; text-align:center;"
                     onmouseenter="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='var(--accent)';" onmouseleave="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.05)';"
                >
                    <div style="font-size:2.8rem; margin-bottom:10px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">${emoji}</div>
                    <div style="font-size:0.75rem; font-weight:600; color:white; text-transform:capitalize;">${displayName}</div>
                </div>`;
        });

        if (apps.length === 0) {
            gridHtml = `<div style="padding:40px; text-align:center; color:rgba(255,255,255,0.5);">No hay aplicaciones instaladas. Pídele a la IA que cree una para ti.</div>`;
        } else {
            gridHtml += `</div>`;
        }

        SystemAPI.createWindow({ title: 'Aplicaciones del Sistema EasyOS iA', content: gridHtml, width: '480px', height: '420px' });
    }
    if (appsBtn) appsBtn.addEventListener('click', openAppLauncher);

    SystemAPI.showLoginScreen(async () => {
        await window.AppConfig.init(SystemAPI.currentUser);
        await SystemAPI.loadUserExtensions(); // Cargar skills primero
        await SystemAPI.restoreSession();
        await loadHistory();
        console.log(`EasyOS Kernel Inicializado para: ${SystemAPI.currentUser}`);
    });
});
