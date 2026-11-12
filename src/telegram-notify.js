import { topWin, escapeHtml } from './utils.js';
import { setFastInterval } from './bg-ticker.js';
import { tenNguoiNop, traCuuHoSo, extractApplicant, parseAspNetDate } from './lookup-module.js';
import { phanLoaiHan, khoangThoiGian, hanTraMs, mocDaToi } from './han-tra.js';
import { htmlSangChu, chiaTheoDo, catToiLenh } from './van-ban.js';

// Thông báo hồ sơ mới về Telegram.
// Nguồn: DangKyAjax/GetNotify (mỗi dòng = 1 lần ai đó chuyển hồ sơ/tập hồ sơ cho mình) và
// DangKyAjax/GetXuLyCongViec (tổng số hồ sơ đang chờ xử lý - gọi lại đúng bộ lọc mà trang vừa dùng).
// Chống lặp: nhớ Id của từng thông báo đã gửi (localStorage); lần chạy đầu chỉ "ghi nhận mốc",
// không gửi 15 thông báo cũ.

const K_ON = 'mplis_tg_enabled';
const K_TOKEN = 'mplis_tg_token';
const K_CHAT = 'mplis_tg_chat';
const K_SEEN = 'mplis_tg_seen';
const K_BASE = 'mplis_tg_baseline';
const K_SEC = 'mplis_tg_interval';
const K_ALERT_ERR = 'mplis_tg_alert_error'; // gửi cảnh báo "Auto dừng vì lỗi" lên Telegram (mặc định bật)
const K_NHAC_ON = 'mplis_tg_nhac_tre'; // nhắc hồ sơ sắp trễ hạn (mặc định bật)
const K_NHAC = 'mplis_tg_nhac_da_gui'; // các "mã|hạn" đã nhắc, để không nhắc lại
const K_ZL_TOKEN = 'mplis_zl_token'; // Zalo Bot: token (nằm trong đường dẫn API) và chat id nhận tin
const K_ZL_CHAT = 'mplis_zl_chat';
const ZL_TOI_DA = 1900; // Zalo cho tối đa 2000 ký tự mỗi tin, chừa chỗ an toàn
const SEEN_MAX = 600;
const NOTIFY_URL = 'https://dla.mplis.gov.vn/dc/DangKyAjax/GetNotify';
const WORK_URL = 'https://dla.mplis.gov.vn/dc/DangKyAjax/GetXuLyCongViec';

const st = { items: [], total: null, working: null, lastCheck: 0, msg: '', busy: false, newIds: new Set() };

const ls = {
    get: (k, d = '') => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } },
};
const isOn = () => ls.get(K_ON) === 'true';
const getSeen = () => { try { return new Set(JSON.parse(ls.get(K_SEEN, '[]'))); } catch (e) { return new Set(); } };
function saveSeen(set) { ls.set(K_SEEN, JSON.stringify(Array.from(set).slice(-SEEN_MAX))); }
const jq = () => (typeof unsafeWindow !== 'undefined' && unsafeWindow.$ && unsafeWindow.$.ajax) ? unsafeWindow.$ : null;

function aspDate(str) {
    const m = /\/Date\((-?\d+)\)\//.exec(str || '');
    return m ? new Date(parseInt(m[1], 10)) : null;
}
const p2 = (n) => String(n).padStart(2, '0');
const fmtTime = (d) => d ? p2(d.getHours()) + ':' + p2(d.getMinutes()) + ' ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) : '';
// Hôm nay chỉ hiện giờ; ngày khác mới kèm ngày/tháng cho gọn.
const gioNgan = (d) => {
    if (!d) return '';
    const now = new Date();
    const homNay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return homNay ? p2(d.getHours()) + ':' + p2(d.getMinutes()) : fmtTime(d);
};
const KE = '━━━━━━━━━━━━━━';
// Mã hồ sơ luôn hiện ĐẦY ĐỦ (H15.50.05.12-260826-1077), không rút gọn thành 26-1077.
// Cùng 1 người có lúc hiện tên tài khoản (dla.thoitd), lúc hiện họ tên (Trịnh Đình Thởi).
// Nhớ cặp tài khoản -> họ tên để lúc nào cũng hiện họ tên.
const K_NAMES = 'mplis_tg_names';
const getNames = () => { try { return JSON.parse(ls.get(K_NAMES, '{}')); } catch (e) { return {}; } };
function nhoTen(list) {
    const m = getNames();
    let doi = false;
    list.forEach((n) => {
        const u = (n.UserNameChuyenTiep || '').trim().toLowerCase(), f = (n.FullNameNguoiChuyenTiep || '').trim();
        if (u && f && m[u] !== f) { m[u] = f; doi = true; }
    });
    if (doi) ls.set(K_NAMES, JSON.stringify(m));
}
const SUA_TEN = { 'TRINH ĐÌNH THỞI': 'Trịnh Đình Thởi' }; // cổng MPLIS ghi thiếu dấu
function chuanTen(raw) {
    raw = (raw || '').trim().normalize('NFC');
    const full = getNames()[raw.toLowerCase()];
    if (full) raw = full;
    const sua = Object.keys(SUA_TEN).find((k) => k.normalize('NFC') === raw.toUpperCase());
    if (sua) return SUA_TEN[sua];
    return raw && raw === raw.toUpperCase() ? raw.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : raw;
}
function tenNguoi(n) {
    return chuanTen(n.FullNameNguoiChuyenTiep || n.UserNameChuyenTiep || 'Không rõ');
}
const laTap = (n) => n.WarningType === 5;

function ajax(url, data, json) {
    return new Promise((resolve, reject) => {
        const $ = jq();
        if (!$) { reject(new Error('Trang chưa sẵn sàng')); return; }
        // global:false = không bắn sự kiện ajaxStart/ajaxStop của trang, nên không hiện vòng "đang tải" và không làm vướng thao tác Kết ISO.
        const opt = { url, method: 'POST', dataType: 'json', global: false };
        if (json) { opt.contentType = 'application/json; charset=utf-8'; opt.data = JSON.stringify(data); } else opt.data = data;
        $.ajax(opt).done(resolve).fail((x) => reject(new Error('Lỗi ' + x.status)));
    });
}

async function fetchNotify() {
    const j = await ajax(NOTIFY_URL, { start: 0, length: 30 }, true);
    return Array.isArray(j && j.Value) ? j.Value : [];
}

// Gọi lại GetXuLyCongViec bằng body trang vừa gửi (giữ nguyên bộ lọc), chỉ đổi phân trang.
async function fetchWork() {
    // Ưu tiên body trang vừa gửi (giữ đúng bộ lọc); chưa có thì dùng bộ lọc mặc định của màn "Xử lý công việc".
    const body = (topWin.__mplisLastReq && topWin.__mplisLastReq['DangKyAjax/GetXuLyCongViec']) ||
        'draw=1&columns%5B0%5D%5Bdata%5D=stt&columns%5B0%5D%5Borderable%5D=false&columns%5B1%5D%5Bdata%5D=soBienNhan&columns%5B1%5D%5Borderable%5D=false' +
        '&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=asc&start=0&length=100&search%5Bvalue%5D=&search%5Bregex%5D=false&query=&soNgayCanhBaoHoSoSapDenNgayTra=7&sortField=ngayhenTra&sortDirection=asc&filterBy=0';
    const sp = new URLSearchParams(body);
    sp.set('start', '0');
    sp.set('length', '200');
    // Bỏ ô tìm kiếm/bộ lọc người dùng đang đặt trên trang: danh sách đã lọc mà coi là đầy đủ thì hồ sơ mới bị đánh dấu "đã xong" và không báo.
    sp.set('query', ''); sp.set('search[value]', ''); sp.set('filterBy', '0');
    const j = await ajax(WORK_URL, sp.toString(), false);
    if (!j || j.success === false) return null;
    return { total: j.recordsTotal, rows: Array.isArray(j.data) ? j.data : [] };
}

function sendTelegram(text) {
    return new Promise((resolve, reject) => {
        const token = ls.get(K_TOKEN).trim(), chat = ls.get(K_CHAT).trim();
        if (!token || !chat) { reject(new Error('Chưa nhập API Key hoặc Chat ID')); return; }
        if (typeof GM_xmlhttpRequest === 'undefined') { reject(new Error('Thiếu GM_xmlhttpRequest')); return; }
        // Dùng GM_xmlhttpRequest trực tiếp (không qua logger) để token không lọt vào nhật ký copy được.
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://api.telegram.org/bot' + token + '/sendMessage',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
            onload: (res) => {
                let b = null; try { b = JSON.parse(res.responseText); } catch (e) { }
                if (b && b.ok) resolve(); else reject(new Error((b && b.description) || ('HTTP ' + res.status)));
            },
            onerror: () => reject(new Error('Lỗi kết nối Telegram')),
            ontimeout: () => reject(new Error('Telegram quá thời gian')),
            timeout: 15000,
        });
    });
}

// ---- Zalo Bot (kênh thứ hai, cùng nội dung với Telegram nhưng gửi dạng chữ thường) ----
function zaloGoi(method, body, choMs) {
    return new Promise((resolve, reject) => {
        const token = ls.get(K_ZL_TOKEN).trim();
        if (!token) { reject(new Error('Chưa nhập token Zalo')); return; }
        if (typeof GM_xmlhttpRequest === 'undefined') { reject(new Error('Thiếu GM_xmlhttpRequest')); return; }
        // Như Telegram: gọi GM_xmlhttpRequest trực tiếp để token không lọt vào nhật ký copy được.
        GM_xmlhttpRequest({
            method: 'POST', url: 'https://bot-api.zaloplatforms.com/bot' + token + '/' + method,
            headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(body || {}), timeout: choMs || 15000,
            onload: (res) => {
                let b = null; try { b = JSON.parse(res.responseText); } catch (e) { }
                if (b && b.ok) resolve(b.result); else reject(new Error(method + ': ' + ((b && b.description) || ('HTTP ' + res.status)) + ' ' + String(res.responseText || '').slice(0, 120)));
            },
            onerror: () => reject(new Error('Lỗi kết nối Zalo')), ontimeout: () => reject(new Error('Zalo quá thời gian')),
        });
    });
}
function guiZalo(text) {
    const chat = ls.get(K_ZL_CHAT).trim();
    if (!chat) return Promise.reject(new Error('Chưa nhập Chat ID Zalo'));
    return chiaTheoDo(text, ZL_TOI_DA).reduce((p, t) => p.then(() => zaloGoi('sendMessage', { chat_id: chat, text: t })), Promise.resolve());
}
// Cài đặt riêng từng kênh (tg = Telegram, zl = Zalo): bật/tắt kênh và loại tin nó nhận.
// Loại tin: moi = hồ sơ mới, tre = sắp trễ hạn, loi = auto dừng vì lỗi, lenh = nghe và trả lời lệnh (/tong, /tre...).
// Mặc định lấy theo các cài đặt cũ (mplis_kenh, báo lỗi, nhắc trễ) để ai đã cấu hình không bị đổi hành vi.
const K_KENH = 'mplis_kenh';
const LOAI_TIN = [['moi', 'Hồ sơ mới'], ['tre', 'Sắp trễ hạn'], ['loi', 'Auto dừng vì lỗi'], ['lenh', 'Trả lời lệnh (/tong, /tre…)']];
const macDinhKenh = (k, l) => {
    if (l === 'on') { const v = ls.get(K_KENH, 'ca'); return v === 'tg' || v === 'zl' ? v === k : true; }
    if (l === 'tre') return ls.get(K_NHAC_ON, 'true') !== 'false';
    if (l === 'loi') return ls.get(K_ALERT_ERR, 'true') !== 'false';
    return true;
};
const kenhBat = (k, l) => { const v = ls.get('mplis_ch_' + k + '_' + l); return v === '' ? macDinhKenh(k, l) : v === 'true'; };
// Báo trễ trước bao nhiêu giờ của từng kênh (mặc định 2 giờ), tối thiểu 15 phút, tối đa 72 giờ.
const gioiHanGio = (v, macDinh) => Math.min(72, Math.max(0.25, parseFloat(String(v).replace(',', '.')) || macDinh));
const gioBaoTre = (k) => gioiHanGio(ls.get('mplis_ch_' + k + '_gio'), 2);
// Số lần nhắc mỗi hồ sơ (mặc định 1, tối đa 10). N lần thì chia đều từ mốc "báo trước" tới hạn trả:
// vd 2 giờ x 3 lần = nhắc khi còn 2 giờ, 1 giờ 20 phút, 40 phút.
const soLanNhac = (k) => Math.min(10, Math.max(1, parseInt(ls.get('mplis_ch_' + k + '_lan'), 10) || 1));
const dungTg = () => kenhBat('tg', 'on');
const dungZl = () => kenhBat('zl', 'on');
const coTg = () => !!(ls.get(K_TOKEN).trim() && ls.get(K_CHAT).trim());
const coZl = () => !!(ls.get(K_ZL_TOKEN).trim() && ls.get(K_ZL_CHAT).trim());
const telegramSan = (loai) => dungTg() && coTg() && (!loai || kenhBat('tg', loai));
const zaloSan = (loai) => dungZl() && coZl() && (!loai || kenhBat('zl', loai));
// Gửi tin (đã soạn dạng HTML Telegram) tới mọi kênh đã nhập. Trả về [[tên kênh, lỗi hoặc '']];
// chỉ ném lỗi khi MỌI kênh đều hỏng, để nơi gọi không đánh dấu "đã gửi" khi chưa ai nhận được.
// loai (moi/tre/loi) chỉ gửi tới kênh nhận loại tin đó; không truyền loai (Gửi thử) thì gửi mọi kênh đang bật.
async function guiTatCa(html, loai, chiKenh) {
    const kenh = [];
    if (telegramSan(loai) && (!chiKenh || chiKenh === 'tg')) kenh.push(['Telegram', sendTelegram(html)]);
    if (zaloSan(loai) && (!chiKenh || chiKenh === 'zl')) kenh.push(['Zalo', guiZalo(htmlSangChu(html))]);
    if (!kenh.length) {
        if (telegramSan() || zaloSan()) return []; // có kênh nhưng không kênh nào muốn loại tin này: không phải lỗi
        throw new Error('Chưa nhập API Key + Chat ID (Telegram hoặc Zalo) hoặc kênh đang tắt');
    }
    const kq = await Promise.allSettled(kenh.map((k) => k[1]));
    const ds = kq.map((r, i) => [kenh[i][0], r.status === 'rejected' ? r.reason.message : '']);
    if (ds.every((x) => x[1])) throw new Error(ds.map((x) => x[0] + ': ' + x[1]).join(' · '));
    return ds;
}

const nguoiNop = {}; // mã hồ sơ -> tên người nộp (tra 1 lần, nhớ lại)
async function traNguoiNop(fresh) {
    (st.working || []).forEach((r) => { const t = docNguoiNop(r); if (t && r.soBienNhan) nguoiNop[r.soBienNhan] = t; });
    await Promise.all(fresh.filter((n) => !laTap(n) && n.ObjectId && !nguoiNop[n.ObjectId]).map(async (n) => {
        try { const t = await tenNguoiNop(n.ObjectId); if (t) nguoiNop[n.ObjectId] = t; } catch (e) { /* không tra được thì bỏ qua */ }
    }));
}

function buildMessage(fresh) {
    const byPerson = new Map();
    fresh.forEach((n) => {
        const k = tenNguoi(n);
        if (!byPerson.has(k)) byPerson.set(k, []);
        byPerson.get(k).push(n);
    });
    const parts = [];
    byPerson.forEach((list, who) => {
        const soHS = list.filter((n) => !laTap(n)).length, soTap = list.filter(laTap).length;
        const dem = [soHS ? soHS + ' hồ sơ' : '', soTap ? soTap + ' tập hồ sơ' : ''].filter(Boolean).join(' + ');
        const lines = list.slice().reverse().map((n) =>
            '  ▸ ' + (laTap(n) ? 'Tập <b>' + escapeHtml(n.ObjectId) + '</b>' : '<b>' + escapeHtml(String(n.ObjectId || '').toUpperCase()) + '</b>') +
            (nguoiNop[n.ObjectId] ? ' · ' + escapeHtml(nguoiNop[n.ObjectId]) : '') +
            ' · ' + escapeHtml(gioNgan(aspDate(n.NgayTao))) +
            (laTap(n) ? '' : dongPhu((st.working || []).find((r) => r && r.soBienNhan === n.ObjectId))));
        parts.push('👤 <b>' + escapeHtml(who) + '</b> chuyển <b>' + dem + '</b>\n' + lines.join('\n'));
    });
    let msg = '📥 <b>HỒ SƠ MỚI</b>\n' + KE + '\n' + parts.join('\n\n');
    if (st.working) {
        const tong = st.total !== null ? st.total : st.working.length;
        const ds = Array.from(demTheoNguoi().entries()).sort((a, b) => b[1].n - a[1].n);
        msg += '\n' + KE + '\n📊 <b>Đang chờ xử lý: ' + tong + ' bộ</b>\n' +
            ds.map(([ten, o]) => '  • ' + escapeHtml(ten) + ' — <b>' + o.n + '</b> bộ').join('\n');
    } else if (st.total !== null) msg += '\n' + KE + '\n📊 Đang chờ xử lý: <b>' + st.total + '</b> bộ';
    return msg;
}

// Một dòng hồ sơ trễ/sắp trễ: mã, người nộp, còn/trễ bao lâu, rồi loại hồ sơ + hẹn trả.
function dongTre(x, now) {
    const nn = docNguoiNop(x.r);
    return '  ▸ <b>' + escapeHtml(String(x.r.soBienNhan || '').toUpperCase()) + '</b>' + (nn ? ' · ' + escapeHtml(nn) : '') +
        ' · ' + (x.t < now ? '🔴 trễ ' : '⏳ còn ') + khoangThoiGian(x.t - now) + dongPhu(x.r);
}
// Mỗi kênh có mốc "báo trước N giờ" riêng: hồ sơ hẹn trả trong N giờ tới mà kênh đó chưa được nhắc thì gửi 1 tin gộp
// cho riêng kênh. "Đã nhắc" ghi theo từng kênh và chỉ ghi SAU khi gửi được; gửi lỗi thì lần kiểm tra sau thử lại.
async function nhacSapTre() {
    if (!st.working) return;
    const now = Date.now();
    let daNhac; try { daNhac = new Set(JSON.parse(ls.get(K_NHAC, '[]'))); } catch (e) { daNhac = new Set(); }
    let loi = null;
    for (const k of ['tg', 'zl']) {
        if (!(k === 'tg' ? telegramSan('tre') : zaloSan('tre'))) continue;
        const phut = Math.round(gioBaoTre(k) * 60);
        const n = soLanNhac(k);
        const khoa = (x, i) => k + '|' + x.r.soBienNhan + '|' + x.t + '|' + i;
        // Mốc đã tới = mốc có số thời gian còn lại >= thời gian còn lại thực tế. Chưa nhắc mốc nào đã tới thì nhắc 1 lần
        // và đánh dấu hết các mốc đã tới (hồ sơ vào muộn không bị nhắc dồn nhiều lần).
        const daToi = (x) => mocDaToi(x.t - now, phut, n);
        const moi = phanLoaiHan(st.working, now, phut).sap.filter((x) => daToi(x).some((i) => !daNhac.has(khoa(x, i))));
        if (!moi.length) continue;
        try {
            await guiTatCa('⏰ <b>SẮP TRỄ HẠN</b>' + (n > 1 ? ' (nhắc ' + n + ' lần trong ' + khoangThoiGian(phut * 60000) + ' cuối)' : ' (còn dưới ' + khoangThoiGian(phut * 60000) + ')') + '\n' + KE + '\n' + moi.map((x) => dongTre(x, now)).join('\n'), 'tre', k);
            moi.forEach((x) => daToi(x).forEach((i) => daNhac.add(khoa(x, i))));
        } catch (e) { loi = e; }
    }
    // Giữ khoá của hồ sơ còn trong danh sách chờ (cắt theo số lượng có thể xoá nhầm khoá hồ sơ còn sống rồi nhắc lặp).
    const con = new Set(st.working.map((r) => r.soBienNhan + '|' + hanTraMs(r)));
    ls.set(K_NHAC, JSON.stringify(Array.from(daNhac).filter((x) => { const p = x.split('|'); return con.has(p[1] + '|' + p[2]); }).slice(-3000)));
    if (loi) throw loi;
}
// /tre [giờ]: hồ sơ đã trễ + hồ sơ sắp trễ trong số giờ cho trước (mặc định 1 giờ).
function tomTatTre(doi) {
    if (!st.working) return 'Chưa có dữ liệu hồ sơ. Thử lại sau ít giây.';
    const gio = gioiHanGio(doi, 1);
    const now = Date.now();
    const { tre, sap } = phanLoaiHan(st.working, now, Math.round(gio * 60));
    const tenGio = gio + ' giờ';
    if (!tre.length && !sap.length) return '✅ <b>Không có hồ sơ trễ hoặc sắp trễ trong ' + tenGio + ' tới.</b>';
    let msg = '';
    if (tre.length) msg += '🔴 <b>ĐÃ TRỄ HẠN: ' + tre.length + ' bộ</b>\n' + KE + '\n' + tre.map((x) => dongTre(x, now)).join('\n');
    if (sap.length) msg += (msg ? '\n\n' : '') + '🟠 <b>SẮP TRỄ trong ' + tenGio + ': ' + sap.length + ' bộ</b>\n' + KE + '\n' + sap.map((x) => dongTre(x, now)).join('\n');
    return msg;
}

async function tick(manual) {
    if (st.busy) return;
    if (!manual && !isOn()) return;
    // Auto đang chạy (QT/Kết ISO) thì tuyệt đối không chen request vào, để tick sau.
    const run = topWin.MPLIS_AUTO_STATE;
    if (run && run.isRunning) { st.msg = 'Auto đang chạy, tạm hoãn kiểm tra.'; render(); return; }
    st.busy = true;
    try {
        const list = await fetchNotify();
        st.items = list;
        nhoTen(list);
        let conCho = null;
        try {
            const w = await fetchWork();
            if (w) { st.total = w.total; st.working = w.rows; conCho = maConCho(w.rows, w.total); }
        } catch (e) { /* đếm tổng là phần phụ, lỗi thì bỏ qua */ }
        st.lastCheck = Date.now();
        const seen = getSeen();
        // Hồ sơ đã xử lý xong (không còn trong Xử lý công việc) thì không báo nữa; tập hồ sơ không đối chiếu được nên vẫn báo.
        const conTrongDs = (n) => laTap(n) || !conCho || conCho.has(n.ObjectId);
        list.forEach((n) => { if (n.Id && !seen.has(n.Id) && !conTrongDs(n)) seen.add(n.Id); });
        saveSeen(seen);
        const fresh = list.filter((n) => n.Id && !seen.has(n.Id));
        st.newIds = new Set(fresh.map((n) => n.Id));
        if (ls.get(K_BASE) !== 'true') {
            // Lần đầu: coi mọi thông báo đang có là đã biết, tránh dội 15-30 tin cũ.
            list.forEach((n) => n.Id && seen.add(n.Id));
            saveSeen(seen);
            ls.set(K_BASE, 'true');
            st.newIds = new Set();
            st.msg = 'Đã ghi nhận mốc ' + list.length + ' thông báo cũ, từ giờ chỉ báo cái mới.';
        } else if (isOn() && fresh.length) {
            await traNguoiNop(fresh);
            const kq = await guiTatCa(buildMessage(fresh), 'moi');
            fresh.forEach((n) => seen.add(n.Id));
            saveSeen(seen);
            const hong = kq.filter((x) => x[1]);
            st.msg = !kq.length ? 'ℹ️ Có ' + fresh.length + ' thông báo mới nhưng không kênh nào đang nhận loại "Hồ sơ mới" nên chưa gửi.'
                : hong.length ? '⚠️ Gửi ' + fresh.length + ' thông báo mới nhưng lỗi: ' + hong.map((x) => x[0] + ': ' + x[1]).join(' · ')
                : '✅ Đã gửi ' + fresh.length + ' thông báo mới.';
        } else {
            st.msg = fresh.length ? fresh.length + ' thông báo mới (chưa gửi vì đang tắt).' : 'Không có hồ sơ mới.';
        }
        if (isOn()) await nhacSapTre();
    } catch (e) {
        st.msg = '❌ ' + e.message + ' (sẽ thử lại, không bỏ sót).';
    } finally {
        st.busy = false;
        render();
    }
}

// Dòng của GetXuLyCongViec có sẵn: nguoiChuyenTiep (tài khoản), tenNguoiChuyenTiep (họ tên),
// ngayPhanCong (giờ chuyển), nguoiNopDon.hoTen (người nộp).
function docNguoiChuyen(r) {
    return chuanTen((r && (r.nguoiChuyenTiep || r.tenNguoiChuyenTiep)) || '');
}
function docGioChuyen(r) { return aspDate(r && r.ngayPhanCong); }
function docNguoiNop(r) { return String((r && r.nguoiNopDon && r.nguoiNopDon.hoTen) || '').replace(/\s+/g, ' ').trim(); }
let _daLogCot = false;

// Mã hồ sơ còn nằm trong "Xử lý công việc" (chưa làm xong). null = chưa biết đủ để kết luận.
function maConCho(rows, total) {
    if (!Array.isArray(rows)) return null;
    if (typeof total === 'number' && rows.length < total) return null; // danh sách bị cắt, không dám kết luận
    return new Set(rows.map((r) => r && r.soBienNhan).filter(Boolean));
}

// Đếm theo người chuyển, lấy thẳng từ GetXuLyCongViec (hồ sơ xử lý xong tự biến mất khỏi danh sách này).
function demTheoNguoi() {
    const m = new Map();
    (st.working || []).forEach((r) => {
        const k = docNguoiChuyen(r) || 'Chưa rõ người chuyển';
        const o = m.get(k) || { n: 0, gio: null, ds: [] };
        o.n++;
        o.ds.push(r);
        const g = docGioChuyen(r);
        if (g && (!o.gio || g > o.gio)) o.gio = g;
        m.set(k, o);
    });
    return m;
}

// Tóm tắt ở tab Xử lý theo GetXuLyCongViec (số liệu đúng của màn Xử lý công việc), gộp theo người chuyển.
function renderSenders() {
    const el = document.getElementById('qt-sender-list');
    if (!el) return;
    const dim = (t) => '<span style="font-size:11.5px; color:var(--mplis-text-dim);">' + t + '</span>';
    if (!st.working) { el.innerHTML = dim('Chưa có dữ liệu. Mở màn Xử lý công việc hoặc bấm "Kiểm tra ngay" ở tab chuông.'); return; }
    if (!_daLogCot && st.working.length) { _daLogCot = true; console.log('[MPLIS Notify] Các cột của 1 dòng GetXuLyCongViec:', Object.keys(st.working[0]), st.working[0]); }
    const tong = st.total !== null ? st.total : st.working.length;
    const m = demTheoNguoi();
    let html = '<div style="font-size:12px; margin-bottom:3px;">Đang chờ xử lý: <b style="color:var(--mplis-accent-2);">' + tong + '</b> bộ</div>';
    html += Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n).map(([ten, o]) =>
        '<div class="mplis-lk-row" style="border-top:none; padding:3px 0;"><span style="color:var(--mplis-text);">' + escapeHtml(ten) + '</span><b>' + o.n + ' bộ' + (o.gio ? ' · ' + escapeHtml(fmtTime(o.gio)) : '') + '</b></div>').join('');
    el.innerHTML = html;
}

// Trang tự gọi GetXuLyCongViec / GetNotify: bắt kết quả để hiện luôn, khỏi tốn request của tool.
window.addEventListener('mplis:api', ({ detail: e }) => {
    try {
        const ep = e.ep || '';
        const q = new URLSearchParams(typeof e.req === 'string' ? e.req : '');
        const daLoc = !!(q.get('query') || q.get('search[value]') || (q.get('filterBy') && q.get('filterBy') !== '0'));
        if (ep.indexOf('GetXuLyCongViec') !== -1 && !daLoc && e.res && Array.isArray(e.res.data)) {
            st.working = e.res.data;
            st.total = typeof e.res.recordsTotal === 'number' ? e.res.recordsTotal : e.res.data.length;
            render();
        } else if (ep.indexOf('GetNotify') !== -1 && e.res && Array.isArray(e.res.Value)) {
            st.items = e.res.Value;
            nhoTen(st.items);
            render();
        }
    } catch (err) { }
});

function render() {
    renderSenders();
    const box = document.getElementById('tg-list');
    if (!box) return;
    const cnt = document.getElementById('tg-total');
    if (cnt) cnt.textContent = st.total === null ? '—' : String(st.total);
    const sub = document.getElementById('tg-sub');
    if (sub) sub.textContent = st.lastCheck ? 'Kiểm tra lúc ' + fmtTime(new Date(st.lastCheck)) : 'Chưa kiểm tra';
    const msg = document.getElementById('tg-msg');
    if (msg) msg.textContent = st.msg;
    const conCho = st.working ? maConCho(st.working, st.total) : null;
    const dsHien = st.items.filter((n) => laTap(n) || !conCho || conCho.has(n.ObjectId));
    const hs = dsHien.filter((n) => !laTap(n)).length, tap = dsHien.length - hs;
    const head = document.getElementById('tg-recv');
    if (head) head.textContent = 'Vừa nhận: ' + hs + ' hồ sơ' + (tap ? ' · ' + tap + ' tập' : '');
    box.innerHTML = dsHien.length ? dsHien.map((n) =>
        '<div class="mplis-lk-row"><span>' + escapeHtml(fmtTime(aspDate(n.NgayTao))) + (st.newIds.has(n.Id) ? ' 🆕' : '') + '</span>' +
        '<b>' + (laTap(n) ? 'Tập ' + escapeHtml(n.ObjectId) : escapeHtml(String(n.ObjectId || '').toUpperCase())) + ' ← ' + escapeHtml(tenNguoi(n)) + '</b></div>'
    ).join('') : '';
}

// ---- Hỏi bot trên Telegram: gõ bất kỳ chữ nào (hoặc /tong, /chitiet) để biết ai chuyển bao nhiêu bộ ----
const K_OFFSET = 'mplis_tg_offset';
function tgGoi(method, body) {
    return new Promise((resolve, reject) => {
        const token = ls.get(K_TOKEN).trim();
        if (!token || typeof GM_xmlhttpRequest === 'undefined') { reject(new Error('Thiếu API Key')); return; }
        GM_xmlhttpRequest({
            method: 'POST', url: 'https://api.telegram.org/bot' + token + '/' + method,
            headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(body || {}), timeout: 15000,
            onload: (res) => { try { const b = JSON.parse(res.responseText); b.ok ? resolve(b.result) : reject(new Error(b.description || 'HTTP ' + res.status)); } catch (e) { reject(e); } },
            onerror: () => reject(new Error('Lỗi kết nối Telegram')), ontimeout: () => reject(new Error('Telegram quá thời gian'))
        });
    });
}
// Loại hồ sơ = tên quy trình, bỏ mã đầu ("2026.CN.11.1. Trường hợp đăng ký biến động..." -> "Đăng ký biến động...").
function loaiHoSoNgan(item) {
    let t = String((item && item.quytrinh && item.quytrinh.SchemaName) || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    t = t.replace(/^[\w.]+\.\s+/, '').replace(/^trường hợp\s+/i, '');
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t.length > 90 ? t.slice(0, 87) + '...' : t;
}
// Hẹn trả kèm ngày giờ đầy đủ; quá hạn thì đánh dấu để nhìn là biết.
function henTraNgan(item) {
    const d = aspDate(item && item.ngayhenTra);
    if (!d) return '';
    const s = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ' ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
    return d.getTime() < Date.now() ? s + ' ⚠️ quá hạn' : s;
}
// Hai dòng phụ dưới mỗi hồ sơ: loại hồ sơ + hẹn trả (bỏ dòng nào không có dữ liệu).
function dongPhu(item) {
    const loai = loaiHoSoNgan(item), hen = henTraNgan(item);
    return (loai ? '\n      📋 ' + escapeHtml(loai) : '') + (hen ? '\n      ⏰ Hẹn trả: <b>' + escapeHtml(hen) + '</b>' : '');
}
function dongHoSo(r) {
    const nn = docNguoiNop(r);
    return '  ▸ <b>' + escapeHtml(String(r.soBienNhan || '').toUpperCase()) + '</b>' + (nn ? ' · ' + escapeHtml(nn) : '') + ' · ' + escapeHtml(gioNgan(docGioChuyen(r))) + dongPhu(r);
}
function tomTat(chiTiet) {
    if (!st.working) return 'Chưa có dữ liệu hồ sơ. Thử lại sau ít giây.';
    const tong = st.total !== null ? st.total : st.working.length;
    const ds = Array.from(demTheoNguoi().entries()).sort((a, b) => b[1].n - a[1].n);
    if (!ds.length) return '📊 <b>Không có hồ sơ nào đang chờ xử lý.</b>';
    let msg = '📊 <b>ĐANG CHỜ XỬ LÝ: ' + tong + ' bộ</b>\n' + KE;
    ds.forEach(([ten, o]) => {
        msg += '\n👤 <b>' + escapeHtml(ten) + '</b> — ' + o.n + ' bộ' + (o.gio ? ' (mới nhất ' + escapeHtml(gioNgan(o.gio)) + ')' : '');
        if (chiTiet) {
            o.ds.slice().sort((a, b) => (docGioChuyen(b) || 0) - (docGioChuyen(a) || 0)).forEach((r) => { msg += '\n' + dongHoSo(r); });
            msg += '\n';
        }
    });
    msg += '\n' + KE + '\n🕒 Cập nhật ' + fmtTime(new Date(st.lastCheck || Date.now()));
    return msg;
}
function guiChia(chat, text) {
    const parts = []; let cur = '';
    text.split('\n').forEach((line) => { if ((cur + '\n' + line).length > 3800) { parts.push(cur); cur = line; } else cur += (cur ? '\n' : '') + line; });
    if (cur) parts.push(cur);
    return parts.reduce((p, t) => p.then(() => tgGoi('sendMessage', { chat_id: chat, text: t, parse_mode: 'HTML', disable_web_page_preview: true })), Promise.resolve());
}
const HUONG_DAN = '🤖 <b>BOT MPLIS — CÁCH HỎI</b>\n' + KE + '\n' +
    '📊 <b>/tong</b> — tổng số bộ đang chờ, mỗi người chuyển bao nhiêu\n' +
    '📋 <b>/chitiet</b> — như trên, kèm từng hồ sơ (mã, người nộp, giờ chuyển)\n' +
    '👤 <b>/ai thoi</b> — hồ sơ của người có tên chứa "thoi" (gõ không dấu cũng được)\n' +
    '⏰ <b>/tre</b> — hồ sơ đã trễ + sắp trễ trong 1 giờ (<b>/tre 3</b> = trong 3 giờ). Tool cũng tự nhắc trước hạn theo số giờ đặt ở từng kênh (mặc định 2 giờ)\n' +
    '🔎 <b>/tracuu 0402</b> — hồ sơ đi tới đâu, ai đang giữ, hẹn trả khi nào\n' +
    '      Gõ thẳng đuôi mã (VD: <b>0402</b> hoặc <b>9-0402</b>) cũng được\n' +
    '🔄 <b>/f5</b> — tải lại trang MPLIS trên máy (khi trang treo hoặc hết phiên)\n' +
    '❓ <b>/help</b> — hiện bảng này\n' + KE + '\n' +
    'Gõ chữ khác bot sẽ hiện /tong. Bot chỉ trả lời khi bật "Chế độ đi vắng" trong tool.';

// Bỏ dấu + chữ thường để gõ "thoi" vẫn khớp "Thởi".
const boDau = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

function tomTatNguoi(tuKhoa) {
    if (!st.working) return 'Chưa có dữ liệu hồ sơ. Thử lại sau ít giây.';
    const k = boDau(tuKhoa);
    const ds = Array.from(demTheoNguoi().entries()).filter(([ten]) => boDau(ten).includes(k));
    if (!ds.length) return '❌ Không thấy ai tên có "' + escapeHtml(tuKhoa) + '" trong danh sách đang chờ.';
    let msg = '';
    ds.forEach(([ten, o]) => {
        msg += (msg ? '\n\n' : '') + '👤 <b>' + escapeHtml(ten) + '</b> — ' + o.n + ' bộ\n' + KE;
        o.ds.slice().sort((a, b) => (docGioChuyen(b) || 0) - (docGioChuyen(a) || 0)).forEach((r) => { msg += '\n' + dongHoSo(r); });
    });
    return msg;
}

// Hồ sơ đi tới đâu: bước hiện tại, ai đang giữ, ai chuyển, hẹn trả, đã kết ISO/trả chưa.
function moTaHoSo(it) {
    const buoc = (it.state && it.state.Title) || 'Đang xử lý';
    const ap = extractApplicant(it);
    const dong = [];
    const row = (icon, nhan, val) => dong.push(icon + ' ' + nhan + ': <b>' + escapeHtml(val || '—') + '</b>');
    const row2 = (nhan, val) => dong.push('  ' + nhan + ': <b>' + escapeHtml(val || '—') + '</b>');
    dong.push('🔎 <b>' + escapeHtml(it.soBienNhan) + '</b>');
    dong.push('📍 Đang ở bước: <b>' + escapeHtml(buoc) + '</b>');
    const loaiHS = loaiHoSoNgan(it);
    if (loaiHS) dong.push('📋 Loại hồ sơ: <b>' + escapeHtml(loaiHS) + '</b>');
    const chip = [];
    if (it.daTra) chip.push('✅ Đã trả ' + parseAspNetDate(it.ngayTra));
    if (it.daKetISO) chip.push('🟦 Đã kết ISO');
    if (it.daCapNhatDuLieuPhapLy) chip.push('🟦 Đã cập nhật pháp lý');
    if (it.choBoSung) chip.push('⚠️ Chờ bổ sung');
    if (chip.length) dong.push(escapeHtml(chip.join(' · ')));
    dong.push(KE);
    row('🧑‍💼', 'Người đang xử lý', it.tenNguoiTiepNhan ? chuanTen(it.nguoiTiepNhan || it.tenNguoiTiepNhan) : '');
    row('📤', 'Người chuyển tiếp', it.tenNguoiChuyenTiep ? chuanTen(it.nguoiChuyenTiep || it.tenNguoiChuyenTiep) : '');
    const hen = parseAspNetDate(it.ngayhenTra);
    if (hen) row('⏰', 'Hẹn trả', hen);
    dong.push(KE);
    dong.push('🙍 <b>Người nộp đơn</b>');
    row2('Họ tên', ap.hoTen);
    row2('Số giấy tờ', ap.soGiayTo);
    row2('Điện thoại', ap.sdt);
    row2('Phường/Xã', ap.phuongXa);
    const docs = Array.isArray(it.giayToDinhKem) ? it.giayToDinhKem : [];
    dong.push(KE);
    dong.push('📎 <b>Giấy tờ đính kèm (' + docs.length + ')</b>');
    if (!docs.length) dong.push('  Chưa có giấy tờ đính kèm');
    docs.forEach((g, i) => {
        const ten = escapeHtml(g.tenGiayTo || g.Title || '(không tên)');
        const nhan = g.tepDinhKem ? '<a href="https://dla.mplis.gov.vn/dc/PdfViewer?fileId=' + encodeURIComponent(g.tepDinhKem) + '">' + ten + '</a>' : ten;
        dong.push('  ' + (i + 1) + '. ' + nhan + (g.laGiayToKySo ? ' ✍️' : ''));
    });
    return dong.join('\n');
}
async function traCuuBot(tuKhoa) {
    const q = String(tuKhoa || '').trim();
    if (!/\d{2,}/.test(q)) return 'Nhập ít nhất 2-3 số cuối mã hồ sơ. VD: <b>/tracuu 0402</b>';
    let ds;
    try { ds = await traCuuHoSo(q); } catch (e) { return '❌ Tra cứu lỗi: ' + escapeHtml(e.message); }
    if (!ds.length) return '❌ Không tìm thấy hồ sơ nào khớp "' + escapeHtml(q) + '".';
    const toiDa = 5;
    let msg = ds.slice(0, toiDa).map(moTaHoSo).join('\n\n');
    if (ds.length > toiDa) msg += '\n\n… còn ' + (ds.length - toiDa) + ' hồ sơ khác, gõ thêm số cho gọn (VD: <b>9-0402</b>).';
    return msg;
}

let daDatMenu = false;
async function datMenuBot() {
    if (daDatMenu) return;
    try {
        await tgGoi('setMyCommands', { commands: [
            { command: 'tong', description: 'Tổng hồ sơ đang chờ, ai chuyển bao nhiêu' },
            { command: 'chitiet', description: 'Chi tiết từng hồ sơ' },
            { command: 'ai', description: 'Xem hồ sơ của 1 người: /ai thoi' },
            { command: 'tre', description: 'Hồ sơ đã trễ và sắp trễ hạn' },
            { command: 'tracuu', description: 'Hồ sơ đi tới đâu: /tracuu 0402' },
            { command: 'f5', description: 'Tải lại trang MPLIS trên máy' },
            { command: 'help', description: 'Hướng dẫn' }
        ] });
        daDatMenu = true;
    } catch (e) { /* menu chỉ là tiện ích, lỗi bỏ qua */ }
}
async function lamMoiDuLieu() {
    const run = topWin.MPLIS_AUTO_STATE;
    if (run && run.isRunning) return; // đang chạy quy trình thì dùng số liệu cũ, không chen request
    try { const w = await fetchWork(); if (w) { st.total = w.total; st.working = w.rows; st.lastCheck = Date.now(); render(); } } catch (e) { /* dùng số liệu cũ */ }
}
let canTaiLai = false; // đặt khi người dùng gõ /f5; tải lại SAU khi đã gửi xong câu trả lời
async function traLoi(text) {
    const t = catToiLenh(text);
    const m = /^\/?([a-zA-Z0-9_À-ỹ]+)(?:@\w+)?\s*(.*)$/s.exec(t);
    const lenh = m ? boDau(m[1]) : '';
    const doi = m ? m[2].trim() : '';
    if (/^(start|help|huongdan|hd|trogiup)$/.test(lenh) || t === '?') return HUONG_DAN;
    if (/^(f5|reload|taitrang|lammoi)$/.test(lenh)) {
        const run = topWin.MPLIS_AUTO_STATE;
        if (run && run.isRunning && !/ep|force/i.test(doi)) return '⚠️ Tool đang chạy quy trình, tải lại trang giữa chừng có thể làm hỏng bước đang làm.\nMuốn vẫn tải lại thì gõ <b>/f5 ep</b>.';
        canTaiLai = true;
        return '🔄 Đang tải lại trang (F5)...';
    }

    if (/^(tre|trehan|han)$/.test(lenh)) { await lamMoiDuLieu(); return tomTatTre(doi); }
    if (/^(tracuu|tc|tim|hoso)$/.test(lenh)) return traCuuBot(doi);
    if (/\d{3,}/.test(t) && !/^\/(tong|chitiet|ai)\b/i.test(t)) return traCuuBot(t.replace(/^\/\S+\s*/, ''));
    if (/^(ai|nguoi)$/.test(lenh)) { if (!doi) return 'Gõ kèm tên, VD: <b>/ai thoi</b>'; await lamMoiDuLieu(); return tomTatNguoi(doi); }
    await lamMoiDuLieu();
    return tomTat(/^(chitiet|ct|ds|list)$/.test(lenh));
}

let dangHoi = false;
async function pollLenh() {
    if (dangHoi || !isOn() || !kenhBat('tg', 'lenh') || !dungTg() || !ls.get(K_TOKEN).trim() || !ls.get(K_CHAT).trim()) return;
    dangHoi = true;
    try {
        datMenuBot();
        const raw = ls.get(K_OFFSET, '');
        const dsCapNhat = await tgGoi('getUpdates', raw ? { offset: parseInt(raw, 10), timeout: 0, allowed_updates: ['message'] } : { timeout: 0, allowed_updates: ['message'] });
        if (!dsCapNhat.length) { if (!raw) ls.set(K_OFFSET, '0'); return; } // chưa có tin nào: từ giờ mọi tin mới đều được trả lời
        if (!raw) { ls.set(K_OFFSET, String(dsCapNhat[dsCapNhat.length - 1].update_id + 1)); return; } // lần đầu: bỏ qua tin cũ, chỉ trả lời tin gửi từ giờ
        const chat = ls.get(K_CHAT).trim();
        for (const u of dsCapNhat) {
            const m = u.message;
            if (m && m.text && String(m.chat && m.chat.id) === chat) { // chỉ nghe đúng chat của bạn
                let tra;
                try { tra = await traLoi(m.text); } catch (e) { tra = '❌ Lỗi: ' + escapeHtml(e.message); }
                // Lỗi mạng thì ném ra để tin này ở lại hàng đợi, lần sau trả lời lại; lỗi khác (vd HTML sai) bỏ qua kẻo kẹt mãi.
                try { await guiChia(chat, tra); } catch (e) { if (/kết nối|quá thời gian/.test(e.message)) throw e; }
            }
            ls.set(K_OFFSET, String(u.update_id + 1));
            if (canTaiLai) { canTaiLai = false; setTimeout(() => { try { topWin.location.reload(); } catch (e) { location.reload(); } }, 800); return; }
        }
    } catch (e) { /* mạng lỗi thì lần sau hỏi lại */ } finally { dangHoi = false; }
}

// Nhận lệnh từ Zalo bằng getUpdates (không có máy chủ để nhận webhook). Zalo không có offset: tin đọc rồi là hết,
// nên chỉ đọc khi đã bật "Chế độ đi vắng". Chưa nhập Chat ID thì chỉ báo ID người nhắn để bạn dán vào, không trả lời ai.
let zlDangHoi = false, zlDaGoHook = false;
async function pollZalo() {
    if (zlDangHoi || !isOn() || !kenhBat('zl', 'lenh') || !dungZl() || !ls.get(K_ZL_TOKEN).trim()) return;
    zlDangHoi = true;
    try {
        // Zalo không cho getUpdates khi bot đang đặt webhook (hai cách loại trừ nhau), nên gỡ webhook 1 lần mỗi lần tải trang.
        if (!zlDaGoHook) { zlDaGoHook = true; try { await zaloGoi('deleteWebhook', {}); } catch (e) { /* chưa đặt webhook thì báo lỗi cũng không sao */ } }
        // 408 Request timeout = Zalo chờ hết giờ mà chưa có tin mới: bình thường, không phải lỗi.
        const r = await zaloGoi('getUpdates', { timeout: '10' }, 45000).catch((e) => { if (/408|Request timeout/.test(e.message)) return null; throw e; });
        const ds = Array.isArray(r) ? r : (r && r.message ? [r] : []);
        const chat = ls.get(K_ZL_CHAT).trim();
        if (!chat && !ds.length) { st.msg = 'Zalo: đã kết nối, chưa có tin mới. Hãy nhắn bot 1 tin bất kỳ.' + (r ? ' Trả về: ' + JSON.stringify(r).slice(0, 150) : ''); render(); }
        for (const u of ds) {
            const m = u.message;
            if (!m || !m.text || (m.from && m.from.is_bot)) continue;
            const id = String(m.chat && m.chat.id);
            if (!chat) { // Chưa có Chat ID: chỉ hiện ID người nhắn để bạn tự dán, không tự nhận (người lạ nhắn trước sẽ thành chủ nhận tin).
                st.msg = 'Zalo: có tin từ chat ID ' + id + ' (loại ' + ((m.chat && m.chat.chat_type) || '?') + '). Đúng chat của bạn thì dán ID này vào ô Zalo Chat ID.'; render(); break; }
            if (id !== chat) { st.msg = 'Zalo: có tin từ chat khác (loại ' + ((m.chat && m.chat.chat_type) || '?') + ', ID ' + id + '), bỏ qua. Muốn dùng chat đó thì dán ID này vào ô Zalo Chat ID.'; render(); continue; } // chỉ nghe đúng chat của bạn
            let tra;
            try { tra = await traLoi(m.text); } catch (e) { tra = '❌ Lỗi: ' + escapeHtml(e.message); }
            // Zalo không có menu lệnh như Telegram (setMyCommands), nên nhắc cách hỏi ở cuối mỗi tin trả lời.
            await guiZalo(htmlSangChu(tra) + (/^\/?(start|help|hd|huongdan|trogiup)\b/i.test(String(m.text).trim()) ? '' : '\n' + KE + '\n💡 Gõ: /tong · /chitiet · /tre · /ai <tên> · /tracuu 0402 · /f5 · /help'));
            if (canTaiLai) { canTaiLai = false; setTimeout(() => { try { topWin.location.reload(); } catch (e) { location.reload(); } }, 800); return; }
        }
    } catch (e) {
        // Chưa có Chat ID thì hiện lý do để biết đang kẹt ở đâu (token sai, đang đặt webhook, chưa cấp quyền kết nối...).
        if (!ls.get(K_ZL_CHAT).trim()) { st.msg = 'Zalo: chưa nhận được tin (' + e.message + ')'; render(); }
    } finally { zlDangHoi = false; }
}

// Cho module khác (process-module) báo Telegram khi auto tự dừng vì lỗi. Chỉ gửi khi đang bật
// "Chế độ đi vắng" và đã nhập API Key + Chat ID; lỗi gửi thì nuốt, không làm hỏng việc dừng auto.
if (window === window.top) {
    topWin.MPLIS_TG_ALERT = (html) => {
        if (!isOn() || !(telegramSan('loi') || zaloSan('loi'))) return;
        guiTatCa(html, 'loi').catch((e) => console.log('[MPLIS Notify] Không gửi được cảnh báo lỗi:', e.message));
    };
}

let timer = false;
function startTimer() {
    if (timer) return;
    timer = true;
    const run = () => {
        const sec = Math.max(15, parseInt(ls.get(K_SEC, '30'), 10) || 30);
        if (Date.now() - st.lastCheck >= sec * 1000 - 500) tick(false);
    };
    const chay = () => setFastInterval(() => { run(); pollLenh(); pollZalo(); }, 5000);
    // Nhiều tab MPLIS cùng mở thì chỉ tab giữ khoá này báo tin và đọc lệnh, tránh gửi trùng; tab đó đóng thì tab khác lên thay.
    if ('locks' in navigator) navigator.locks.request('mplis-notify', () => { chay(); return new Promise(() => { }); });
    else chay();
}

// Khối cài đặt của 1 kênh: công tắc bật kênh, ô nhập, rồi tick từng loại tin kênh đó nhận.
function khoiKenh(k, ten, oNhap) {
    const tick = (l, nhan) => '<label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--mplis-text);"><input type="checkbox" id="ch-' + k + '-' + l + '" ' + (kenhBat(k, l) ? 'checked' : '') + '> ' + nhan + '</label>';
    return '<div id="kenh-' + k + '" style="padding:8px 0; border-top:1px solid var(--mplis-border);">' +
        '<div class="mplis-bypass-row" style="padding:0 0 6px;"><div class="mplis-bypass-row-label"><strong>' + ten + '</strong></div>' +
        '<label class="mplis-toggle-sw"><input type="checkbox" id="ch-' + k + '-on" ' + (kenhBat(k, 'on') ? 'checked' : '') + '><span class="mplis-toggle-track"></span></label></div>' +
        oNhap +
        '<div style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--mplis-text-dim); margin:4px 0;">Báo trễ trước <input type="number" id="ch-' + k + '-gio" min="0.25" max="72" step="0.5" value="' + gioBaoTre(k) + '" style="width:60px; padding:4px; text-align:center;"> giờ, nhắc <input type="number" id="ch-' + k + '-lan" min="1" max="10" step="1" value="' + soLanNhac(k) + '" style="width:48px; padding:4px; text-align:center;"> lần</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; margin-top:2px;">' + LOAI_TIN.map(([l, nhan]) => tick(l, nhan)).join('') + '</div></div>';
}
export const NotifyModule = {
    html() {
        return `
        <div class="mplis-card">
            <div class="mplis-bypass-row" style="padding-top:0;">
                <div class="mplis-bypass-row-label"><strong>Chế độ đi vắng · báo tin</strong><span id="tg-sub">Chưa kiểm tra</span></div>
                <label class="mplis-toggle-sw"><input type="checkbox" id="tg-on" ${isOn() ? 'checked' : ''}><span class="mplis-toggle-track"></span></label>
            </div>
            <div style="display:flex; align-items:baseline; gap:8px; margin-top:6px;">
                <span id="tg-total" style="font-size:30px; font-weight:800; color:var(--mplis-accent-2); font-variant-numeric:tabular-nums;">—</span>
                <span style="font-size:12px; color:var(--mplis-text-dim);">bộ đang chờ xử lý</span>
            </div>
            <div id="tg-recv" style="font-size:12px; color:var(--mplis-text); margin-top:2px;"></div>
            <div id="tg-msg" class="mplis-hint" title="Bấm để copy" style="margin:6px 0 0; cursor:pointer; user-select:text !important;"></div>
            <div style="display:flex; gap:6px; margin-top:8px;">
                <button type="button" class="mplis-btn-primary" id="tg-check" style="flex:1; padding:8px;">Kiểm tra ngay</button>
                <button type="button" class="mplis-btn-ghost" id="tg-test" style="padding:8px 12px;">Gửi thử</button>
            </div>
        </div>
        <div class="mplis-card" id="tg-list" style="max-height:260px; overflow-y:auto;"></div>
        <div class="mplis-card mplis-collapse" id="tg-cfg-card">
            <button type="button" class="mplis-collapse-head" id="tg-cfg-toggle" aria-expanded="false">
                <span class="mplis-section-label">Kênh báo tin</span>
                <span class="mplis-collapse-state" id="tg-cfg-state">${telegramSan() || zaloSan() ? 'Đã nhập' : 'Chưa nhập'}</span>
                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="mplis-collapse-body">
                ${khoiKenh('tg', 'Telegram', '<input type="text" id="tg-token" placeholder="API Key" autocomplete="off" spellcheck="false" style="width:100%; padding:8px; font-size:12px; margin-bottom:6px; color:#f0f4fc !important; -webkit-text-security:disc; text-security:disc;"><input type="text" id="tg-chat" placeholder="Chat ID" autocomplete="off" spellcheck="false" style="width:100%; color:#f0f4fc !important; padding:8px; font-size:12px; margin-bottom:6px;">')}
                ${khoiKenh('zl', 'Zalo Bot', '<input type="text" id="zl-token" placeholder="Zalo Bot token" autocomplete="off" spellcheck="false" style="width:100%; padding:8px; font-size:12px; margin-bottom:6px; color:#f0f4fc !important; -webkit-text-security:disc; text-security:disc;"><input type="text" id="zl-chat" placeholder="Zalo Chat ID" autocomplete="off" spellcheck="false" style="width:100%; color:#f0f4fc !important; padding:8px; font-size:12px; margin-bottom:6px;">')}
                <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mplis-text-dim);">Kiểm tra mỗi
                    <input type="number" id="tg-sec" min="15" step="5" style="width:64px; padding:5px; text-align:center;"> giây</div>
                <button type="button" class="mplis-btn-ghost" id="tg-reset" style="margin-top:8px; padding:7px 12px; font-size:11.5px;">Xoá lịch sử đã gửi</button>
            </div>
        </div>`;
    },
    init() {
        const el = (id) => document.getElementById(id);
        if (!el('tab-notify')) return;
        el('tab-notify').innerHTML = this.html();
        el('tg-token').value = ls.get(K_TOKEN);
        el('tg-chat').value = ls.get(K_CHAT);
        el('tg-sec').value = ls.get(K_SEC, '30');
        el('zl-token').value = ls.get(K_ZL_TOKEN);
        el('zl-chat').value = ls.get(K_ZL_CHAT);
        // Cài đặt từng kênh: lưu ngay khi tick. Tắt "Trả lời lệnh" của 1 kênh thì kênh đó chỉ nhận tin, không trả lời.
        ['tg', 'zl'].forEach((k) => ['on'].concat(LOAI_TIN.map((x) => x[0])).forEach((l) => {
            el('ch-' + k + '-' + l).onchange = (e) => {
                ls.set('mplis_ch_' + k + '_' + l, e.target.checked ? 'true' : 'false');
                el('tg-cfg-state').textContent = telegramSan() || zaloSan() ? 'Đã nhập' : 'Chưa nhập';
                st.msg = 'Đã lưu cài đặt ' + (k === 'tg' ? 'Telegram' : 'Zalo') + '.';
                render();
            };
        }));
        ['tg', 'zl'].forEach((k) => {
            el('ch-' + k + '-lan').oninput = (e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1) ls.set('mplis_ch_' + k + '_lan', String(Math.min(10, v)));
            };
            el('ch-' + k + '-gio').oninput = (e) => {
                const v = parseFloat(String(e.target.value).replace(',', '.'));
                if (v > 0) ls.set('mplis_ch_' + k + '_gio', String(v));
            };
        });
        const card = el('tg-cfg-card');
        el('tg-cfg-toggle').onclick = () => {
            const o = card.classList.toggle('open');
            el('tg-cfg-toggle').setAttribute('aria-expanded', o ? 'true' : 'false');
        };
        const saveCfg = () => {
            ls.set(K_TOKEN, el('tg-token').value.trim());
            ls.set(K_CHAT, el('tg-chat').value.trim());
            ls.set(K_SEC, String(Math.max(15, parseInt(el('tg-sec').value, 10) || 30)));
            ls.set(K_ZL_TOKEN, el('zl-token').value.trim());
            ls.set(K_ZL_CHAT, el('zl-chat').value.trim());
            el('tg-cfg-state').textContent = telegramSan() || zaloSan() ? 'Đã nhập' : 'Chưa nhập';
        };
        ['tg-token', 'tg-chat', 'tg-sec', 'zl-token', 'zl-chat'].forEach((id) => { el(id).oninput = saveCfg; });
        el('tg-on').onchange = (e) => {
            ls.set(K_ON, e.target.checked ? 'true' : 'false');
            st.msg = e.target.checked ? 'Đã bật. Lần kiểm tra tới sẽ báo hồ sơ mới.' : 'Đã tắt, không gửi tin nào.';
            render();
            if (e.target.checked) tick(false);
        };
        el('tg-check').onclick = () => tick(true);
        el('tg-msg').onclick = () => { try { GM_setClipboard(el('tg-msg').textContent); const cu = st.msg; st.msg = 'Đã copy dòng trạng thái'; render(); setTimeout(() => { st.msg = cu; render(); }, 1200); } catch (e) { } };
        el('tg-cfg-card').style.display = 'block';
        el('tg-test').onclick = async () => {
            saveCfg();
            try {
                const kq = await guiTatCa('✅ <b>MPLIS Auto</b>: kết nối thành công.');
                st.msg = 'Gửi thử: ' + kq.map(([ten, loi]) => ten + (loi ? ' ❌ ' + loi : ' ✅')).join(' · ');
            } catch (e) { st.msg = '❌ Gửi thử lỗi: ' + e.message; }
            render();
        };
        el('tg-reset').onclick = () => {
            ls.set(K_SEEN, '[]'); ls.set(K_BASE, 'false'); ls.set(K_NHAC, '[]');
            st.msg = 'Đã xoá lịch sử. Lần kiểm tra tới ghi lại mốc, không gửi tin cũ.';
            render();
        };
        render();
        startTimer();
    },
};
