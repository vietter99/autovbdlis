/* jshint esversion: 11 */
/* globals unsafeWindow, GM_addStyle, GM_setClipboard */

// Side-effecting imports: order matches the original monolith's top-to-bottom
// execution (confirm/alert override must run before the panel CSS/DOM exist).
import { topWin } from './utils.js';
import './panel-style.js';
import { injectPanel } from './inject-panel.js';
import { initRunToast } from './run-toast.js';
import { toggleProcess, toggleReturn } from './toggle.js';
import './receipt-copy.js';
import './bien-dong-capture.js';
import './phaply-default.js';
import './notify-capture.js';
import './spatial-link-bypass.js';

    if (window === window.top) {
        const checkBody = setInterval(() => {
            if (document.body) { clearInterval(checkBody); injectPanel(); initRunToast(); }
        }, 300);
        topWin.MPLIS_AUTO_TOGGLE_FUNC = toggleProcess;
        topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC = toggleReturn;
    }

    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'đ' || e.key === 'Đ')) {
            e.preventDefault();
            // Chỉ bật/tắt "Trả hồ sơ" khi ĐANG mở đúng tab đó; còn lại (kể cả tab Nhắc nhở,
            // Excel...) đều bật/tắt "Xử lý". Trước đây điều kiện ngược lại (không phải tab Xử lý
            // thì chạy Trả hồ sơ) - từ khi tab Trả hồ sơ bị ẩn, bấm Alt+S ở tab Excel sẽ vô tình
            // khởi động auto TRẢ HỒ SƠ thật trên cổng mà không ai để ý.
            const returnTab = document.getElementById('tab-return');
            if (returnTab && returnTab.classList.contains('active')) {
                if (window === window.top) toggleReturn();
                else try { if (typeof topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC(); } catch (err) { }
            } else {
                if (window === window.top) toggleProcess();
                else try { if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC(); } catch (err) { }
            }
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
