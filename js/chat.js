/**
 * Gestión del Chat y Mensajes para EasyOS
 */
import { SystemAPI } from './api.js';

const chatHistory = document.getElementById('chat-history');
let messages = [];
let saveQueue = Promise.resolve();

/**
 * Obtiene el historial de mensajes limpio (sin etiquetas <thought>) para enviar al modelo
 */
export function getChatHistory() {
    return messages
        .filter(m => m.type === 'user' || m.type === 'ai')
        .map(m => ({
            type: m.type,
            text: m.text.replace(/<(thought|think)>[\s\S]*?<\/\1>/g, '').trim()
        }))
        .filter(m => m.text.length > 0);
}

/**
 * Añade un mensaje al chat y lo guarda en el disco.
 */
export function addMessage(text, type) {
    messages.push({ text, type });
    renderMessage(text, type);
    
    // Cola serializada para evitar race conditions
    saveQueue = saveQueue.then(() => SystemAPI.saveChat(messages));
}

/**
 * Escapa HTML para prevenir XSS en contenido no confiable.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Renderiza un mensaje en el DOM.
 */
function renderMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type === 'user' ? 'user-message' : 'ai-message'}`;
    
    let processedText = text;
    const thoughtMatch = text.match(/<(thought|think)>([\s\S]*?)<\/\1>/);

    if (type === 'ai' && thoughtMatch) {
        const thoughtContent = thoughtMatch[2].trim();
        processedText = text.replace(/<(thought|think)>[\s\S]*?<\/\1>/, '').trim();
        
        const thoughtDiv = document.createElement('div');
        thoughtDiv.className = 'thought-block';
        const rawThoughtHtml = marked.parse(thoughtContent);
        thoughtDiv.innerHTML = `
                <div class="thought-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    RAZONAMIENTO INTERNO
                </div>
                ${DOMPurify.sanitize(rawThoughtHtml)}
            `;
            msgDiv.appendChild(thoughtDiv);
        }

    const contentDiv = document.createElement('div');
    if (type === 'ai') {
        const rawHtml = marked.parse(processedText);
        contentDiv.innerHTML = DOMPurify.sanitize(rawHtml);
    } else {
        contentDiv.textContent = processedText;
    }
    msgDiv.appendChild(contentDiv);
    
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
}

/**
 * Carga el historial desde el disco al iniciar.
 */
export async function loadHistory() {
    messages = await SystemAPI.loadChat();
    chatHistory.innerHTML = '';
    messages.forEach(msg => renderMessage(msg.text, msg.type));
}
