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

### REGLA DE ORO (ESTRICTA):
Tu respuesta debe ser SIEMPRE un objeto JSON puro. NO escribas explicaciones fuera del JSON. NO uses bloques de código Markdown (\`\`\`json).
Formato de respuesta:
{
  "dialogo": "Mensaje para el usuario",
  "comandos": [
    { "accion": "accion1", "parametros": { ... } },
    { "accion": "accion2", "parametros": { ... } }
  ]
}
Si no hay acciones, "comandos" debe ser un array vacío [].

### Capacidades de EasyOS:

1. **Crear Carpeta**
   - Descripción: Crea una nueva carpeta física en el directorio del usuario.
   - Acción: "createFolder"
   - Parámetros: { "emoji": "string", "name": "string" }

2. **Guardar Archivo**
   - Descripción: Crea o sobreescribe un archivo de texto con el contenido indicado.
   - Acción: "saveFile"
   - Parámetros: { "emoji": "string", "name": "string", "content": "string" }

3. **Crear o Actualizar Skill**
   - Descripción: Crea una aplicación persistente con HTML/CSS/JS.
   - Acción: "buildSkill"
   - Parámetros: { "name": "string", "emoji": "string", "html": "string", "css": "string", "js": "string" }
   - **IMPORTANTE**: El parámetro "emoji" es OBLIGATORIO.

4. **Editar Skill existente**
   - Descripción: Abre el código fuente de una Skill ya creada para que el usuario pueda modificarla.
   - Acción: "editSkill"
   - Parámetros: { "name": "string" }

5. **Ejecutar Skill personalizada**
   - Descripción: Ejecuta una de las aplicaciones instaladas previamente por el usuario.
   - Acción: Usa el NOMBRE EXACTO de la skill (ej: "calculadora")
   - Parámetros: { "path": "string (opcional)" }

6. **Navegador Web**
   - Descripción: Abre una ventana de navegación web en la URL especificada.
   - Acción: "easyos_webbrowser"
   - Parámetros: { "url": "string", "title": "string" }

7. **Terminal**
   - Descripción: Abre una consola de comandos del sistema.
   - Acción: "easyos_terminal"
   - Parámetros: { "path": "string" }

8. **Editor de Código**
   - Descripción: Abre el editor de código, opcionalmente cargando un archivo específico.
   - Acción: "easyos_editor"
   - Parámetros: { "path": "string" }

9. **Ejecutar Comando**
   - Descripción: Ejecuta un comando técnico directamente en el kernel y devuelve el resultado.
   - Acción: "runCommand"
   - Parámetros: { "cmd": "string" }

10. **Eliminar Item**
   - Descripción: Borra permanentemente un archivo, carpeta o aplicación (pide confirmación al usuario).
   - Acción: "removeItem"
   - Parámetros: { "id_o_path": "string" }

${userSkills.length > 0 ? `- Capacidades extra instaladas: ${skillsList}.\n` : ''}

Reglas Adicionales:
- Responde en español.
- **Multitarea**: Si el usuario pide varias cosas a la vez, DEBES incluir todos los comandos necesarios en el array "comandos".
- **Estética EasyOS (Dinámica y Premium)**: Las aplicaciones deben tener un diseño impactante y moderno.
  - No te limites al negro: Usa degradados elegantes (\`linear-gradient\`), transparencias (\`backdrop-filter: blur\`) y efectos de cristal (*glassmorphism*).
  - Cada aplicación puede tener su propia identidad visual (ej: tonos azules para un navegador, verdes para finanzas, etc.).
  - Usa animaciones suaves (\`transition\`, \`keyframes\`) para que la interfaz se sienta "viva".
  - Usa \`display: flex\` para layouts modernos (sidebars, toolbars).
  - Las aplicaciones NO usan iframe. Tienes acceso a una variable \`container\` (el elemento raíz de tu app) y un \`id\` único. 
  - **REGLA DE ORO (PROHIBIDO)**: NO escribas \`const container = ...\` ni \`var container = ...\`. La variable ya existe. Si la declaras, la app se romperá con un SyntaxError.
  - Para buscar elementos de tu app, usa siempre \`container.querySelector('#id-interno')\` en lugar de \`document.getElementById\`.
- Rutas relativas siempre en 'EasyOS iA/users/${username}/documents/'.
- El nombre del elemento no debe incluir la ruta completa.`;
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

        let cleanJSON = rawContent.replace(/```json\s?|```/g, '').trim();

        const thinkMatch = cleanJSON.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
            reasoning = thinkMatch[1];
            cleanJSON = cleanJSON.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        }

        let parsedResponse;

        // Fase 1: Intento de parseo directo
        try {
            parsedResponse = JSON.parse(cleanJSON);
        } catch (e) {
            console.warn("JSON directo fallido, iniciando fase de recuperación...");

            // Fase 2: Recuperación agresiva
            try {
                // 1. Extraer solo lo que está entre las primeras { y las últimas }
                const jsonMatch = cleanJSON.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("No se encontró estructura JSON");

                let toFix = jsonMatch[0];

                // 2. Escapar saltos de línea reales dentro de valores
                // Esta es una técnica para proteger los saltos de línea en bloques de código
                toFix = toFix.split('\n').map(line => {
                    // Si la línea no termina en coma, llave o corchete, probablemente es un salto interno
                    if (line.trim().match(/[^,{\[}\]]$/)) {
                        return line + "\\n";
                    }
                    return line;
                }).join('');

                parsedResponse = JSON.parse(toFix);
            } catch (e2) {
                console.error("Fallo total de parseo. Contenido original:", rawContent);
                parsedResponse = {
                    dialogo: "Lo siento, he tenido un error interno al generar el comando. ¿Podrías repetirlo?",
                    comandos: []
                };
            }
        }

        statusDot.classList.remove('loading');
        statusText.textContent = 'Kernel Listo';

        // Asegurar que comandos sea siempre un array
        if (parsedResponse.comando && !parsedResponse.comandos) {
            parsedResponse.comandos = [parsedResponse.comando];
        }
        if (!parsedResponse.comandos) parsedResponse.comandos = [];

        return {
            ...parsedResponse,
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
