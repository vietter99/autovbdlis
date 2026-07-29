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

// ObjectId dạng đầy đủ "H15.50-260626-0251" -> mã hồ sơ rút gọn "26-0251", cùng quy tắc với
// findCurrentMaHS() trong utils.js để khớp đúng với cột Mã HS ở tab Tổng hợp/4 xã.
function deriveMaHSFromObjectId(objectId) {
    if (!objectId) return '';
    const parts = objectId.split('-');
    if (parts.length >= 3) {
        return (parts[1].slice(-2) + '-' + parts[2]).toUpperCase();
    }
    return objectId.slice(-7).toUpperCase();
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
    if (!url) return;
    if (typeof GM_xmlhttpRequest === 'undefined') return;

    const record = {
        bucket: 'thongbao',
        maHS: deriveMaHSFromObjectId(item.ObjectId),
        ngayNhan: parseAspNetDate(item.NgayTao),
        nguoiChuyen: item.FullNameNguoiChuyenTiep || '',
        noiDung: item.WarningContent || ''
    };

    _notifyPending.add(item.Id);
    GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: JSON.stringify(record),
        headers: { 'Content-Type': 'application/json' },
        onload: function (res) {
            try {
                const body = JSON.parse(res.responseText);
                if (body.ok) markNotifyLogged(item.Id);
                else _notifyPending.delete(item.Id);
            } catch (e) { _notifyPending.delete(item.Id); }
        },
        onerror: function () { _notifyPending.delete(item.Id); }
    });
}

function pollNotify() {
    fetch('https://dla.mplis.gov.vn/dc/DangKyAjax/GetNotify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: 'start=0&length=50'
    })
        .then((res) => res.json())
        .then((json) => {
            if (!json || !json.success || !Array.isArray(json.Value)) return;
            json.Value.forEach((item) => {
                if (item.WarningType !== 0) return;
                if (!item.Id || !item.ObjectId) return;
                if (_notifyPending.has(item.Id) || isNotifyLogged(item.Id)) return;
                pushNotify(item);
            });
        })
        .catch(() => { });
}

if (window === window.top) {
    setTimeout(pollNotify, 3000);
    setInterval(pollNotify, 30000);
}
