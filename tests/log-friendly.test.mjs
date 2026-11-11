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

test('moTaLoiTelegram: lỗi server có lý do và hướng xử lý', () => {
    const r = moTaLoiTelegram('Server từ chối DangKyAjax/CapNhatDuLieuPhapLy', '', '{"noiDungNganChan":"Thửa bị ngăn chặn"}');
    assert.match(r.lyDo, /lưu dữ liệu pháp lý/);
    assert.match(r.lyDo, /Thửa bị ngăn chặn/);
    assert.ok(r.huongXuLy.length > 0);
});

test('moTaLoiTelegram: lỗi QT2 dặn kiểm tra tên file; loại lạ có hướng mặc định', () => {
    assert.match(moTaLoiTelegram('QT2 · Thiếu file giấy chứng nhận', '', 'x').huongXuLy, /tên file/);
    assert.match(moTaLoiTelegram('Loại lạ', '', '').huongXuLy, /bấm chạy lại/);
});
