// Logic dùng chung cho việc ghi "Sổ địa chính" từ excel-module.js (quét cây #treeGiayChungNhan
// lúc QT3 - nguồn DUY NHẤT, đã bỏ nguồn dự phòng #tblGiayChungNhan ở QT1/QT2 vì gây trùng dữ liệu).
//
// Ngày ký GCN/Số vào sổ thường CHƯA có ngay khi GCN mới in - người dùng cập nhật thủ công trên
// cổng SAU đó, rồi mở lại cây GCN thì cây mới hiện đủ thông tin. Vì vậy "đã đẩy" không được chặn
// vĩnh viễn theo Số phát hành như trước - phải nhớ CHỮ KÝ dữ liệu (Số vào sổ + Ngày ký) đã đẩy lần
// gần nhất, nếu lần quét sau thấy dữ liệu khác đi (đầy đủ hơn) thì vẫn cho đẩy lại để Apps Script
// cập nhật ĐÈ lên dòng cũ theo Số phát hành (xem handleSoDiaChinh), không tạo dòng trùng mới.

const LOGGED_KEY = 'mplis_sodiachinh_logged'; // { [soPhatHanh]: "soVaoSo|ngayKyGCN" } - chữ ký dữ liệu đã ghi THÀNH CÔNG lần gần nhất (bền, qua localStorage)
const SHEET_URL_KEY = 'mplis_excel_sheet_url_mine';

// Khóa tạm trong lúc đang chờ phản hồi server - CHỈ sống trong phiên trang hiện tại (không cần
// lưu localStorage), để chặn vòng quét kế tiếp (chạy mỗi 1s) gửi trùng 1 bản ghi khi request
// trước đó chưa kịp có phản hồi (đây chính là nguyên nhân gây ghi trùng 2 lần lên Sheet).
const _pendingKeys = new Set();

function getSoDiaChinhSignature(record) {
    return (record.soVaoSo || '') + '|' + (record.ngayKyGCN || '');
}

function getSoDiaChinhLoggedSignature(key) {
    try {
        const stored = JSON.parse(localStorage.getItem(LOGGED_KEY) || '{}');
        return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : null;
    } catch (e) { return null; }
}

// Chỉ coi là "khỏi cần đẩy lại" khi CHỮ KÝ dữ liệu (Số vào sổ + Ngày ký) không đổi so với lần
// đẩy thành công gần nhất. Nếu khác đi (VD Số vào sổ vừa được điền thêm) thì vẫn cho đẩy lại.
function isSoDiaChinhPendingOrLogged(key, record) {
    if (_pendingKeys.has(key)) return true;
    const loggedSig = getSoDiaChinhLoggedSignature(key);
    if (loggedSig === null) return false;
    return loggedSig === getSoDiaChinhSignature(record);
}

function markSoDiaChinhLogged(key, record) {
    try {
        const stored = JSON.parse(localStorage.getItem(LOGGED_KEY) || '{}');
        stored[key] = getSoDiaChinhSignature(record);
        localStorage.setItem(LOGGED_KEY, JSON.stringify(stored));
    } catch (e) { }
    _pendingKeys.delete(key);
}

function getSoDiaChinhSheetUrl() {
    try { return (localStorage.getItem(SHEET_URL_KEY) || '').trim(); } catch (e) { return ''; }
}

function setSoDiaChinhStatus(text, ok) {
    const el = document.getElementById('excel-sheet-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? '#22c55e' : '#f43f5e';
}

// key = Số phát hành (định danh duy nhất của 1 GCN). Khóa "pending" ngay khi gọi (trước khi có
// phản hồi), chỉ đánh dấu "đã ghi" vĩnh viễn SAU KHI server xác nhận thành công; nếu lỗi thì mở
// khóa lại để lần quét sau tự thử lại, không bị kẹt vĩnh viễn.
function pushSoDiaChinh(key, record) {
    const url = getSoDiaChinhSheetUrl();
    if (!url) return;
    if (typeof GM_xmlhttpRequest === 'undefined') return;

    _pendingKeys.add(key);

    GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: JSON.stringify({ bucket: 'sodiachinh', ...record }),
        headers: { 'Content-Type': 'application/json' },
        onload: function (res) {
            try {
                const body = JSON.parse(res.responseText);
                if (body.ok) {
                    setSoDiaChinhStatus('✅ đã đồng bộ (Sổ địa chính)', true);
                    markSoDiaChinhLogged(key, record);
                } else {
                    setSoDiaChinhStatus('❌ ' + (body.error || 'lỗi'), false);
                    _pendingKeys.delete(key);
                }
            } catch (e) {
                setSoDiaChinhStatus('❌ phản hồi lạ', false);
                _pendingKeys.delete(key);
            }
        },
        onerror: function () {
            setSoDiaChinhStatus('❌ lỗi kết nối', false);
            _pendingKeys.delete(key);
        }
    });
}

export { isSoDiaChinhPendingOrLogged, markSoDiaChinhLogged, pushSoDiaChinh };
