// emoji: "🌐"
() => {
    return function(urlOrOpts = {}) {
        let url, options;
        if (typeof urlOrOpts === 'string') {
            url = urlOrOpts;
            options = arguments[1] || {};
        } else {
            options = urlOrOpts;
            url = options.url;
        }
        const id = 'web-' + Math.random().toString(36).substr(2, 9);
        
        const initBrowser = async () => {
            let finalUrl = url;
            if (!finalUrl && options.path) {
                const absPath = await window.EasyOS.getAbsolutePath(options.path);
                finalUrl = 'file://' + absPath.replace(/\\/g, '/');
            }
            if (!finalUrl) finalUrl = 'https://www.google.com';
            
            const content = `
                <div style="display:flex; flex-direction:column; height:100%; font-family:sans-serif; background:#f1f3f4;">
                    <div style="display:flex; gap:10px; padding:8px 15px; background:#dee1e6; border-bottom:1px solid #ccc; align-items:center;">
                        <div style="display:flex; gap:5px;">
                            <button id="back-${id}" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#5f6368;">◀</button>
                            <button id="forward-${id}" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#5f6368;">▶</button>
                            <button id="reload-${id}" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#5f6368;">↻</button>
                        </div>
                        <div style="flex:1; display:flex; align-items:center; background:white; border-radius:20px; padding:4px 12px; border:1px solid #ced4da;">
                            <span style="margin-right:8px; font-size:0.8rem;">🔒</span>
                            <input id="url-input-${id}" type="text" value="${finalUrl}" 
                                style="width:100%; border:none; outline:none; font-size:0.9rem; color:#202124;">
                        </div>
                    </div>
                    <webview id="view-${id}" src="${finalUrl}" style="flex:1; width:100%; background:white;" 
                        allowpopups 
                        webpreferences="contextIsolation=no, allowRunningInsecureContent=yes"></webview>
                </div>
            `;

            window.EasyOS.createWindow({
                title: options.title || '🌐 Navegador Web',
                content: content,
                width: options.width || '1000px',
                height: options.height || '700px'
            });

            setTimeout(() => {
                const webview = document.getElementById(`view-${id}`);
                const input = document.getElementById(`url-input-${id}`);
                if (!webview || !input) return;

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        let target = input.value;
                        if (!target.startsWith('http') && !target.startsWith('file://')) {
                            if (target.includes('.') && !target.includes(' ')) target = 'https://' + target;
                            else target = 'https://www.google.com/search?q=' + encodeURIComponent(target);
                        }
                        webview.src = target;
                    }
                };
                document.getElementById(`back-${id}`).onclick = () => webview.canGoBack() && webview.goBack();
                document.getElementById(`forward-${id}`).onclick = () => webview.canGoForward() && webview.goForward();
                document.getElementById(`reload-${id}`).onclick = () => webview.reload();
                webview.addEventListener('did-navigate', (e) => { input.value = e.url; });
            }, 100);
        };

        initBrowser();
        return id;
    };
}
