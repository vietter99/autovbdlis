import { findCurrentMaHS } from './utils.js';

// Tự điền 2 mặc định ở màn hình "Cập nhật pháp lý giấy chứng nhận":
//   1. Tích ô "Chính thức có pháp lý"  (#chkdaCongNhanPhapLy, name="daCongNhanPhapLy")
//   2. Chọn Loại giấy chứng nhận = "Giấy chứng nhận QSDĐ, QSHTSGLVĐ năm 2024"
//      (#ddlloaiGiayChungNhanId, name="loaiGiayChungNhanId", option value 98)
//   3. Điền Người ký (#txttenNguoiKy) bằng tên "CB chuyển" hiện trên trang, đổi từ VIẾT HOA
//      TOÀN BỘ sang viết hoa chữ đầu
//   4. Điền Ngày vào sổ (input[name="ngayVaoSo"]) bằng NGÀY CHỌN SẴN trong tab Cài đặt, để
//      trống thì lấy ngày hôm nay. Riêng ô này còn TỰ CẬP NHẬT lại theo ngày chọn/hôm nay nếu
//      hồ sơ bị để qua ngày mới mà người dùng chưa tự tay đổi ngày (xem AUTO_DATE_KEY/
//      dienNgayVaoSo bên dưới), phòng trường hợp làm không kịp, mai làm tiếp mà quên sửa nên
//      lỡ lưu với ngày ký của hôm qua.
//
// Chạy độc lập với vòng auto của ProcessModule - mở form bằng tay cũng được điền, không cần
// bấm "Bắt đầu Xử Lý". Mỗi phần tử chỉ được đụng vào ĐÚNG 1 LẦN (đánh dấu data-mplis-phaply):
// sửa xong người dùng đổi lại thì tool để yên. Đóng form mở lại thì DOM mới, chạy lại từ đầu.

const SCAN_INTERVAL_MS = 1000;
const DONE_ATTR = 'data-mplis-phaply';
const ENABLED_KEY = 'mplis_phaply_autofill_enabled';

// Mặc định BẬT - giữ đúng hành vi trước khi có công tắc này. Người dùng tắt trong tab Cài đặt
// khi không muốn tool tự đụng vào form (VD: hồ sơ cần điền tay theo yêu cầu khác thường).
function isPhapLyAutofillEnabled() {
    try {
        return localStorage.getItem(ENABLED_KEY) !== 'false';
    } catch (e) {
        return true;
    }
}

const CHECKBOX_SELECTOR = '#chkdaCongNhanPhapLy, input[type="checkbox"][name="daCongNhanPhapLy"]';
const SELECT_SELECTOR = '#ddlloaiGiayChungNhanId, select[name="loaiGiayChungNhanId"]';
const NGUOI_KY_SELECTOR = '#txttenNguoiKy, input[name="tenNguoiKy"]';
// Ô Ngày vào sổ có id sinh động (dp1786549566588) nên chỉ bám được theo name.
const NGAY_VAO_SO_SELECTOR = 'input[name="ngayVaoSo"]';
const LOAI_GCN_VALUE = '98';
const LOAI_GCN_NAM = '2024';

// Tên "CB chuyển" trên trang viết HOA TOÀN BỘ và thiếu dấu ở vài chữ (VD "TRINH" đáng lẽ là
// "TRỊNH"). Viết hoa chữ đầu chỉ sửa được kiểu chữ, KHÔNG khôi phục được dấu đã mất - nên tên
// nào sai dấu thì khai ở đây. Khoá viết HOA, giá trị viết đúng như muốn điền vào ô Người ký.
const NGUOI_KY_FIXES = {
    'TRINH ĐÌNH THỞI': 'Trịnh Đình Thởi'
};

function getJq() {
    return (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
}

// Thẻ <select> của select2 bị ẩn khỏi màn hình (class select2-hidden-accessible, aria-hidden),
// đo bề rộng luôn ra 0. Nên xét khung .form-group bọc ngoài - đó mới là phần người dùng thấy.
function isFormVisible(el) {
    const box = el.closest('.form-group') || el.parentElement || el;
    try {
        const r = box.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    } catch (e) {
        return false;
    }
}

function tickCongNhanPhapLy() {
    const list = Array.from(document.querySelectorAll(CHECKBOX_SELECTOR));
    for (const cb of list) {
        if (cb.hasAttribute(DONE_ATTR) || !isFormVisible(cb)) continue;

        cb.setAttribute(DONE_ATTR, 'true');
        if (cb.checked) return;

        const jq = getJq();
        if (jq) jq(cb).click(); else cb.click();
        console.log('[MPLIS PhapLy] Đã tích "Chính thức có pháp lý".');
        return;
    }
}

function chonLoaiGiayChungNhan() {
    const list = Array.from(document.querySelectorAll(SELECT_SELECTOR));
    for (const sel of list) {
        if (sel.hasAttribute(DONE_ATTR) || !isFormVisible(sel)) continue;

        const opts = Array.from(sel.options);
        // Ưu tiên đúng value 98; đổi mã thì vẫn bắt được qua chữ "2024" trong tên option.
        const target = opts.find(o => o.value === LOAI_GCN_VALUE)
            || opts.find(o => (o.textContent || '').includes(LOAI_GCN_NAM));
        if (!target) continue;

        sel.setAttribute(DONE_ATTR, 'true');
        if (sel.value === target.value) return;

        const jq = getJq();
        sel.value = target.value;
        // select2 chỉ vẽ lại phần chữ hiển thị khi nhận sự kiện 'change' của jQuery, đặt
        // sel.value không thôi thì ô vẫn hiện lựa chọn cũ dù dữ liệu gửi đi đã đúng.
        if (jq) jq(sel).val(target.value).trigger('change');
        else sel.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('[MPLIS PhapLy] Đã chọn Loại giấy chứng nhận:', target.textContent.trim());
        return;
    }
}

// "TRỊNH ĐÌNH THỞI" -> "Trịnh Đình Thởi". toLowerCase() của JS xử lý đúng cả Đ/Ở nên không
// cần bảng chuyển riêng cho tiếng Việt.
function vietHoaChuDau(text) {
    return (text || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function dangHien(el) {
    if (!el || !el.offsetParent) return false;
    try {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    } catch (e) {
        return false;
    }
}

// Ô "CB chuyển" không có id, chỉ là 2 div float cạnh nhau: div nhãn rồi div giá trị.
// Bắt theo chữ "CB chuyển" rồi lấy thẻ <b> trong div kế bên.
// Trang liệt kê NHIỀU bước xử lý cùng lúc, mỗi bước 1 khối "CB chuyển" - cấu trúc DOM của các
// khối GIỐNG HỆT nhau (div.row > div.col-md-3 > div.row > div.col-md-12 > div > span), lại nằm
// ở panel khác với ô Người ký (#frmThongTinGiayChungNhan), nên KHÔNG phân biệt được bằng khoảng
// cách DOM hay toạ độ. Phân biệt bằng NGÀY của bước: bước mới nhất là bước vừa chuyển cho mình.
function layKhoiBuoc(label) {
    // Cả bước xử lý nằm trong div.row bọc ngoài cột col-md-3 chứa khối "CB chuyển".
    const cot = label.closest('.col-md-3, .col-md-4, .col-md-6');
    return (cot && cot.parentElement) || label.closest('.row') || label.parentElement;
}

// Mỗi khối "CB chuyển" nằm trong 1 DÒNG HỒ SƠ của danh sách công việc, và dòng đó có mã hồ sơ
// đầy đủ ("H15.50.05.12-260917-1436"). Đổi về dạng rút gọn ("17-1436") để so thẳng với
// findCurrentMaHS() - hồ sơ nào đang mở thì lấy đúng khối của hồ sơ đó.
const MA_HS_DAY_DU_RE = /[A-Z0-9]+(?:\.[A-Z0-9]+){2,}-(\d{6})-(\d{3,})/i;

function rutGonMaHS(text) {
    const m = MA_HS_DAY_DU_RE.exec(text || '');
    return m ? (m[1].slice(-2) + '-' + m[2]).toUpperCase() : '';
}

// Lấy mốc thời gian LỚN NHẤT xuất hiện trong chữ của bước (dd/mm/yyyy, có thể kèm HH:mm).
function layMocThoiGian(text) {
    const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
    let m, max = 0;
    while ((m = re.exec(text)) !== null) {
        const t = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]),
            Number(m[4] || 0), Number(m[5] || 0)).getTime();
        if (t > max) max = t;
    }
    return max;
}

function layTatCaCbChuyen() {
    return Array.from(document.querySelectorAll('span'))
        .filter(s => (s.textContent || '').trim().toLowerCase().startsWith('cb chuyển'))
        .map(label => {
            const valueBox = label.parentElement && label.parentElement.nextElementSibling;
            const b = valueBox ? valueBox.querySelector('b') : null;
            const name = b ? b.textContent.trim() : '';
            if (!name) return null;
            const khoi = layKhoiBuoc(label);
            const chuBuoc = ((khoi && khoi.textContent) || '').replace(/\s+/g, ' ').trim();
            return { label, name, chuBuoc, maHS: rutGonMaHS(chuBuoc), moc: layMocThoiGian(chuBuoc) };
        })
        .filter(c => c && dangHien(c.label));
}

// Chọn bước MỚI NHẤT theo ngày đọc được trong chữ của bước. Không bước nào có ngày (trang đổi
// cách hiện, hoặc khối không nằm trong bước) thì lấy khối ĐẦU TIÊN - danh sách bước xếp mới nhất
// lên trên, khối đầu là bước vừa chuyển cho mình.
function chonKhoiMoiNhat(list) {
    const coMoc = list.filter(c => c.moc > 0);
    if (!coMoc.length) return list[0];
    return coMoc.reduce((a, b) => (b.moc > a.moc ? b : a));
}

// Chọn khối "CB chuyển" của ĐÚNG hồ sơ đang mở. Danh sách công việc hiện nhiều hồ sơ cùng lúc,
// mỗi hồ sơ 1 khối, nên lấy theo ngày mới nhất là trúng hồ sơ của người khác - đó là lý do tên
// người ký từng bị điền nhầm. Không khớp được mã nào thì mới quay về lấy bước mới nhất.
function chonKhoiTheoHoSo(list, maHSHienTai) {
    if (maHSHienTai) {
        const khop = list.filter(c => c.maHS && c.maHS === maHSHienTai);
        if (khop.length === 1) return { chon: khop[0], cach: 'khớp mã hồ sơ ' + maHSHienTai };
        if (khop.length > 1) {
            return { chon: chonKhoiMoiNhat(khop), cach: 'khớp mã hồ sơ ' + maHSHienTai + ', lấy bước mới nhất' };
        }
    }
    return {
        chon: chonKhoiMoiNhat(list),
        cach: maHSHienTai
            ? '⚠️ KHÔNG khối nào mang mã hồ sơ ' + maHSHienTai + ', đành lấy bước mới nhất'
            : '⚠️ không đọc được mã hồ sơ đang mở, đành lấy bước mới nhất'
    };
}

// Mô tả vị trí 1 thẻ trong DOM để đọc được trong console: chuỗi tag#id.class leo lên 6 cấp.
function moTaViTri(el) {
    const parts = [];
    for (let node = el, i = 0; node && node.tagName && i < 6; node = node.parentElement, i++) {
        let s = node.tagName.toLowerCase();
        if (node.id) s += '#' + node.id;
        const cls = (node.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
        parts.unshift(s);
    }
    return parts.join(' > ');
}

// In ra từng khối "CB chuyển" đang hiện kèm mốc thời gian đọc được và chữ của bước - sai lần nào
// cũng nhìn log là biết trang cho chữ gì, không phải đoán.
function dumpCbChuyen(list, chon) {
    console.log('[MPLIS PhapLy] === soi khối "CB chuyển" ===');
    list.forEach((c, i) => {
        let top = null;
        try { top = Math.round(c.label.getBoundingClientRect().top); } catch (e) { }
        const mocStr = c.moc ? new Date(c.moc).toLocaleString('vi-VN') : '(không đọc được ngày)';
        console.log('  [' + i + ']' + (c === chon ? ' <== đang lấy' : '') + ' ' + c.name
            + ' | hồ sơ=' + (c.maHS || '?') + ' | moc=' + mocStr + ' | top=' + top);
        console.log('      viTri: ' + moTaViTri(c.label));
        console.log('      chuBuoc: ' + c.chuBuoc.slice(0, 300));
    });
}

function layTenCbChuyen() {
    const list = layTatCaCbChuyen();
    if (!list.length) return '';

    // In log cho MỌI trường hợp, kể cả khi chỉ có 1 khối. Trước đây 1 khối thì im lặng, nên lúc
    // tool điền nhầm tên là không có gì để lần - không biết nó thấy khối nào, của hồ sơ nào.
    const maHSHienTai = findCurrentMaHS();
    const { chon, cach } = chonKhoiTheoHoSo(list, maHSHienTai);
    console.log('[MPLIS PhapLy] Hồ sơ đang mở: ' + (maHSHienTai || '(không đọc được)')
        + ' | ' + list.length + ' khối "CB chuyển" đang hiện ('
        + list.map(c => c.name).join(' | ') + ') | lấy: ' + chon.name + ' (' + cach + ')');
    dumpCbChuyen(list, chon);
    return chon.name;
}

function dienNguoiKy() {
    const input = document.querySelector(NGUOI_KY_SELECTOR);
    if (!input || input.hasAttribute(DONE_ATTR) || !isFormVisible(input)) return;

    const raw = layTenCbChuyen();
    // Chưa thấy tên (khối CB chuyển tải sau) thì chưa đánh dấu, để vòng quét sau thử lại.
    if (!raw) return;

    input.setAttribute(DONE_ATTR, 'true');
    if (input.value.trim()) return; // ô đã có tên sẵn thì để nguyên

    const name = NGUOI_KY_FIXES[raw.toUpperCase()] || vietHoaChuDau(raw);
    const jq = getJq();
    input.value = name;
    if (jq) jq(input).val(name).trigger('input').trigger('change');
    else {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    console.log('[MPLIS PhapLy] Đã điền Người ký:', name, '(từ CB chuyển:', raw + ')');
}

function dinhDangNgayVN(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

// Ghi nhớ ngày TOOL từng tự điền cho từng hồ sơ (theo mã hồ sơ, qua localStorage - sống sót cả
// khi tải lại trang/đóng máy) - để phân biệt "người dùng chưa đụng vào, chỉ để hồ sơ qua ngày mới
// rồi làm tiếp" (nên tự cập nhật lại thành hôm nay) với "người dùng đã tự tay chọn ngày khác" (giữ
// nguyên, không đụng vào nữa dù có qua ngày).
const AUTO_DATE_KEY = 'mplis_phaply_autodate';

// Ngày người dùng chọn sẵn trong tab Cài đặt (dạng yyyy-mm-dd của <input type="date">). Để trống
// thì tool lấy ngày hôm nay - đúng hành vi trước khi có ô chọn này. Đọc lại mỗi vòng quét nên đổi
// ngày trong bảng điều khiển là áp dụng ngay, không cần F5.
const NGAY_CHON_KEY = 'mplis_phaply_ngay_vao_so';

function layNgayMucTieu() {
    let raw = '';
    try { raw = (localStorage.getItem(NGAY_CHON_KEY) || '').trim(); } catch (e) { }

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        // Chặn ngày rác kiểu 2026-02-31 (Date tự nhảy sang 03/03) - lệch thì bỏ, dùng hôm nay.
        if (d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) {
            return d;
        }
    }
    return new Date();
}

function getStoredAutoDate(maHS) {
    if (!maHS) return '';
    try {
        const stored = JSON.parse(localStorage.getItem(AUTO_DATE_KEY) || '{}');
        return stored[maHS] || '';
    } catch (e) { return ''; }
}

function saveStoredAutoDate(maHS, value) {
    if (!maHS) return;
    try {
        const stored = JSON.parse(localStorage.getItem(AUTO_DATE_KEY) || '{}');
        stored[maHS] = value;
        localStorage.setItem(AUTO_DATE_KEY, JSON.stringify(stored));
    } catch (e) { }
}

// Điền ô Ngày vào sổ bằng ngày truyền vào, trả về chữ đã điền được (đọc lại từ ô sau khi điền vì
// datepicker có thể tự định dạng khác đi).
function dienNgayVaoO(input, ngay) {
    const jq = getJq();
    let daDien = '';

    // Ô này là jQuery UI datepicker (class hasDatepicker). Gọi setDate để widget tự định dạng
    // theo cấu hình của trang và cập nhật luôn ngày đang chọn bên trong - gán thẳng .value thì
    // ô hiện đúng chữ nhưng datepicker vẫn giữ ngày cũ, mở lịch ra sẽ thấy lệch.
    if (jq && jq.fn && jq.fn.datepicker && input.classList.contains('hasDatepicker')) {
        try {
            jq(input).datepicker('setDate', ngay);
            daDien = input.value.trim();
        } catch (e) { }
    }

    if (!daDien) {
        daDien = dinhDangNgayVN(ngay);
        input.value = daDien;
        if (jq) jq(input).val(daDien).trigger('input').trigger('change');
        else {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    return daDien;
}

function dienNgayVaoSo() {
    const input = document.querySelector(NGAY_VAO_SO_SELECTOR);
    if (!input || !isFormVisible(input)) return;

    const maHS = findCurrentMaHS();
    const ngayMucTieu = layNgayMucTieu();
    const mucTieuStr = dinhDangNgayVN(ngayMucTieu);
    const currentVal = input.value.trim();
    const lastAuto = getStoredAutoDate(maHS);

    // Giá trị hiện tại đúng y hệt ngày mà TOOL từng tự điền cho hồ sơ này, nhưng không còn khớp
    // ngày mục tiêu nữa - hoặc để hồ sơ qua ngày mới rồi quay lại làm tiếp, hoặc vừa đổi ngày
    // chọn sẵn trong Cài đặt. Cả 2 trường hợp người dùng đều CHƯA tự tay sửa ô này, nên điền lại
    // theo ngày mục tiêu (dù DOM đã tải lại, dù ô đã "xử lý xong" từ trước).
    if (lastAuto && currentVal === lastAuto && currentVal !== mucTieuStr) {
        input.setAttribute(DONE_ATTR, 'true');
        const daDien = dienNgayVaoO(input, ngayMucTieu);
        saveStoredAutoDate(maHS, daDien);
        console.log('[MPLIS PhapLy] Ngày vào sổ cũ (' + lastAuto + '), điền lại theo ngày mục tiêu:', daDien);
        return;
    }

    if (input.hasAttribute(DONE_ATTR)) return; // đã xử lý trong phiên form đang mở, không đụng nữa
    input.setAttribute(DONE_ATTR, 'true');
    if (currentVal) return; // đã có ngày khác (người dùng tự chọn) thì để nguyên

    const daDien = dienNgayVaoO(input, ngayMucTieu);
    saveStoredAutoDate(maHS, daDien);
    console.log('[MPLIS PhapLy] Đã điền Ngày vào sổ:', daDien);
}

// Hồ sơ có NHIỀU giấy chứng nhận: làm xong giấy 1, đóng form, chọn giấy 2 rồi mở lại. Cổng có
// thể dùng lại đúng các ô cũ chứ không dựng DOM mới - lúc đó dấu data-mplis-phaply còn nguyên
// nên giấy 2 sẽ bị bỏ qua. Form đóng (không còn nhìn thấy) thì gỡ dấu để lần mở sau điền lại.
function goDauKhiFormDong() {
    const marked = Array.from(document.querySelectorAll('[' + DONE_ATTR + ']'));
    for (const el of marked) {
        if (!isFormVisible(el)) el.removeAttribute(DONE_ATTR);
    }
}

function scan() {
    if (!isPhapLyAutofillEnabled()) return;
    try {
        goDauKhiFormDong();
        tickCongNhanPhapLy();
        chonLoaiGiayChungNhan();
        dienNguoiKy();
        dienNgayVaoSo();
    } catch (e) {
        console.error('[MPLIS PhapLy] Lỗi:', e);
    }
}

setInterval(scan, SCAN_INTERVAL_MS);
