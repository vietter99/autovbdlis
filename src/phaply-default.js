import { findCurrentMaHS } from './utils.js';

// Tự điền 2 mặc định ở màn hình "Cập nhật pháp lý giấy chứng nhận":
//   1. Tích ô "Chính thức có pháp lý"  (#chkdaCongNhanPhapLy, name="daCongNhanPhapLy")
//   2. Chọn Loại giấy chứng nhận = "Giấy chứng nhận QSDĐ, QSHTSGLVĐ năm 2024"
//      (#ddlloaiGiayChungNhanId, name="loaiGiayChungNhanId", option value 98)
//   3. Điền Người ký (#txttenNguoiKy) bằng tên "CB chuyển" hiện trên trang, đổi từ VIẾT HOA
//      TOÀN BỘ sang viết hoa chữ đầu
//   4. Điền Ngày vào sổ (input[name="ngayVaoSo"]) bằng ngày hôm nay - riêng ô này còn TỰ CẬP
//      NHẬT lại thành hôm nay nếu hồ sơ bị để qua ngày mới mà người dùng chưa tự tay đổi ngày
//      (xem AUTO_DATE_KEY/dienNgayVaoSo bên dưới), phòng trường hợp làm không kịp, mai làm tiếp
//      mà quên sửa nên lỡ lưu với ngày ký của hôm qua.
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

// Ô "CB chuyển" không có id, chỉ là 2 div float cạnh nhau: div nhãn rồi div giá trị.
// Bắt theo chữ "CB chuyển" rồi lấy thẻ <b> trong div kế bên.
function layTenCbChuyen() {
    const spans = Array.from(document.querySelectorAll('span'));
    const label = spans.find(s => (s.textContent || '').trim().toLowerCase().startsWith('cb chuyển'));
    if (!label || !label.parentElement) return '';
    const valueBox = label.parentElement.nextElementSibling;
    if (!valueBox) return '';
    const b = valueBox.querySelector('b');
    return b ? b.textContent.trim() : '';
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

// Điền ô Ngày vào sổ bằng ngày hôm nay, trả về chữ đã điền được (đọc lại từ ô sau khi điền vì
// datepicker có thể tự định dạng khác đi).
function dienHomNayVaoO(input) {
    const jq = getJq();
    const homNay = new Date();
    let daDien = '';

    // Ô này là jQuery UI datepicker (class hasDatepicker). Gọi setDate để widget tự định dạng
    // theo cấu hình của trang và cập nhật luôn ngày đang chọn bên trong - gán thẳng .value thì
    // ô hiện đúng chữ nhưng datepicker vẫn giữ ngày cũ, mở lịch ra sẽ thấy lệch.
    if (jq && jq.fn && jq.fn.datepicker && input.classList.contains('hasDatepicker')) {
        try {
            jq(input).datepicker('setDate', homNay);
            daDien = input.value.trim();
        } catch (e) { }
    }

    if (!daDien) {
        daDien = dinhDangNgayVN(homNay);
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
    const todayStr = dinhDangNgayVN(new Date());
    const currentVal = input.value.trim();
    const lastAuto = getStoredAutoDate(maHS);

    // Giá trị hiện tại đúng y hệt ngày mà TOOL từng tự điền cho hồ sơ này, nhưng không còn là
    // hôm nay nữa - để hồ sơ qua ngày mới rồi quay lại làm tiếp, người dùng CHƯA tự tay sửa ô
    // này. Tự cập nhật lại thành hôm nay (dù DOM đã tải lại, dù ô đã "xử lý xong" từ trước).
    if (lastAuto && currentVal === lastAuto && currentVal !== todayStr) {
        input.setAttribute(DONE_ATTR, 'true');
        const daDien = dienHomNayVaoO(input);
        saveStoredAutoDate(maHS, daDien);
        console.log('[MPLIS PhapLy] Ngày vào sổ đã cũ (' + lastAuto + '), tự cập nhật lại thành hôm nay:', daDien);
        return;
    }

    if (input.hasAttribute(DONE_ATTR)) return; // đã xử lý trong phiên form đang mở, không đụng nữa
    input.setAttribute(DONE_ATTR, 'true');
    if (currentVal) return; // đã có ngày khác (người dùng tự chọn) thì để nguyên

    const daDien = dienHomNayVaoO(input);
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
