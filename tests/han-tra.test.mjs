import test from 'node:test';
import assert from 'node:assert/strict';
import { hanTraMs, phanLoaiHan, khoangThoiGian, mocDaToi } from '../src/han-tra.js';

const NOW = 1_700_000_000_000;
const h = (id, phut) => ({ soBienNhan: id, ngayhenTra: '/Date(' + (NOW + phut * 60000) + ')/' });

test('chia trễ / sắp trễ / còn xa, mỗi bên theo hạn gần nhất trước', () => {
    const rows = [h('xa', 300), h('sap2', 50), h('tre-nhe', -5), h('sap1', 10), h('tre-nang', -200), { soBienNhan: 'khong-han' }];
    const { tre, sap } = phanLoaiHan(rows, NOW, 60);
    assert.deepEqual(tre.map((x) => x.r.soBienNhan), ['tre-nang', 'tre-nhe']);
    assert.deepEqual(sap.map((x) => x.r.soBienNhan), ['sap1', 'sap2']);
});

test('đúng mốc 60 phút vẫn tính là sắp trễ, 61 phút thì chưa', () => {
    assert.equal(phanLoaiHan([h('a', 60)], NOW, 60).sap.length, 1);
    assert.equal(phanLoaiHan([h('a', 61)], NOW, 60).sap.length, 0);
});

test('không có dữ liệu thì trả rỗng, không lỗi', () => {
    assert.deepEqual(phanLoaiHan(null, NOW, 60), { tre: [], sap: [] });
    assert.equal(hanTraMs({ ngayhenTra: 'abc' }), null);
});

test('đọc khoảng thời gian dễ hiểu', () => {
    assert.equal(khoangThoiGian(35 * 60000), '35 phút');
    assert.equal(khoangThoiGian(-125 * 60000), '2 giờ 5 phút');
    assert.equal(khoangThoiGian(27 * 3600000), '1 ngày 3 giờ');
});

test('nhắc 1 lần: tới mốc khi còn đúng khung giờ', () => {
    assert.deepEqual(mocDaToi(120 * 60000, 120, 1), [0]);
    assert.deepEqual(mocDaToi(121 * 60000, 120, 1), []);
});

test('nhắc 3 lần trong 2 giờ: mốc 120, 80, 40 phút còn lại', () => {
    assert.deepEqual(mocDaToi(100 * 60000, 120, 3), [0]);
    assert.deepEqual(mocDaToi(80 * 60000, 120, 3), [0, 1]);
    assert.deepEqual(mocDaToi(30 * 60000, 120, 3), [0, 1, 2]);
});

test('hồ sơ vào muộn (đã qua hết mốc) trả đủ mọi chỉ số để đánh dấu một lần', () => {
    assert.deepEqual(mocDaToi(5 * 60000, 120, 3), [0, 1, 2]);
    assert.deepEqual(mocDaToi(-5 * 60000, 120, 2), [0, 1]);
});
