import test from 'node:test';
import assert from 'node:assert/strict';
import { chonFile } from '../src/chon-file.js';

const fs = (...names) => names.map(name => ({ name }));
const goi = (files, o) => chonFile(files, { sphList: [], soChuSo: 3, ...o });
const MA = 'H15 50 05 12-261008-0119';

test('GCN: đúng đuôi số phát hành thì chọn; thiếu file thì null (không lấy file SPH khác)', () => {
    const files = fs('H15 50-1-AA 09125976.pdf');
    assert.equal(goi(files, { rowText: 'AA 09125976', fileType: 'GCN', suffix: '976', sphNum: '09125976' }).file.name, files[0].name);
    const kq = goi(files, { rowText: 'AA 09125975', fileType: 'GCN', suffix: '975', sphNum: '09125975', sphList: ['AA09125975', 'AA09125976'] });
    assert.equal(kq.file, null);
    assert.equal(kq.soTrung, 0);
});

test('GCN: hai SPH khác nhau trùng 3 số cuối → phân biệt bằng đủ số phát hành, không dừng oan', () => {
    const files = fs('A-AA 09125976.pdf', 'B-AA 08117976.pdf');
    const kq = goi(files, { rowText: '', fileType: 'GCN', suffix: '976', sphNum: '09125976' });
    assert.equal(kq.file.name, 'A-AA 09125976.pdf');
});

test('GCN: 2 file cùng mã mà không phân biệt được → soTrung, không chọn', () => {
    const kq = goi(fs('976.pdf', 'x/976.pdf'), { rowText: '', fileType: 'GCN', suffix: '976', sphNum: '09125976' });
    assert.equal(kq.file, null);
    assert.equal(kq.soTrung, 2);
});

test('GT: khớp theo tên đầy đủ, dấu chấm/dấu cách đều được', () => {
    const files = fs('H15.50.05.12-261008-0119-GT.pdf', 'H15 50 05 12-260826-0119-GT.pdf');
    const row = `${MA}-GT.PDF`.toUpperCase();
    const kq = goi(files, { rowText: row, fileType: 'GT', suffix: '119' });
    assert.equal(kq.file.name, 'H15.50.05.12-261008-0119-GT.pdf');
});

test('GT: thiếu file của hồ sơ này mà chỉ có file hồ sơ khác (cùng 4 số cuối, khác ngày) → KHÔNG lấy', () => {
    const files = fs('H15 50 05 12-260826-0119-GT.pdf', 'H15 50 05 12-261008-0555-GT.pdf');
    const kq = goi(files, { rowText: `${MA}-GT.PDF`, fileType: 'GT', suffix: '119', soChuSo: 4 });
    assert.equal(kq.file, null);
});

test('GT: file tên ngắn "0119-GT.pdf" vẫn nhận (không có mã đầy đủ để so)', () => {
    const kq = goi(fs('0119-GT.pdf'), { rowText: `${MA}-GT.PDF`, fileType: 'GT', suffix: '119', soChuSo: 4 });
    assert.equal(kq.file.name, '0119-GT.pdf');
});

test('GT: không lấy bừa file -GT bất kỳ trong thư mục', () => {
    const kq = goi(fs('H15 50 05 12-261008-0999-GT.pdf'), { rowText: 'GT', fileType: 'GT', suffix: '119' });
    assert.equal(kq.file, null);
});

test('PT: hai file ngắn cùng đuôi ở hai thư mục → soTrung', () => {
    const files = [{ name: '0119-PT.pdf', webkitRelativePath: 'a/0119-PT.pdf' }, { name: '0119-PT.pdf', webkitRelativePath: 'b/0119-PT.pdf' }];
    const kq = goi(files, { rowText: `${MA}-PT.PDF`, fileType: 'PT', suffix: '119', soChuSo: 4 });
    assert.equal(kq.file, null);
    assert.equal(kq.soTrung, 2);
});

test('GT: file gộp nhiều mã (4 số) vẫn dùng được', () => {
    const files = fs('0432+0435+.pdf');
    const kq = goi(files, { rowText: 'H15 50-261008-0435-GT.PDF'.toUpperCase(), fileType: 'GT', suffix: '435', soChuSo: 4 });
    assert.equal(kq.file.name, '0432+0435+.pdf');
});

test('GCN: chỉ có 1 file trùng đuôi nhưng mang số phát hành khác (hồ sơ khác) → KHÔNG lấy', () => {
    const files = fs('H15 50 05 12-261008-0555-AA 08117976.pdf');
    const kq = goi(files, { rowText: 'AA 09125976', fileType: 'GCN', suffix: '976', sphNum: '09125976', sphList: ['AA09125976'] });
    assert.equal(kq.file, null);
    assert.equal(kq.soTrung, 0);
});

test('GCN: file của hồ sơ khác trùng đuôi không làm file đúng bị coi là trùng', () => {
    const files = fs('A-AA 09125976.pdf', 'B-AA 08117976.pdf');
    assert.equal(goi(files, { rowText: '', fileType: 'GCN', suffix: '976', sphNum: '09125976' }).file.name, 'A-AA 09125976.pdf');
});
