// Bộ hẹn giờ chạy bằng Web Worker. Tab ẩn/thu nhỏ thì setInterval của trang bị trình duyệt
// giãn còn ~1 lần/giây (sau 5 phút còn 1 lần/phút), nên vòng quét của tool chậm hẳn. Timer
// trong Worker không bị giãn kiểu đó, nó chỉ "đánh nhịp" gửi message về trang để gọi hàm.
// Trang chặn Worker từ blob (CSP) thì lùi về setInterval thường.
export function setFastInterval(fn, ms) {
    try {
        const src = 'setInterval(function(){postMessage(0)},' + Number(ms) + ');';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const w = new Worker(url);
        URL.revokeObjectURL(url);
        let fallback = null;
        w.onmessage = () => { try { fn(); } catch (e) { console.error('[MPLIS ticker]', e); } };
        w.onerror = () => {
            try { w.terminate(); } catch (e) { }
            if (!fallback) fallback = setInterval(fn, ms);
        };
        return;
    } catch (e) {
        console.log('[MPLIS] Không tạo được Worker hẹn giờ, dùng setInterval thường:', e);
    }
    setInterval(fn, ms);
}
