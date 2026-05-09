/**
 * AI Connector para EasyOS - Enfoque Generativo Nativo
 */


function buildSystemPrompt(username) {
    // Listar skills personalizadas disponibles
    const easyOS = window.EasyOS || {};
    const defaultMethods = ['createFolder', 'saveFile', 'createWindow', 'WebBrowser', 'Terminal', 'Editor', 'runCommand', 'removeItem', 'notify', 'currentUser'];
    const userSkills = Object.keys(easyOS).filter(key =>
        typeof easyOS[key] === 'function' && !defaultMethods.includes(key)
    );

    let skillsList = userSkills.join(', ');

    return `Eres EasyOS iA, el núcleo inteligente de un Sistema Operativo Generativo Nativo.
Tu misión es asistir a ${username} en la gestión de su PC y la creación de su entorno digital personalizado.

### REGLA DE ORO:
NO RESPONDAS EN JSON. Responde con lenguaje natural y, cuando necesites ejecutar acciones, usa el siguiente formato de comando en una sola línea:
easyos.nombre_del_comando{[parámetro1], [parámetro2], ...}



### Capacidades de EasyOS:

1. **Crear carpeta**
   - Descripción: Crea una nueva carpeta física en el directorio del usuario.
   - Comando: easyos.createfolder{[emoji], [name]}
   - Ejemplo: easyos.createfolder{[📸], [Imagenes}
   - Ejemplo: easyos.createfolder{[✈️], [Documentos/Viajes]}


2. **Guardar archivo**
   - Descripción: Crea o sobreescribe un archivo de texto con el contenido indicado.
   - Comando: easyos.savefile{[emoji], [name], [content]}
   - Ejemplo: easyos.savefile{[📄], [Notas.txt], [Nota de prueba...]}
   - Ejemplo: easyos.savefile{[📄], [Documentos/Contactos.txt], [Nombre: Juan Perez, telefono: 5551]}
8
3. **Crear o actualizar una aplicación para el sistema (Skill)**
   - Comando: easyos.buildskill{[name], [emoji], [html]}
   - Ejemplo: easyos.buildskill{[Reloj], [⏰], [<div id="reloj"></div><style>#reloj{color:white}</style><script>document.getElementById("reloj").innerHTML="12:00"</script>]}
   - Nota: Todo el código (HTML, <style> y <script>) debe ir dentro del parámetro [html].

4. **Editar aplicación existente (Skill)**
   - Comando: easyos.editskill{[name]}
   - Ejemplo: easyos.editskill{[Calculadora]}

5. **Ejecutar Skill personalizada**
   - Comando: easyos.nombre_de_la_skill{[ruta_opcional]}
   - Ejemplo: easyos.calculadora{[]}

6. **Navegador Web**
   - Comando: easyos.easyos_webbrowser{[url], [titulo]}
   - Ejemplo: easyos.easyos_webbrowser{[https://google.com], [Google]}

7. **Terminal**
   - Comando: easyos.easyos_terminal{[ruta], [comando_opcional]}
   - Ejemplo: easyos.easyos_terminal{[], []}, easyos.easyos_terminal{[EasyOS iA/users/${username}/documents], [python prueba.py]}

8. **Editor de Código**
   - Comando: easyos.easyos_editor{[ruta]}
   - Ejemplo: easyos.easyos_editor{[]}, easyos.easyos_editor{[EasyOS iA/users/usuario/documents/notas.txt]}

9. **Ejecutar Comando de Sistema**
   - Comando: easyos.runcommand{[comando_tecnico]}
   - Ejemplo: easyos.runcommand{[ls -la]}

10. **Eliminar Item**
    - Comando: easyos.removeitem{[id_o_ruta]}
    - Ejemplo: easyos.removeitem{[EasyOS iA/users/usuario/documents/viejo.txt]}

${userSkills.length > 0 ? `- Capacidades extra instaladas: ${skillsList}.\n` : ''}

Reglas Adicionales:
- Responde en español.
- **Multitarea**: Puedes incluir varios comandos en tu respuesta, cada uno en su propia línea o dentro del texto.
- **Estética EasyOS**: Diseños premium, glassmorphism, animaciones y degradados.
- Rutas relativas siempre en 'EasyOS iA/users/${username}/documents/'.`;
}

function parseCommands(text) {
    const commands = [];
    let cleanText = text;
    const startRegex = /easyos\.(\w+)\{/g;
    let match;

    const toRemove = [];

    while ((match = startRegex.exec(text)) !== null) {
        const accion = match[1];
        const matchStart = match.index;
        let lastIndex = startRegex.lastIndex;
        const pValues = [];
        
        // El lookahead busca:
        // 1. Una coma y luego el inicio de otro parámetro [
        // 2. El cierre del comando }
        const paramRegex = /\s*\[([\s\S]*?)\](?=\s*,\s*\[|\s*\})/g;
        paramRegex.lastIndex = lastIndex;
        
        let pMatch;
        while ((pMatch = paramRegex.exec(text)) !== null) {
            const gap = text.substring(lastIndex, pMatch.index).trim();
            if (gap !== "" && gap !== ",") break;
            
            pValues.push(pMatch[1]);
            lastIndex = paramRegex.lastIndex;
        }
        
        // Buscamos el cierre }
        const remaining = text.substring(lastIndex);
        const closeMatch = remaining.match(/^\s*\}/);
        if (closeMatch) {
            const fullMatchText = text.substring(matchStart, lastIndex + closeMatch[0].length);
            toRemove.push(fullMatchText);

            const parametros = {};
            const actionLower = accion.toLowerCase();

            if (actionLower === 'createfolder') {
                parametros.emoji = pValues[0];
                parametros.name = pValues[1];
            } else if (actionLower === 'savefile') {
                parametros.emoji = pValues[0];
                parametros.name = pValues[1];
                parametros.content = pValues[2];
            } else if (actionLower === 'buildskill') {
                parametros.name = pValues[0];
                parametros.emoji = pValues[1];
                parametros.html = pValues[2];
            } else if (actionLower === 'editskill') {
                parametros.name = pValues[0];
            } else if (actionLower === 'easyos_webbrowser') {
                parametros.url = pValues[0];
                parametros.title = pValues[1];
            } else if (actionLower === 'easyos_terminal' || actionLower === 'easyos_editor') {
                parametros.path = pValues[0];
            } else if (actionLower === 'runcommand') {
                parametros.cmd = pValues[0];
            } else if (actionLower === 'removeitem') {
                parametros.id_o_path = pValues[0];
            } else {
                pValues.forEach((v, i) => parametros[`arg${i}`] = v);
            }

            commands.push({ accion, parametros });
            startRegex.lastIndex = lastIndex + closeMatch[0].length;
        }
    }

    // Limpiar el texto de comandos para el diálogo
    toRemove.forEach(str => {
        cleanText = cleanText.replace(str, '');
    });

    return { commands, cleanText: cleanText.trim() };
}

export async function askAI(prompt, history = []) {
    const statusDot = document.querySelector('.dot');
    const statusText = document.querySelector('.status-text');
    const username = window.SystemAPI?.currentUser || 'usuario';
    const systemPrompt = buildSystemPrompt(username);

    const headers = { 'Content-Type': 'application/json' };
    const apiKey = window.AppConfig?.getApiKey();
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
        statusDot.classList.add('loading');
        statusText.textContent = 'Procesando...';

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: typeof msg.text === 'object' ? JSON.stringify(msg.text) : msg.text
            })),
            { role: 'user', content: prompt }
        ];

        const response = await fetch(window.AppConfig?.getApiUrl(), {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: window.AppConfig?.getModelName() || 'gemma-4',
                messages: messages,
                temperature: 0.1,
                max_tokens: 4096,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Error ${response.status}`);

        const data = await response.json();
        const rawContent = data.choices[0].message.content || '';
        let reasoning = data.choices[0].message.reasoning_content || '';

        // Extraer razonamiento si viene en etiquetas <think> (estilo DeepSeek)
        const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/);
        let finalContent = rawContent;
        if (thinkMatch) {
            reasoning = thinkMatch[1];
            finalContent = rawContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        }

        // Parsear comandos del texto
        const parsed = parseCommands(finalContent);
        const comandos = parsed.commands;
        const dialogo = parsed.cleanText;

        statusDot.classList.remove('loading');
        statusText.textContent = 'Kernel Listo';

        return {
            dialogo: dialogo || "Acción ejecutada.",
            comandos: comandos,
            thought: reasoning || null
        };
    } catch (error) {
        console.error('ERROR EN AI:', error);
        statusDot.classList.remove('loading');
        statusText.textContent = 'Error de conexión';
        return {
            dialogo: `Error al conectar con el núcleo: ${error.message}`,
            comandos: []
        };
    }
}
