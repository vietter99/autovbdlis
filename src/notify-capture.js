/* jshint esversion: 11 */
/* globals GM_xmlhttpRequest */
import { topWin } from './utils.js';

// Theo dõi "công việc cần xử lý" qua API nội bộ GetXuLyCongViec - chính là API đứng sau trang
// Xử Lý Công Việc của cổng, CHÍNH XÁC HƠN GetNotify (popup thông báo hay bị thiếu/trễ/sai).
// Mỗi lần quét lấy toàn bộ danh sách hồ sơ đang cần xử lý hiện tại, so với danh sách "đã biết"
// (lưu trong localStorage theo Mã hồ sơ) để tìm hồ sơ MỚI xuất hiện, rồi đẩy lên Google Sheet
// tab "Thông báo nhận HS" - giải quyết vấn đề thông báo miệng/giấy từ lãnh đạo hay thiếu/sai lệch.

const WORK_LOGGED_KEY = 'mplis_notify_logged'; // { [soBienNhan]: true } - đã đẩy thành công (bền, qua localStorage)
const WORK_SHEET_URL_KEY = 'mplis_excel_sheet_url_mine'; // dùng chung Web App URL với "của tôi"
const NOTIFY_ACCOUNT_FILTER_KEY = 'mplis_notify_account_filter'; // lọc theo nguoiTiepNhan (tài khoản đăng nhập) - đề phòng đồng nghiệp cùng dùng tool, tránh lẫn hồ sơ của nhau
const NOTIFY_RESOLVED_KEY = 'mplis_notify_resolved'; // { [soBienNhan]: true } - đã TRẢ hồ sơ, ngưng tra lại trạng thái để đỡ tốn request mỗi lần F5
const _workPending = new Set(); // khóa tạm trong phiên hiện tại, chống đẩy trùng khi quét trước chưa kịp trả lời

function getNotifyAccountFilter() {
    try { return (localStorage.getItem(NOTIFY_ACCOUNT_FILTER_KEY) || '').trim().toLowerCase(); } catch (e) { return ''; }
}

function isWorkLogged(soBienNhan) {
    try {
        const stored = JSON.parse(localStorage.getItem(WORK_LOGGED_KEY) || '{}');
        return !!stored[soBienNhan];
    } catch (e) { return false; }
}

function markWorkLogged(soBienNhan) {
    try {
        const stored = JSON.parse(localStorage.getItem(WORK_LOGGED_KEY) || '{}');
        stored[soBienNhan] = true;
        localStorage.setItem(WORK_LOGGED_KEY, JSON.stringify(stored));
    } catch (e) { }
    _workPending.delete(soBienNhan);
}

function getWorkSheetUrl() {
    try { return (localStorage.getItem(WORK_SHEET_URL_KEY) || '').trim(); } catch (e) { return ''; }
}

function isNotifyResolved(soBienNhan) {
    try {
        const stored = JSON.parse(localStorage.getItem(NOTIFY_RESOLVED_KEY) || '{}');
        return !!stored[soBienNhan];
    } catch (e) { return false; }
}

function markNotifyResolved(soBienNhan) {
    try {
        const stored = JSON.parse(localStorage.getItem(NOTIFY_RESOLVED_KEY) || '{}');
        stored[soBienNhan] = true;
        localStorage.setItem(NOTIFY_RESOLVED_KEY, JSON.stringify(stored));
    } catch (e) { }
}

// diaChiTaiSan dạng "Thôn Phước Lộc, Xã Tam Giang, Tỉnh Đắk Lắk" -> lấy riêng tên xã/phường/thị trấn.
function extractXa(diaChiTaiSan) {
    if (!diaChiTaiSan) return '';
    const m = diaChiTaiSan.match(/(?:Xã|Phường|Thị trấn)\s+([^,]+)/i);
    return m ? m[1].trim() : '';
}

// Các trường ngày của GetXuLyCongViec ở dạng .NET "/Date(1783063772000)/" (mili-giây) -> chuỗi ngày giờ Việt Nam.
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

function pushWork(item) {
    const url = getWorkSheetUrl();
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
        maHS: item.soBienNhan || '',
        ngayNhan: parseAspNetDate(item.ngayPhanCong),
        nguoiChuyen: item.tenNguoiChuyenTiep || '',
        nguoiNop: item.nguoiNopDon ? (item.nguoiNopDon.hoTen || '') : '',
        xa: extractXa(item.diaChiTaiSan),
        tenTTHC: item.quytrinh ? (item.quytrinh.SchemaName || '') : ''
    };
    _workPending.add(item.soBienNhan);
    GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: JSON.stringify(record),
        headers: { 'Content-Type': 'application/json' },
        onload: function (res) {
            console.log('[Notify] Phản hồi từ Sheet:', res.status, res.responseText);
            try {
                const body = JSON.parse(res.responseText);
                if (body.ok) markWorkLogged(item.soBienNhan);
                else _workPending.delete(item.soBienNhan);
            } catch (e) {
                console.log('[Notify] Không parse được phản hồi JSON:', e);
                _workPending.delete(item.soBienNhan);
            }
        },
        onerror: function (err) {
            console.log('[Notify] Lỗi kết nối khi đẩy lên Sheet:', err);
            _workPending.delete(item.soBienNhan);
        }
    });
}

// Ghép câu trạng thái theo đúng kiểu chữ cổng tự hiển thị ở trang Tra cứu hồ sơ (VD "Đã kết ISO
// ngày 31/07/2026 12:45") - dữ liệu thô không có sẵn câu này, cổng tự ghép từ daTra/daKetISO/
// daCapNhatDuLieuPhapLy + ngày tương ứng, nên ở đây ghép lại y hệt thứ tự ưu tiên (mốc cao nhất
// đã đạt được). Nếu chưa qua mốc nào thì hiện bước quy trình hiện tại + người đang giữ hồ sơ.
function formatTrangThaiChiTiet(item) {
    if (item.daTra) {
        return 'Đã trả kết quả ngày ' + parseAspNetDate(item.ngayTra);
    }
    if (item.daKetISO) {
        return 'Đã kết ISO ngày ' + parseAspNetDate(item.ngayKetISO);
    }
    if (item.daCapNhatDuLieuPhapLy) {
        return 'Đã cập nhật dữ liệu pháp lý ngày ' + parseAspNetDate(item.ngayCapNhatDuLieuPhapLy);
    }
    const buoc = (item.state && item.state.Title) || 'Đang xử lý';
    // "Lưu trữ hồ sơ" nghĩa là hồ sơ đã quay về tài khoản tiếp nhận (tự mình), KHÔNG còn nằm bên
    // tenNguoiChuyenTiep (người được chuyển tới ở bước xử lý trước đó) - nên bỏ "Đang ở" ở mốc này.
    const isLuuTru = item.state && item.state.State === 'LuuTru';
    const nguoiGiu = item.tenNguoiChuyenTiep || item.tenNguoiTiepNhan;
    return (!isLuuTru && nguoiGiu) ? `${buoc} - Đang ở: ${nguoiGiu}` : buoc;
}

function pushTrangThai(maHS, trangThai) {
    const url = getWorkSheetUrl();
    if (!url || typeof GM_xmlhttpRequest === 'undefined') return;
    GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: JSON.stringify({ bucket: 'thongbao_trangthai', maHS, trangThai }),
        headers: { 'Content-Type': 'application/json' },
        onload: function (res) {
            console.log('[Notify] Cập nhật trạng thái', maHS, ':', res.status, res.responseText);
        },
        onerror: function (err) {
            console.log('[Notify] Lỗi kết nối khi cập nhật trạng thái', maHS, ':', err);
        }
    });
}

// Tra 1 hồ sơ cụ thể qua AdvancedSearchHoSoTiepNhan - đúng API gốc của trang "Cung cấp thông tin
// hồ sơ tiếp nhận" (tra cứu hồ sơ) mà cổng dùng để hiển thị Trạng thái, khác với GetXuLyCongViec
// (chỉ trả hồ sơ "sắp đến hạn"). tinhId/huyenId cố định theo đơn vị đang dùng tool (Đắk Lắk /
// Krông Năng), lấy đúng từ request thật bắt qua DevTools.
function checkOneStatus(maHS) {
    const jq = typeof unsafeWindow !== 'undefined' && unsafeWindow.$ ? unsafeWindow.$ : null;
    if (!jq || !jq.ajax) return;
    jq.ajax({
        url: 'https://dla.mplis.gov.vn/dc/DangKyAjax/AdvancedSearchHoSoTiepNhan',
        method: 'POST',
        data: {
            start: 0,
            length: 10,
            'model[tinhId]': 66,
            'model[huyenId]': 650,
            'model[xaId]': '',
            'model[quytrinh]': '',
            'model[state]': '',
            'model[soBienNhan]': maHS,
            'model[laHoSoMotCua]': false,
            'model[tiepNhanTuNgay]': '',
            'model[tiepNhanDenNgay]': '',
            'model[henTraTuNgay]': '',
            'model[henTraDenNgay]': '',
            'model[trangThaiHoSo]': 0,
            'model[trangThaiKetISO][]': 0,
            'model[diaChiTaiSan]': '',
            'model[soThua]': '',
            'model[soTo]': '',
            'model[diaChi]': '',
            'model[hoTen]': '',
            'model[soDienThoai]': '',
            'model[giayChungMinh]': '',
            'model[daXuLy]': -1
        }
    }).done((json) => {
        if (!json || !Array.isArray(json.data) || json.data.length === 0) {
            console.log('[Notify] Không tìm thấy hồ sơ khi tra trạng thái:', maHS);
            return;
        }
        const item = json.data.find((d) => d.soBienNhan === maHS) || json.data[0];
        pushTrangThai(maHS, formatTrangThaiChiTiet(item));
        if (item.daTra) markNotifyResolved(maHS);
    }).fail((xhr) => {
        console.log('[Notify] Lỗi khi tra trạng thái', maHS, ':', xhr.status, xhr.responseText);
    });
}

// Tra lại trạng thái cho TẤT CẢ hồ sơ đã từng đẩy vào "Thông báo nhận HS" mà chưa đánh dấu đã
// trả - mỗi hồ sơ 1 request riêng (search[value]) vì pollWorkList chỉ lấy được hồ sơ "sắp đến
// hạn", không bao quát hồ sơ đã qua giai đoạn đó nhưng vẫn chưa trả xong. Gọi TUẦN TỰ (cách nhau
// STATUS_POLL_DELAY_MS), không bắn hết cùng lúc - nếu có hàng chục hồ sơ mà gọi đồng thời sẽ làm
// nghẽn trình duyệt/hệ thống, gây "Đang xử lý..." kéo dài, khó thao tác trên trang. KHÔNG còn tự
// chạy mỗi lần tải trang (quá nặng nếu có vài chục hồ sơ) - chỉ chạy khi người dùng bấm nút
// "Tra trạng thái" ở tab Excel (xem MPLIS_POLL_ALL_STATUSES trong inject-panel.js).
const STATUS_POLL_DELAY_MS = 600;
function pollAllStatuses(onProgress) {
    let logged = {};
    try { logged = JSON.parse(localStorage.getItem(WORK_LOGGED_KEY) || '{}'); } catch (e) { }
    const maHSList = Object.keys(logged).filter((maHS) => !isNotifyResolved(maHS));
    console.log(`[Notify] Đang tra trạng thái thời gian thực cho ${maHSList.length} hồ sơ chưa trả (tuần tự, cách nhau ${STATUS_POLL_DELAY_MS}ms)...`);
    if (onProgress) onProgress(0, maHSList.length);
    maHSList.forEach((maHS, idx) => {
        setTimeout(() => {
            checkOneStatus(maHS);
            if (onProgress) onProgress(idx + 1, maHSList.length);
        }, idx * STATUS_POLL_DELAY_MS);
    });
}

// GetXuLyCongViec cũng cần token chống giả mạo (header __requestverificationtoken) mà trang tự
// gắn vào MỌI request gọi qua jQuery của chính trang - phải gọi qua $.ajax() của trang
// (unsafeWindow.$) để tự động thừa hưởng token đó, không cần biết nó nằm ở đâu (giống GetNotify).
// Payload dưới đây sao y nguyên request thật của trang Xử Lý Công Việc (bắt qua DevTools).
function pollWorkList() {
    const jq = typeof unsafeWindow !== 'undefined' && unsafeWindow.$ ? unsafeWindow.$ : null;
    if (!jq || !jq.ajax) {
        console.log('[Notify] Không tìm thấy jQuery ($) trên trang, không thể gọi GetXuLyCongViec.');
        return;
    }
    console.log('[Notify] Đang quét GetXuLyCongViec (qua $.ajax của trang)...');
    jq.ajax({
        url: 'https://dla.mplis.gov.vn/dc/DangKyAjax/GetXuLyCongViec',
        method: 'POST',
        data: {
            draw: 1,
            'columns[0][data]': 'stt',
            'columns[0][name]': '',
            'columns[0][searchable]': true,
            'columns[0][orderable]': false,
            'columns[0][search][value]': '',
            'columns[0][search][regex]': false,
            'columns[1][data]': 'soBienNhan',
            'columns[1][name]': '',
            'columns[1][searchable]': true,
            'columns[1][orderable]': false,
            'columns[1][search][value]': '',
            'columns[1][search][regex]': false,
            'order[0][column]': 0,
            'order[0][dir]': 'asc',
            start: 0,
            length: 100,
            'search[value]': '',
            'search[regex]': false,
            query: '',
            soNgayCanhBaoHoSoSapDenNgayTra: 7,
            sortField: 'ngayhenTra',
            sortDirection: 'asc',
            filterBy: 0
        }
    }).done((json) => {
        if (!json || !Array.isArray(json.data)) {
            console.log('[Notify] Phản hồi GetXuLyCongViec không đúng dạng mong đợi:', json);
            return;
        }
        console.log(`[Notify] Nhận được ${json.data.length} hồ sơ đang cần xử lý.`);
        const accountFilter = getNotifyAccountFilter();
        if (!accountFilter) {
            console.log('[Notify] ⚠️ CHƯA cấu hình "TK lọc (Th.báo HS)" ở tab Excel (🔗) - sẽ đẩy TẤT CẢ hồ sơ trả về, kể cả của đồng nghiệp nếu API trả về chung cho cả đơn vị.');
        }
        // Chỉ đẩy hồ sơ MỚI (chưa từng đẩy) - và đẩy TUẦN TỰ (cách nhau STATUS_POLL_DELAY_MS)
        // thay vì cùng lúc, phòng trường hợp phát hiện nhiều chục hồ sơ mới 1 lượt (VD lần đầu
        // dùng tool) làm nhiều request tới Apps Script cùng lúc, dễ gây mất dữ liệu (xem doPost).
        // Tên trường "người tiếp nhận" không rõ chính xác là nguoiTiepNhan hay tenNguoiTiepNhan
        // (API khác - AdvancedSearchHoSoTiepNhan - dùng "tenNguoiTiepNhan", cùng chung shape dữ
        // liệu) nên thử CẢ HAI, phòng khi 1 trong 2 không tồn tại khiến lọc luôn sai/lọt hồ sơ.
        const newItems = json.data.filter((item) => {
            if (!item.soBienNhan) return false;
            if (accountFilter) {
                const owner = (item.nguoiTiepNhan || item.tenNguoiTiepNhan || '').trim().toLowerCase();
                if (owner !== accountFilter) return false;
            }
            return !_workPending.has(item.soBienNhan) && !isWorkLogged(item.soBienNhan);
        });
        if (accountFilter && json.data.length > 0 && newItems.length === 0) {
            const sample = json.data[0];
            console.log('[Notify] Lọc theo TK "' + accountFilter + '" không khớp hồ sơ nào. Mẫu 1 hồ sơ để kiểm tra tên trường:', sample);
        }
        newItems.forEach((item, idx) => {
            setTimeout(() => pushWork(item), idx * STATUS_POLL_DELAY_MS);
        });
    }).fail((xhr) => {
        console.log('[Notify] Lỗi khi gọi GetXuLyCongViec:', xhr.status, xhr.responseText);
    });
}

// Chỉ tự quét hồ sơ MỚI (pollWorkList) 1 lần lúc tải trang (F5). Tra trạng thái toàn bộ
// (pollAllStatuses) KHÔNG tự chạy nữa - quá nặng nếu có vài chục hồ sơ đang theo dõi, chỉ chạy
// khi người dùng chủ động bấm nút "Tra trạng thái" ở tab Excel (xem inject-panel.js).
if (window === window.top) {
    setTimeout(pollWorkList, 3000);
    topWin.MPLIS_POLL_ALL_STATUSES = pollAllStatuses;
}
