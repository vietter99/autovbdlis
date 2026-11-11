import test from 'node:test';
import assert from 'node:assert/strict';
import { giuMoiNhat } from '../src/gioi-han.js';

test('giữ n khoá mới nhất, bỏ khoá cũ nhất', () => {
    assert.deepEqual(Object.keys(giuMoiNhat({ '01-1': 1, '01-2': 2, '01-3': 3 }, 2)), ['01-2', '01-3']);
});

test('ít hơn n thì không đụng gì', () => {
    assert.deepEqual(giuMoiNhat({ a: 1 }, 5), { a: 1 });
});
