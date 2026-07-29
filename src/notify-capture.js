/* jshint esversion: 11 */
/* globals GM_xmlhttpRequest */

// Bắt thông báo "Bạn đã nhận được 1 yêu cầu xử lý hồ sơ..." từ API nội bộ của cổng (GetNotify),
// đẩy vào tab "Thông báo nhận HS" trên Google Sheet để biết thực tế đã nhận bao nhiêu hồ sơ - vì
// kênh thông báo khác (lãnh đạo báo qua giấy/miệng) đôi khi bị thiếu/sai lệch, gây rối hồ sơ.
// Chỉ lấy WarningType === 0 (yêu cầu xử lý hồ sơ cá nhân, có số biên nhận rõ ràng); bỏ qua
// WarningType === 5 ("tập hồ sơ"/nhóm hồ sơ - không có mã hồ sơ thật để tra trạng thái).

const NOTIFY_LOGGED_KEY = 'mplis_notify_logged'; // { [Id]: true } - đã đẩy thành công (bền, qua localStorage)
const NOTIFY_SHEET_URL_KEY = 'mplis_excel_sheet_url_mine'; // dùng chung Web App URL với "của tôi"
const _notifyPending = new Set(); // khóa tạm trong phiên hiện tại, chống đẩy trùng khi poll trước chưa kịp trả lời

function isNotifyLogged(id) {
    try {
        const stored = JSON.parse(localStorage.getItem(NOTIFY_LOGGED_KEY) || '{}');
        return !!stored[id];
    } catch (e) { return false; }
}

function markNotifyLogged(id) {
    try {
        const stored = JSON.parse(localStorage.getItem(NOTIFY_LOGGED_KEY) || '{}');
        stored[id] = true;
        localStorage.setItem(NOTIFY_LOGGED_KEY, JSON.stringify(stored));
    } catch (e) { }
    _notifyPending.delete(id);
}

function getNotifySheetUrl() {
    try { return (localStorage.getItem(NOTIFY_SHEET_URL_KEY) || '').trim(); } catch (e) { return ''; }
}

// Mã hồ sơ đầy đủ (VD "H15.50-260615-0083") -> rút gọn "15-0083", cùng quy tắc với
// findCurrentMaHS() trong utils.js để khớp đúng với cột Mã HS ở tab Tổng hợp/4 xã.
function shortenMaHS(full) {
    if (!full) return '';
    const parts = full.split('-');
    if (parts.length >= 3) {
        return (parts[1].slice(-2) + '-' + parts[2]).toUpperCase();
    }
    return full.slice(-7).toUpperCase();
}

// Trích số biên nhận trực tiếp từ câu nội dung thông báo (VD "...có số biên nhận là
// H15.50-260615-0083") - chắc chắn hơn vì đúng y nguyên những gì hiển thị cho người dùng.
// Dự phòng dùng ObjectId nếu không khớp được mẫu câu.
function extractSoBienNhan(content, fallbackObjectId) {
    if (content) {
        const m = content.match(/số biên nhận là\s+([^\s]+)/i);
        if (m) return m[1];
    }
    return fallbackObjectId || '';
}

// NgayTao dạng .NET "/Date(1785292227802)/" (mili-giây) -> chuỗi ngày giờ Việt Nam.
function parseAspNetDate(str) {
    if (!str) return '';
    const m = str.match(/\/Date\((\d+)\)\//);
    if (!m) return '';
    const d = new Date(parseInt(m[1], 10));
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

function pushNotify(item) {
    const url = getNotifySheetUrl();
    if (!url) {
        console.log('[Notify] Bỏ qua đẩy - chưa cấu hình link Sheet (ô 🔗 ở tab Excel).');
        return;
    }
    if (typeof GM_xmlhttpRequest === 'undefined') {
        console.log('[Notify] Bỏ qua đẩy - GM_xmlhttpRequest không khả dụng.');
        return;
    }

    const record = {
        bucket: 'thongbao',
        maHS: shortenMaHS(extractSoBienNhan(item.WarningContent, item.ObjectId)),
        ngayNhan: parseAspNetDate(item.NgayTao),
        nguoiChuyen: item.FullNameNguoiChuyenTiep || ''
        // Nội dung: bỏ - chỉ là câu boilerplate lặp lại mã hồ sơ, không cần lưu
    };
    console.log('[Notify] Đang đẩy:', record);

    _notifyPending.add(item.Id);
    GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: JSON.stringify(record),
        headers: { 'Content-Type': 'application/json' },
        onload: function (res) {
            console.log('[Notify] Phản hồi từ Sheet:', res.status, res.responseText);
            try {
                const body = JSON.parse(res.responseText);
                if (body.ok) markNotifyLogged(item.Id);
                else _notifyPending.delete(item.Id);
            } catch (e) {
                console.log('[Notify] Không parse được phản hồi JSON:', e);
                _notifyPending.delete(item.Id);
            }
        },
        onerror: function (err) {
            console.log('[Notify] Lỗi kết nối khi đẩy lên Sheet:', err);
            _notifyPending.delete(item.Id);
        }
    });
}

// GetNotify yêu cầu 1 token chống giả mạo (anti-forgery) mà trang tự gắn vào MỌI request gọi
// qua jQuery của chính trang (cơ chế phổ biến ở ASP.NET, thường qua $.ajaxSetup/ajaxSend toàn cục).
// fetch() thuần không đi qua cơ chế đó nên bị từ chối "Invalid Token" - phải gọi qua $.ajax() của
// chính trang (unsafeWindow.$) để tự động thừa hưởng token đó, không cần biết nó nằm ở đâu.
function pollNotify() {
    const jq = typeof unsafeWindow !== 'undefined' && unsafeWindow.$ ? unsafeWindow.$ : null;
    if (!jq || !jq.ajax) {
        console.log('[Notify] Không tìm thấy jQuery ($) trên trang, không thể gọi GetNotify.');
        return;
    }
    console.log('[Notify] Đang quét GetNotify (qua $.ajax của trang)...');
    jq.ajax({
        url: 'https://dla.mplis.gov.vn/dc/DangKyAjax/GetNotify',
        method: 'POST',
        data: { start: 0, length: 50 }
    }).done((json) => {
        if (!json || !json.success || !Array.isArray(json.Value)) {
            console.log('[Notify] Phản hồi GetNotify không đúng dạng mong đợi:', json);
            return;
        }
        console.log(`[Notify] Nhận được ${json.Value.length} thông báo (tổng chưa xem: ${json.totalChuaXem}).`);
        json.Value.forEach((item) => {
            if (item.WarningType !== 0) return;
            if (!item.Id || !item.ObjectId) return;
            if (_notifyPending.has(item.Id) || isNotifyLogged(item.Id)) {
                console.log('[Notify] Bỏ qua (đã đẩy trước đó):', item.ObjectId);
                return;
            }
            pushNotify(item);
        });
    }).fail((xhr) => {
        console.log('[Notify] Lỗi khi gọi GetNotify:', xhr.status, xhr.responseText);
    });
}

if (window === window.top) {
    setTimeout(pollNotify, 3000);
    setInterval(pollNotify, 30000);
}
