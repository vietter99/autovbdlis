import { findCurrentMaHS } from './utils.js';

// Ghi nhận "Sổ địa chính" (sổ cấp GCN) mỗi khi thấy #tblGiayChungNhan trên màn "Cập nhật pháp lý
// giấy chứng nhận" (QT1). Chỉ lấy dòng "Giấy in mới" đã có "Ngày vào sổ" (còn trống nghĩa là
// chưa xong, chờ lượt quét sau). Dùng chung link Google Sheet với ExcelModule ("của tôi"),
// chỉ khác bucket = 'sodiachinh' để Apps Script route sang đúng tab "Sổ địa chính".

const LOGGED_KEY = 'mplis_sodiachinh_logged'; // { [soPhatHanh]: true } - chống ghi trùng
const SHEET_URL_KEY = 'mplis_excel_sheet_url_mine';

function isLogged(soPhatHanh) {
    try {
        const stored = JSON.parse(localStorage.getItem(LOGGED_KEY) || '{}');
        return !!stored[soPhatHanh];
    } catch (e) { return false; }
}

function markLogged(soPhatHanh) {
    try {
        const stored = JSON.parse(localStorage.getItem(LOGGED_KEY) || '{}');
        stored[soPhatHanh] = true;
        localStorage.setItem(LOGGED_KEY, JSON.stringify(stored));
    } catch (e) { }
}

function getSheetUrl() {
    try { return (localStorage.getItem(SHEET_URL_KEY) || '').trim(); } catch (e) { return ''; }
}

function setStatus(text, ok) {
    const el = document.getElementById('excel-sheet-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? '#22c55e' : '#f43f5e';
}

// Tìm Xã của mã hồ sơ hiện tại - dùng lại đúng cách dò của ExcelModule (bảng danh sách hồ sơ nền)
function findXaForMaHS(maHS) {
    if (!maHS) return '';
    const trs = Array.from(document.querySelectorAll('tr[role="row"]'));
    for (const tr of trs) {
        if (tr.textContent.includes(maHS)) {
            const col1 = tr.querySelector('.col-md-3:nth-child(1)');
            if (col1) {
                const mapMarker = col1.querySelector('.fa-map-marker');
                if (mapMarker && mapMarker.parentNode) {
                    let fullAddr = mapMarker.parentNode.textContent.trim();
                    fullAddr = fullAddr.split('(')[0].trim();
                    fullAddr = fullAddr.replace(/xã |phường |thị trấn /gi, '').trim();
                    return fullAddr.toUpperCase();
                }
            }
            break;
        }
    }
    return '';
}

function pushSoDiaChinh(record) {
    const url = getSheetUrl();
    if (!url) return;
    if (typeof GM_xmlhttpRequest === 'undefined') return;

    GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: JSON.stringify({ bucket: 'sodiachinh', ...record }),
        headers: { 'Content-Type': 'application/json' },
        onload: function (res) {
            try {
                const body = JSON.parse(res.responseText);
                if (body.ok) setStatus('✅ đã đồng bộ (Sổ địa chính)', true);
                else setStatus('❌ ' + (body.error || 'lỗi'), false);
            } catch (e) {
                setStatus('❌ phản hồi lạ', false);
            }
        },
        onerror: function () {
            setStatus('❌ lỗi kết nối', false);
        }
    });
}

setInterval(() => {
    const table = document.getElementById('tblGiayChungNhan');
    if (!table) return;
    try { if (table.getBoundingClientRect().width === 0) return; } catch (e) { return; }

    const maHS = findCurrentMaHS();
    const xa = findXaForMaHS(maHS);

    const rows = Array.from(table.querySelectorAll('tbody tr[role="row"]'));
    rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        if (cells.length < 6) return;

        // Cột: Loại giấy | Người được cấp giấy | Số phát hành | Số hồ sơ gốc | Số vào sổ | Ngày vào sổ | Mã vạch
        const loaiGiay = (cells[0].textContent || '').trim();
        if (loaiGiay !== 'Giấy in mới') return;

        const nguoiDuocCap = (cells[1].textContent || '').trim();
        const soPhatHanh = (cells[2].textContent || '').trim();
        const ngayVaoSo = (cells[5].textContent || '').trim();

        if (!soPhatHanh || !ngayVaoSo) return; // Chưa vào sổ xong (cột trống) - chờ quét lại sau
        if (isLogged(soPhatHanh)) return;

        markLogged(soPhatHanh);
        pushSoDiaChinh({
            nguoiDuocCap,
            soPhatHanh,
            ngayKyGCN: ngayVaoSo,
            xa
        });
    });
}, 1500);
