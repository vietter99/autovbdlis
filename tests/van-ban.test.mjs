import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlSangChu, chiaTheoDo } from '../src/van-ban.js';

test('bỏ thẻ, giữ chữ, đổi thực thể HTML về ký tự thật', () => {
    assert.equal(htmlSangChu('⏰ <b>A &amp; B</b> &lt;ok&gt;'), '⏰ A & B <ok>');
});

test('link giữ cả chữ lẫn địa chỉ', () => {
    assert.equal(htmlSangChu('<a href="https://x.vn/a?b=1&amp;c=2">Tờ 1</a>'), 'Tờ 1 (https://x.vn/a?b=1&c=2)');
});

test('chia khúc: không khúc nào quá hạn mức và nối lại đủ nội dung', () => {
    const text = ['aaaa', 'bbbb', 'cccc', 'd'.repeat(25)].join('\n');
    const khuc = chiaTheoDo(text, 10);
    assert.ok(khuc.every((k) => k.length <= 10));
    assert.equal(khuc.join('\n').replace(/\n/g, ''), text.replace(/\n/g, ''));
});

test('rỗng thì không có khúc nào', () => {
    assert.deepEqual(chiaTheoDo('', 10), []);
});
