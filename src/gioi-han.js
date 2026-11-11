// Bảng tra cứu theo hồ sơ nào cũng lưu vào localStorage (dùng chung hạn mức ~5MB với chính cổng),
// nên giữ tối đa n khoá mới nhất. Khoá chèn trước = cũ hơn; mã hồ sơ không phải số nguyên nên thứ tự chèn được giữ.
export function giuMoiNhat(obj, n) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length - n; i++) delete obj[keys[i]];
    return obj;
}
