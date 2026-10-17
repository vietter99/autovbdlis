/* jshint esversion: 11 */
/* globals unsafeWindow */

// Khi lưu kho hồ sơ quét (QT2), server từ chối nếu Giấy chứng nhận chưa ký số:
// "Các tập tin sau chưa được ký số. Vui lòng ký số tập tin trước khi đính kèm!"
// Module này chặn request UpdateHoSoQuetExistFile và tự set daKySo=true cho mọi
// thành phần có laGiayChungNhan=true trước khi gửi — thay cho việc tự F12 sửa tay.
//
// MẶC ĐỊNH TẮT: đây là bypass kiểm tra nghiệp vụ (ký số GCN), không phải lỗi kỹ thuật
// — chỉ bật khi biết chắc GCN đã đúng, chỉ vướng lỗi kỹ thuật/dữ liệu. Áp dụng ngay
// (không cần F5) vì đọc localStorage mỗi request.

const ENABLED_KEY = 'mplis_bypass_dakyso_enabled';
const ENDPOINT = 'UpdateHoSoQuetExistFile';

function isBypassEnabled() {
    try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch (e) { return false; }
}

// Vá 1 chuỗi JSON của infoHoSoQuet_*: nếu laGiayChungNhan=true và daKySo=false → set daKySo=true.
function patchInfoJson(jsonStr) {
    try {
        const obj = JSON.parse(jsonStr);
        if (obj.laGiayChungNhan === true && obj.daKySo === false) {
            obj.daKySo = true;
            return { str: JSON.stringify(obj), changed: true };
        }
    } catch (e) { }
    return { str: jsonStr, changed: false };
}

// Trường hợp site gửi FormData (phổ biến hơn): duyệt từng entry, vá rồi trả FormData mới.
// Trả null nếu không cần vá.
function patchFormData(fd) {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    let anyChanged = false;
    const entries = [];
    try {
        for (const pair of fd.entries()) { entries.push(pair); }
    } catch (e) { return null; }

    // Kiểm tra trước — tránh tạo FormData mới khi không có gì cần đổi
    if (!entries.some(([k]) => /^infoHoSoQuet_\d+$/.test(k))) return null;

    const newFd = new win.FormData();
    for (const [key, value] of entries) {
        if (/^infoHoSoQuet_\d+$/.test(key) && typeof value === 'string') {
            const { str, changed } = patchInfoJson(value);
            if (changed) anyChanged = true;
            newFd.append(key, str);
        } else {
            newFd.append(key, value);
        }
    }
    return anyChanged ? newFd : null;
}

// Trường hợp site gửi multipart string (ít gặp hơn — "Copy as fetch" luôn hiện dạng này):
// phân tích từng part theo boundary rồi vá JSON bên trong.
function extractBoundary(headers) {
    let ct = '';
    try {
        if (headers && typeof headers.get === 'function') {
            ct = headers.get('content-type') || '';
        } else if (headers && typeof headers === 'object') {
            ct = headers['content-type'] || headers['Content-Type'] || '';
        }
    } catch (e) { }
    const m = ct.match(/boundary=([^\s;]+)/);
    return m ? m[1] : null;
}

function patchMultipartString(bodyStr, boundary) {
    const delim = '--' + boundary;
    const parts = bodyStr.split(delim);
    let anyChanged = false;
    const patched = parts.map(part => {
        if (!/name="infoHoSoQuet_\d+"/.test(part)) return part;
        const sepIdx = part.indexOf('\r\n\r\n');
        if (sepIdx === -1) return part;
        const head = part.slice(0, sepIdx + 4); // bao gồm \r\n\r\n
        const tail = part.slice(sepIdx + 4);
        // tail = jsonValue + "\r\n" (hoặc trống ở part cuối)
        const jsonEnd = tail.lastIndexOf('\r\n');
        const jsonStr = jsonEnd !== -1 ? tail.slice(0, jsonEnd) : tail;
        const suffix = jsonEnd !== -1 ? tail.slice(jsonEnd) : '';
        const { str, changed } = patchInfoJson(jsonStr);
        if (changed) anyChanged = true;
        return head + str + suffix;
    });
    return anyChanged ? patched.join(delim) : null;
}

function installFetchPatch() {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (typeof win.fetch !== 'function') return;
    if (win.fetch.__mplisKySoPatched) return;
    const FD = win.FormData;
    const orig = win.fetch;
    win.fetch = function (input, init) {
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (isBypassEnabled() && url.indexOf(ENDPOINT) !== -1 && init) {
                if (FD && init.body instanceof FD) {
                    const newFd = patchFormData(init.body);
                    if (newFd) {
                        init = Object.assign({}, init, { body: newFd });
                        console.log('[MPLIS] Đã vá daKySo=true vào ' + ENDPOINT + ' (FormData).');
                    }
                } else if (typeof init.body === 'string') {
                    const boundary = extractBoundary(init.headers);
                    if (boundary) {
                        const patchedStr = patchMultipartString(init.body, boundary);
                        if (patchedStr) {
                            init = Object.assign({}, init, { body: patchedStr });
                            console.log('[MPLIS] Đã vá daKySo=true vào ' + ENDPOINT + ' (string body).');
                        }
                    }
                }
            }
        } catch (e) { }
        return orig.call(this, input, init);
    };
    win.fetch.__mplisKySoPatched = true;
}

function installAjaxPatch() {
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const jq = win.$;
    if (!jq || !jq.ajaxPrefilter) return;
    const FD = win.FormData;
    jq.ajaxPrefilter((options) => {
        if (!isBypassEnabled()) return;
        if (typeof options.url !== 'string' || options.url.indexOf(ENDPOINT) === -1) return;
        if (FD && options.data instanceof FD) {
            const newFd = patchFormData(options.data);
            if (newFd) {
                options.data = newFd;
                console.log('[MPLIS] Đã vá daKySo=true vào ' + ENDPOINT + ' ($.ajax FormData).');
            }
        }
    });
}

installFetchPatch();
installAjaxPatch();
