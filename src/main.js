/* jshint esversion: 11 */
/* globals unsafeWindow, GM_addStyle, GM_setClipboard */

// Side-effecting imports: order matches the original monolith's top-to-bottom
// execution (confirm/alert override must run before the panel CSS/DOM exist).
import { topWin } from './utils.js';
import './panel-style.js';
import { injectPanel } from './inject-panel.js';
import { initRunToast } from './run-toast.js';
import { toggleProcess } from './toggle.js';
import './receipt-copy.js';
import './bien-dong-capture.js';
import './phaply-default.js';
import './filename-copy.js';
import './spatial-link-bypass.js';
import './dakyso-bypass.js';

    if (window === window.top) {
        // Giữ tab "active" - Chrome không throttle setInterval khi chạy ngầm
        if ('locks' in navigator) {
            navigator.locks.request('mplis-keepalive', { mode: 'shared' }, () => new Promise(() => {}));
        }
        const checkBody = setInterval(() => {
            if (document.body) { clearInterval(checkBody); injectPanel(); initRunToast(); }
        }, 300);
        topWin.MPLIS_AUTO_TOGGLE_FUNC = toggleProcess;
        // Dọn khoá cũ của tính năng đã bỏ để trả lại chỗ cho bộ nhớ trình duyệt.
        try { ['mplis_notify_logged', 'mplis_notify_resolved'].forEach(k => localStorage.removeItem(k)); } catch (e) { }
    }

    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'đ' || e.key === 'Đ')) {
            e.preventDefault();
            if (window === window.top) toggleProcess();
            else try { if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC(); } catch (err) { }
        } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            if (window === window.top) {
                const panel = document.getElementById('mplis-auto-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                }
            }
        }
    });
