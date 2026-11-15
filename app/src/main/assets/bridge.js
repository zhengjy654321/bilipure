// Lexical adapter: no unrestricted JavaScriptInterface and no credential accessor.
const orangePending = new Map();
let orangeSeq = 0;
const orangeSession = Math.random().toString(36).slice(2);
function orangeCall(op, args = {}) {
    return new Promise((resolve, reject) => {
        const id = orangeSession + ':' + (++orangeSeq);
        const timer = setTimeout(() => { orangePending.delete(id); reject(new Error('应用请求超时')); }, op === 'export' ? 300000 : 25000);
        orangePending.set(id, {resolve, reject, timer});
        OrangeHost.postMessage(JSON.stringify({id, op, ...args}));
    });
}
OrangeHost.onmessage = event => {
    try {
        const result = JSON.parse(event.data), task = orangePending.get(result.id);
        if (!task) return;
        clearTimeout(task.timer); orangePending.delete(result.id);
        result.ok ? task.resolve(result.value) : task.reject(new Error(result.error || '请求失败'));
    } catch (_) {}
};
const GM_getValue = async (key, fallback) => { const value = await orangeCall('get', {key}); return value == null ? fallback : value; };
const GM_setValue = (key, value) => orangeCall('set', {key, value});
const GM_xmlhttpRequest = options => {
    orangeCall('request', {url: options.url}).then(r => options.onload?.(r), e => options.onerror?.(e));
};
const orangeExport = data => orangeCall('export', {value:data});
