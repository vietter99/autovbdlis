import test from 'node:test';
import assert from 'node:assert/strict';
import { MA_HS_SRC, maHoSoTenFile } from '../src/ma-ho-so.js';

const re = () => new RegExp(MA_HS_SRC, 'i');

test('nhận mã hồ sơ dạng dấu chấm lẫn dấu cách, kể cả mã 2 nhóm', () => {
    for (const s of ['H15.50.05.12-261008-0119', 'H15 50 05 12-261008-0119', 'H15.50-260625-0680', 'H15 50-260625-0680']) {
        assert.equal(re().exec('Mã: ' + s + ' xong')[0], s);
    }
});

test('tên file đổi dấu chấm thành dấu cách', () => {
    assert.equal(maHoSoTenFile('H15.50.05.12-261008-0119'), 'H15 50 05 12-261008-0119');
    assert.equal(maHoSoTenFile('H15 50 05 12-261008-0119'), 'H15 50 05 12-261008-0119');
});
