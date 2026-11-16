import test from 'node:test';
import assert from 'node:assert/strict';
import { thanThien, moTaLoiTelegram } from '../src/log-friendly.js';

test('server từ chối: nêu bước và lý do bằng tiếng thường', () => {
    const out = thanThien('⚠️ Server từ chối DangKyAjax/KiemTraCapNhatDuLieuPhapLy: {"noiDungNganChan":"Thửa đất đang bị ngăn chặn"} — DỪNG AUTO.');
    assert.match(out, /kiểm tra cập nhật dữ liệu pháp lý/);
    assert.match(out, /Thửa đất đang bị ngăn chặn/);
    assert.doesNotMatch(out, /DangKyAjax/);
});

test('dòng kỹ thuật bị ẩn (null)', () => {
    assert.equal(thanThien("Bấm 'Đóng' bảng tệp đính kèm..."), null);
});

test('dòng có cảnh báo không bao giờ bị ẩn', () => {
    const raw = "Bấm 'Đóng' bảng tệp đính kèm ⚠️ lỗi";
    assert.equal(thanThien(raw), raw);
});

test('dòng thành công được dịch', () => {
    assert.equal(thanThien('API đã lưu hồ sơ quét (QT2).'), '✅ Đã lưu kho hồ sơ quét');
});

test('dòng lạ giữ nguyên, chỉ đổi cụm DỪNG AUTO', () => {
    assert.equal(thanThien('abc'), 'abc');
    assert.equal(thanThien('x — DỪNG AUTO.'), 'x Tool đã dừng.');
});

test('moTaLoiTelegram: lỗi server đưa nguyên văn thông báo của cổng, giữ xuống dòng, không lời hướng dẫn', () => {
    // Mẫu thật lấy từ log của cổng: lỗi nằm ở trường "Error", xuống dòng bằng <br />, in đậm bằng <b>.
    const raw = '{"success":false,"Error":"<b>HỒ SƠ CHƯA ĐÁP ỨNG LIÊN KẾT 3 KHỐI</b><br /><b>LIÊN KẾT KHÔNG GIAN</b><br />Thửa đất <b>166(213)</b> không tồn tại dữ liệu không gian"}';
    const r = moTaLoiTelegram('Server từ chối DangKyAjax/ThucHienKetISO', '', raw);
    assert.equal(r.lyDo, 'HỒ SƠ CHƯA ĐÁP ỨNG LIÊN KẾT 3 KHỐI\nLIÊN KẾT KHÔNG GIAN\nThửa đất 166(213) không tồn tại dữ liệu không gian');
    assert.equal(r.huongXuLy, '');
});

test('moTaLoiTelegram: lỗi QT2 dặn kiểm tra tên file; loại lạ có hướng mặc định', () => {
    assert.match(moTaLoiTelegram('QT2 · Thiếu file giấy chứng nhận', '', 'x').huongXuLy, /tên file/);
    assert.match(moTaLoiTelegram('Loại lạ', '', '').huongXuLy, /làm tiếp|xử lý tiếp/);
});
