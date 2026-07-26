import { findCurrentMaHS } from './utils.js';

// #lbThongTinBienDong chỉ hiện lúc đang ở màn QT1 (cập nhật pháp lý), trong khi ExcelModule
// lại cần thông tin này lúc quét ở QT3 (thời điểm khác). Nên bắt và "nhớ" lại ngay lúc thấy,
// gắn theo đúng Mã hồ sơ, để lúc khác đọc ra dùng lại được.
//
// LƯU Ý: chỉ lấy đúng mã 2 ký tự sau "Mã loại biến động:", KHÔNG dò chữ trong phần "Thông tin
// biến động" tự do phía sau - phần đó có thể chứa câu trích dẫn pháp lý nhắc tới tên loại hồ sơ
// KHÁC với loại thật của hồ sơ đang xem (VD hồ sơ "Cấp lại" vẫn có thể nhắc chữ "Cấp đổi" trong
// đoạn viện dẫn Nghị định), nên dò theo mã là an toàn hơn nhiều so với dò theo từ khóa.
function saveBienDongCode(maHS, code) {
    try {
        const stored = JSON.parse(localStorage.getItem('mplis_bien_dong_codes') || '{}');
        stored[maHS] = code;
        localStorage.setItem('mplis_bien_dong_codes', JSON.stringify(stored));
    } catch (e) { }
}

setInterval(() => {
    const lbl = document.getElementById('lbThongTinBienDong');
    if (!lbl) return;
    try {
        if (lbl.getBoundingClientRect().width === 0) return;
    } catch (e) { return; }

    const text = lbl.textContent || '';
    const m = text.match(/Mã loại biến động:\s*([A-ZĐ]{1,4})/i);
    if (!m) return;
    const code = m[1].trim().toUpperCase();
    if (!code) return;

    const maHS = findCurrentMaHS();
    if (!maHS) return;

    saveBienDongCode(maHS, code);
}, 1000);
