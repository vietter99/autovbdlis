/* jshint esversion: 11 */
/* globals GM_xmlhttpRequest */
import { topWin } from './utils.js';
import { gmxhr } from './mplis-logger.js';

const WORK_LOGGED_KEY = 'mplis_notify_logged'; // { [soBienNhan]: true } - đã từng đẩy thành công (dùng để lọc khi pollAllStatuses)
const WORK_SHEET_URL_KEY = 'mplis_excel_sheet_url_mine';
const NOTIFY_RESOLVED_KEY = 'mplis_notify_resolved'; // { [soBienNhan]: true } - đã TRẢ hồ sơ, ngưng tra lại trạng thái

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
    const isLuuTru = item.state && item.state.State === 'LuuTru';
    const nguoiGiu = item.tenNguoiChuyenTiep || item.tenNguoiTiepNhan;
    return (!isLuuTru && nguoiGiu) ? `${buoc} - Đang ở: ${nguoiGiu}` : buoc;
}

function pushTrangThai(maHS, trangThai) {
    const url = getWorkSheetUrl();
    if (!url || typeof GM_xmlhttpRequest === 'undefined') return;
    gmxhr({
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

// Tra lại trạng thái cho tất cả hồ sơ trong WORK_LOGGED_KEY chưa đánh dấu đã trả.
// Chỉ chạy khi người dùng bấm nút "Tra trạng thái" ở tab Excel (MPLIS_POLL_ALL_STATUSES).
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

if (window === window.top) {
    topWin.MPLIS_POLL_ALL_STATUSES = pollAllStatuses;
}
