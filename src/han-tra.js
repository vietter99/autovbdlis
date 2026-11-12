// Phân loại hồ sơ theo hẹn trả: đã trễ / sắp trễ. Hàm thuần (không đụng trang, không đụng Telegram) để test được.

// Hẹn trả của dòng GetXuLyCongViec dạng "/Date(1700000000000)/" -> mili giây, không có thì null.
export function hanTraMs(r) {
    const m = /\/Date\((-?\d+)\)\//.exec((r && r.ngayhenTra) || '');
    return m ? parseInt(m[1], 10) : null;
}

// tre: hẹn trả đã qua; sap: hẹn trả trong vòng phutSap phút tới. Mỗi bên xếp theo hạn gần nhất trước.
export function phanLoaiHan(rows, now, phutSap) {
    const tre = [], sap = [];
    const gioiHan = now + phutSap * 60000;
    (rows || []).forEach((r) => {
        const t = hanTraMs(r);
        if (t === null) return;
        if (t < now) tre.push({ r, t });
        else if (t <= gioiHan) sap.push({ r, t });
    });
    const theoHan = (a, b) => a.t - b.t;
    return { tre: tre.sort(theoHan), sap: sap.sort(theoHan) };
}

// Nhắc n lần chia đều trong phutSap phút cuối: mốc i (0..n-1) tới khi còn <= phutSap*(n-i)/n. Trả về các chỉ số mốc đã tới
// (hồ sơ vào muộn đã qua nhiều mốc thì trả nhiều chỉ số để nơi gọi đánh dấu hết và chỉ nhắc 1 tin).
export function mocDaToi(conLaiMs, phutSap, n) {
    const r = [];
    for (let i = 0; i < n; i++) if (conLaiMs <= phutSap * 60000 * (n - i) / n) r.push(i);
    return r;
}

// 35 phút / 2 giờ 5 phút / 1 ngày 3 giờ.
export function khoangThoiGian(ms) {
    const p = Math.round(Math.abs(ms) / 60000);
    if (p < 60) return p + ' phút';
    const g = Math.floor(p / 60);
    if (g < 24) return g + ' giờ' + (p % 60 ? ' ' + (p % 60) + ' phút' : '');
    return Math.floor(g / 24) + ' ngày' + (g % 24 ? ' ' + (g % 24) + ' giờ' : '');
}
