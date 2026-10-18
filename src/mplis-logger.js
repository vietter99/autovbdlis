/* jshint esversion: 11 */
/* globals unsafeWindow, GM_xmlhttpRequest */

const MAX = 100;
const _buf = [];
const LOG_ENABLED_KEY = 'mplis_log_enabled';

function now() { return Date.now(); }

export function isLogEnabled() {
    try { return localStorage.getItem(LOG_ENABLED_KEY) !== 'false'; } catch { return true; }
}

export function setLogEnabled(on) {
    try { localStorage.setItem(LOG_ENABLED_KEY, on ? 'true' : 'false'); } catch {}
}

function push(entry) {
    if (isLogEnabled()) {
        _buf.push(entry);
        if (_buf.length > MAX) _buf.shift();
    }
    window.dispatchEvent(new CustomEvent('mplis:api', { detail: entry }));
}

function epTag(url) {
    try {
        const path = new URL(url).pathname;
        // Lấy 2 segment cuối của path để dễ đọc: "HoSoQuetAjax/UpdateHoSoQuet..."
        const parts = path.split('/').filter(Boolean);
        return parts.slice(-2).join('/').slice(0, 70);
    } catch {
        return String(url).slice(-70);
    }
}

export function logEvent(action, data) {
    push({ t: now(), type: 'event', action, ...(data || {}) });
}

export function clearLog() { _buf.length = 0; }

export function getLogCount() { return _buf.length; }

export function getLogJson() {
    return JSON.stringify(_buf, null, 2);
}

function installFetchLogger() {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (!win.fetch || win.fetch.__mplisLogged) return;
    const orig = win.fetch;

    win.fetch = async function mplisLoggedFetch(input, init) {
        const url = typeof input === 'string' ? input : (input?.url ?? '');
        const method = (init?.method || 'GET').toUpperCase();
        const entry = { t: now(), type: 'fetch', ep: epTag(url), method };

        // Ghi tóm tắt request body
        const body = init?.body;
        if (body && typeof body.entries === 'function') {
            const keys = [];
            try { for (const [k] of body.entries()) keys.push(k); } catch {}
            entry.reqKeys = keys;
        } else if (typeof body === 'string') {
            entry.req = body.slice(0, 300);
        }

        let res;
        try {
            res = await orig.call(this, input, init);
        } catch (err) {
            entry.err = String(err);
            push(entry);
            throw err;
        }

        entry.status = res.status;
        try {
            const txt = await res.clone().text();
            // Thử parse JSON cho gọn; nếu không thì cắt 500 ký tự
            try { entry.res = JSON.parse(txt); } catch { entry.res = txt.slice(0, 500); }
        } catch {}

        push(entry);
        return res;
    };

    win.fetch.__mplisLogged = true;
}

function installErrorLogger() {
    window.addEventListener('error', (e) => {
        push({
            t: now(),
            type: 'jsError',
            msg: e.message,
            at: `${(e.filename || '').split('/').pop()}:${e.lineno}`
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        push({ t: now(), type: 'rejection', msg: String(e.reason) });
    });
}

export function gmxhr(opts) {
    const entry = { t: now(), type: 'gmxhr', ep: epTag(opts.url || ''), method: (opts.method || 'GET').toUpperCase() };
    if (opts.data) {
        try { entry.req = JSON.parse(opts.data); } catch { entry.req = String(opts.data).slice(0, 300); }
    }
    const origOnload = opts.onload;
    const origOnerror = opts.onerror;
    GM_xmlhttpRequest({
        ...opts,
        onload(res) {
            entry.status = res.status;
            try { entry.res = JSON.parse(res.responseText); } catch { entry.res = (res.responseText || '').slice(0, 500); }
            push(entry);
            if (origOnload) origOnload(res);
        },
        onerror(err) {
            entry.err = String(err);
            push(entry);
            if (origOnerror) origOnerror(err);
        }
    });
}

function installXhrLogger() {
    if (XMLHttpRequest.prototype.__mplisLogged) return;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._mplisMethod = String(method || 'GET').toUpperCase();
        this._mplisUrl = String(url || '');
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        const entry = { t: now(), type: 'xhr', ep: epTag(this._mplisUrl || ''), method: this._mplisMethod || 'GET' };
        if (body && typeof body === 'string') entry.req = body.slice(0, 300);
        this.addEventListener('load', function() {
            entry.status = this.status;
            try { entry.res = JSON.parse(this.responseText); } catch { entry.res = (this.responseText || '').slice(0, 500); }
            push(entry);
        });
        this.addEventListener('error', function() { entry.err = 'network error'; push(entry); });
        return origSend.apply(this, arguments);
    };
    XMLHttpRequest.prototype.__mplisLogged = true;
}

installErrorLogger();
installFetchLogger();
installXhrLogger();
