/* jshint esversion: 11 */
/* globals unsafeWindow */

// Hồ sơ CHƯA "liên kết không gian" (GIS) bị cổng chặn khi bấm "Kết ISO" (API ThucHienKetISO),
// bắt người dùng tự F12 -> bắt request trong Network -> thêm tay "bypassWarning": true -> gửi lại
// (xem mplis-bypass.html, công cụ tay dùng trước khi có module này). Module này tự chèn
// bypassWarning:true vào MỌI request ThucHienKetISO của TRANG (không tự tạo request mới, không
// cần biết hoSoTiepNhanId/token nằm ở đâu - trang tự gửi đúng, tool chỉ chặn giữa đường và vá
// payload) nên không cần mở DevTools nữa. Vá cả 2 đường vì không chắc trang gọi qua $.ajax hay
// fetch() thẳng - DevTools "Copy as fetch" hiện y vậy dù request gốc là XHR.
//
// MẶC ĐỊNH TẮT: đây là bypass một cảnh báo NGHIỆP VỤ (hồ sơ có thể thật sự chưa liên kết không
// gian), không phải lỗi kỹ thuật - chỉ bật khi biết chắc hồ sơ đã đúng, chỉ vướng lỗi liên kết
// giả/kỹ thuật. Bật/tắt ở tab Cài đặt, áp dụng ngay (không cần F5) vì đọc localStorage mỗi request.

const ENABLED_KEY = 'mplis_bypass_spatial_link_enabled';
const ENDPOINT = 'ThucHienKetISO';

function isSpatialLinkBypassEnabled() {
    try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch (e) { return false; }
}

function patchJsonBody(bodyStr) {
    try {
        const obj = JSON.parse(bodyStr);
        if (obj.bypassWarning === true) return bodyStr;
        obj.bypassWarning = true;
        return JSON.stringify(obj);
    } catch (e) {
        return bodyStr; // Không parse được -> để nguyên, đừng làm hỏng request đang gửi
    }
}

function installAjaxPatch() {
    const jq = typeof unsafeWindow !== 'undefined' ? unsafeWindow.$ : null;
    if (!jq || !jq.ajaxPrefilter) return;
    jq.ajaxPrefilter((options) => {
        if (!isSpatialLinkBypassEnabled()) return;
        if (typeof options.url !== 'string' || options.url.indexOf(ENDPOINT) === -1) return;
        if (typeof options.data === 'string') {
            options.data = patchJsonBody(options.data);
        } else if (options.data && typeof options.data === 'object') {
            options.data.bypassWarning = true;
        }
        console.log('[MPLIS] Đã tự chèn bypassWarning=true vào request ' + ENDPOINT + ' (qua $.ajax).');
    });
}

function installFetchPatch() {
    if (typeof unsafeWindow === 'undefined' || typeof unsafeWindow.fetch !== 'function') return;
    if (unsafeWindow.fetch.__mplisSpatialPatched) return;
    const originalFetch = unsafeWindow.fetch;
    const patchedFetch = function (input, init) {
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (isSpatialLinkBypassEnabled() && url.indexOf(ENDPOINT) !== -1 && init && typeof init.body === 'string') {
                init = Object.assign({}, init, { body: patchJsonBody(init.body) });
                console.log('[MPLIS] Đã tự chèn bypassWarning=true vào request ' + ENDPOINT + ' (qua fetch).');
            }
        } catch (e) { }
        return originalFetch.call(this, input, init);
    };
    patchedFetch.__mplisSpatialPatched = true;
    unsafeWindow.fetch = patchedFetch;
}

installAjaxPatch();
installFetchPatch();
