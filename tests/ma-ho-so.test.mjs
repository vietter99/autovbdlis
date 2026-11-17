import test from 'node:test';
import assert from 'node:assert/strict';
import { MA_HS_SRC, maHoSoTenFile, boTienTo } from '../src/ma-ho-so.js';

const re = () => new RegExp(MA_HS_SRC, 'i');

test('nhận mã hồ sơ dạng dấu chấm lẫn dấu cách, kể cả mã 2 nhóm', () => {
    for (const s of ['H15.50.05.12-261008-0119', 'H15 50 05 12-261008-0119', 'H15.50-260625-0680', 'H15 50-260625-0680']) {
        assert.equal(re().exec('Mã: ' + s + ' xong')[0], s);
    }
});

test('tên file chỉ lấy "yymmdd-số thứ tự", bỏ mã đơn vị phía trước', () => {
    assert.equal(maHoSoTenFile('H15.50.05.12-261104-0342'), '261104-0342');
    assert.equal(maHoSoTenFile('H15 50 05 12-261104-0342'), '261104-0342');
    assert.equal(maHoSoTenFile('H15.50-260625-0680'), '260625-0680');
});

test('boTienTo: tên cũ và tên mới về cùng một dạng để so sánh', () => {
    assert.equal(boTienTo('H15 50 05 12-261104-0342-GT.pdf'), '261104-0342-GT.pdf');
    assert.equal(boTienTo('261104-0342-GT.pdf'), '261104-0342-GT.pdf');
    assert.equal(boTienTo('976.pdf'), '976.pdf');
});
