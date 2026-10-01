/* jshint esversion: 11 */
/* globals unsafeWindow */

// Copy sẵn TÊN FILE PDF để đổi tên file quét: "<mã hồ sơ đầy đủ>-<Số phát hành>.pdf", VD
//   H15.50.05.12-260917-0681-AA 09122325.pdf
// Có kèm đuôi .pdf. Đổi tên trong Windows thì BẬT "hiện đuôi file" (File Explorer > View >
// File name extensions), còn đang ẩn đuôi mà dán tên có .pdf là thành .pdf.pdf.
//
// Số phát hành chỉ có sau khi làm xong bước 1, nên chỉ lấy được trên màn hình "Cập nhật pháp lý
// giấy chứng nhận". Ở đó bảng giấy chứng nhận có từng dòng, ô đầu ghi loại giấy:
//   <tr role="row"><td>Giấy in mới</td><td>Nguyễn Văn Luân</td><td>AA 09122325</td>...
// Chỉ lấy dòng "Giấy in mới" - giấy thu hồi/giấy cũ không dùng để đặt tên file.
// Mỗi dòng giấy in mới được gắn 1 nút "Copy tên file" riêng, hồ sơ nhiều giấy thì khỏi lẫn.
//
// Hai kiểu tên, dùng ở màn hình "Danh sách giấy tờ đính kèm hồ sơ":
//   1. Tên GIẤY CHỨNG NHẬN: <mã hồ sơ>-<Số phát hành>.pdf  - file này PHẢI tích ô đồng bộ
//      về một cửa.
//   2. Tên GIẤY TỜ KÈM:     <mã hồ sơ>-GT.pdf hoặc -PT.pdf  - chọn hậu tố trong tab Cài đặt,
//      file này KHÔNG tích ô đồng bộ.
// Tool chỉ tạo/copy tên; việc tích ô đồng bộ vẫn do người dùng (chưa biết id ô đó trên cổng).

import { fallbackCopyTextToClipboard } from './utils.js';

const SCAN_INTERVAL_MS = 1000;
const BTN_CLASS = 'mplis-btn-copy-tenfile';
const BTN_MARK = 'data-mplis-tenfile';

// "H15.50.05.12-260917-0681" - nhiều nhóm cách nhau bằng dấu chấm, rồi -6 số -4 số.
const MA_HS_RE = /[A-Z0-9]+(?:\.[A-Z0-9]+){2,}-\d{6}-\d{3,}/i;
const DUOI = '.pdf';
// "AA 09122325" - 2 chữ cái rồi dãy số, khoảng trắng ở giữa có hoặc không.
const SPH_RE = /\b([A-Z]{2})\s*(\d{6,})\b/;
const GIAY_IN_MOI_RE = /giấy in mới/i;

// Hậu tố cho tên giấy tờ kèm. Đọc lại mỗi lần bấm nên đổi trong Cài đặt là áp dụng ngay.
const HAU_TO_KEY = 'mplis_tenfile_hau_to';
const HAU_TO_HOP_LE = ['GT', 'PT'];
const BANG_DINH_KEM_SELECTOR = '#tbGiayToDinhKem, #tbDanhSachGiayToDinhKem';
const THANH_NUT_ID = 'mplis-tenfile-toolbar';

// Tự tích ô "đồng bộ về một cửa" - mặc định TẮT vì đây là ghi lên form thật của cổng.
const TU_TICH_KEY = 'mplis_tenfile_tu_tich_dongbo';
const DA_TICH_ATTR = 'data-mplis-dongbo';

function tuTichBat() {
    try { return localStorage.getItem(TU_TICH_KEY) === 'true'; } catch (e) { return false; }
}

function layHauTo() {
    let v = '';
    try { v = (localStorage.getItem(HAU_TO_KEY) || '').trim().toUpperCase(); } catch (e) { }
    return HAU_TO_HOP_LE.includes(v) ? v : 'GT';
}

function dangHien(el) {
    if (!el) return false;
    try {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    } catch (e) {
        return false;
    }
}

// Mã hồ sơ đầy đủ (findCurrentMaHS ở utils.js cắt còn "17-0681" nên không dùng lại được).
// Lấy từ phần tử ĐANG HIỆN, ưu tiên phần tử cuối trong DOM - tiêu đề form đang mở nằm sau bảng
// danh sách công việc, nên cái cuối là hồ sơ đang xem.
function layMaHoSoDayDu() {
    const nodes = Array.from(document.querySelectorAll('b, span, h4, .modal-title, div[title]'));
    let found = '';
    for (const node of nodes) {
        const text = (node.textContent || '').trim();
        if (!text || text.length > 200) continue;
        const m = MA_HS_RE.exec(text);
        if (m && dangHien(node)) found = m[0].toUpperCase();
    }
    return found;
}

// Các dòng "Giấy in mới" đang hiện, kèm Số phát hành đọc được trong dòng đó.
function layDongGiayInMoi() {
    return Array.from(document.querySelectorAll('tr'))
        .map(tr => {
            const cells = Array.from(tr.querySelectorAll('td'));
            if (!cells.length) return null;
            if (!GIAY_IN_MOI_RE.test(cells[0].textContent || '')) return null;

            // Số phát hành: ô đầu tiên trong dòng khớp dạng "AA 09122325". Không bám cứng cột 3
            // vì cổng hay thêm/bớt cột.
            for (const td of cells) {
                const m = SPH_RE.exec((td.textContent || '').trim().toUpperCase());
                if (m) return { tr, cells, sph: m[1] + ' ' + m[2] };
            }
            return null;
        })
        .filter(r => r && dangHien(r.tr));
}

function baoNhanh(text, mau) {
    let el = document.getElementById('mplis-tenfile-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mplis-tenfile-toast';
        el.style.cssText = 'position:fixed; left:50%; bottom:28px; transform:translateX(-50%);'
            + ' z-index:999999999; max-width:min(560px, calc(100vw - 32px)); padding:10px 14px;'
            + ' border-radius:10px; font:600 13px "Segoe UI", sans-serif; color:#fff;'
            + ' box-shadow:0 10px 28px rgba(0,0,0,0.45); pointer-events:none;'
            + ' opacity:0; transition:opacity 0.15s ease;';
        document.body.appendChild(el);
    }
    el.style.background = mau;
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(el._an);
    el._an = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

function copyChuoi(ten, ghiChu) {
    fallbackCopyTextToClipboard(ten).then(() => {
        console.log('[MPLIS TenFile] Đã copy tên file:', ten, ghiChu || '');
        baoNhanh('Đã copy: ' + ten + (ghiChu ? '  (' + ghiChu + ')' : ''), '#047857');
    }).catch(err => {
        console.log('[MPLIS TenFile] Lỗi copy:', err);
        baoNhanh('Lỗi copy, xem console', '#b91c1c');
    });
}

function copyTen(sph) {
    const maHS = layMaHoSoDayDu();
    if (!maHS) {
        console.log('[MPLIS TenFile] Có Số phát hành "' + sph + '" nhưng không thấy mã hồ sơ đầy đủ'
            + ' trên trang (dạng H15.50.05.12-260917-0681). Chỉ copy Số phát hành.');
        fallbackCopyTextToClipboard(sph + DUOI);
        baoNhanh('Không thấy mã hồ sơ, đã copy: ' + sph + DUOI, '#b45309');
        return;
    }
    copyChuoi(maHS + '-' + sph + DUOI, 'giấy chứng nhận - TÍCH ô đồng bộ một cửa');
}

// Tên giấy tờ kèm: không cần Số phát hành, chỉ cần mã hồ sơ, nên dùng được ở cả màn hình
// "Danh sách giấy tờ đính kèm hồ sơ".
function copyTenGiayToKem() {
    const maHS = layMaHoSoDayDu();
    const hauTo = layHauTo();
    if (!maHS) {
        console.log('[MPLIS TenFile] Không thấy mã hồ sơ đầy đủ trên trang, không ghép được tên'
            + ' giấy tờ kèm (<mã hồ sơ>-' + hauTo + DUOI + ').');
        baoNhanh('Không thấy mã hồ sơ trên trang', '#b91c1c');
        return;
    }
    copyChuoi(maHS + '-' + hauTo + DUOI, 'giấy tờ kèm - KHÔNG tích ô đồng bộ');
}

// Số phát hành chỉ hiện ở màn hình Cập nhật pháp lý; sang màn hình giấy tờ đính kèm là mất.
// Nên thấy lúc nào thì nhớ lại theo mã hồ sơ, để bên kia vẫn ghép được tên giấy chứng nhận.
const SPH_NHO_KEY = 'mplis_tenfile_sph_theo_hoso';

function nhoSph(maHS, sphList) {
    if (!maHS || !sphList.length) return;
    try {
        const stored = JSON.parse(localStorage.getItem(SPH_NHO_KEY) || '{}');
        if (JSON.stringify(stored[maHS]) === JSON.stringify(sphList)) return;
        stored[maHS] = sphList;
        localStorage.setItem(SPH_NHO_KEY, JSON.stringify(stored));
    } catch (e) { }
}

// Hồ sơ thế chấp không đi qua màn hình "Cập nhật giấy chứng nhận" nên không có Số phát hành;
// người dùng tự gõ số BN (VD "BN 600374"). Gõ 1 lần rồi nhớ luôn vào chung kho với Số phát hành,
// lần sau mở lại hồ sơ đó là có sẵn nút.
function themSphTay(maHS, sph) {
    if (!maHS || !sph) return [];
    const ds = doclaiSph(maHS);
    if (!ds.includes(sph)) ds.push(sph);
    nhoSph(maHS, ds);
    return ds;
}

// Gõ nhầm số (VD "BN 60374" thiếu số) thì phải xoá được, không thì nút sai nằm đó mãi.
// Chỉ xoá trong kho nhớ CỦA TOOL - dòng đã tạo trong bảng vẫn còn, xoá bằng nút "Xóa" của cổng.
function xoaSphNho(maHS, sph) {
    const ds = doclaiSph(maHS).filter(x => x !== sph);
    try {
        const stored = JSON.parse(localStorage.getItem(SPH_NHO_KEY) || '{}');
        if (ds.length) stored[maHS] = ds; else delete stored[maHS];
        localStorage.setItem(SPH_NHO_KEY, JSON.stringify(stored));
    } catch (e) { }
    console.log('[MPLIS TenFile] Đã xoá "' + sph + '" khỏi danh sách nhớ của hồ sơ ' + maHS
        + '. Dòng đã tạo trong bảng (nếu có) KHÔNG bị xoá.');
    baoNhanh('Đã xoá số ' + sph + ' khỏi danh sách nhớ', '#b45309');
    const cu = document.getElementById(THANH_NUT_ID);
    if (cu) cu.remove();
}

function doclaiSph(maHS) {
    if (!maHS) return [];
    try {
        const stored = JSON.parse(localStorage.getItem(SPH_NHO_KEY) || '{}');
        return Array.isArray(stored[maHS]) ? stored[maHS] : [];
    } catch (e) { return []; }
}

// Ô "Tên tài liệu muốn thêm" + nút "+" ở đầu bảng giấy tờ đính kèm: gõ tên rồi bấm "+" thì
// cổng mới tạo ra dòng, có dòng mới có ô tích "Giấy tờ gửi về một cửa". Nên tool điền hộ ô này
// rồi bấm "+", xong vòng quét sau tuTichDongBo() tích/bỏ tích theo tên.
const O_TEN_SELECTOR = 'input[placeholder*="tên tài liệu" i], input[placeholder*="Tên tài liệu" i]';

function timODienTen() {
    return Array.from(document.querySelectorAll(O_TEN_SELECTOR)).find(dangHien) || null;
}

// Nút "+" nằm cạnh ô nhập (thường trong cùng .input-group). Lấy nút gần nhất bên phải ô.
function timNutThem(o) {
    const khung = o.closest('.input-group, .form-group, div') || o.parentElement;
    if (!khung) return null;
    const nut = Array.from(khung.querySelectorAll('button, a.btn, span.input-group-addon'))
        .filter(dangHien)
        .filter(b => !b.closest('#' + THANH_NUT_ID));
    if (!nut.length) return null;
    // CHỈ nhận nút có dấu + hoặc icon plus. Không thấy thì trả null để dừng hẳn - thà không tạo
    // được dòng còn hơn bấm nhầm nút khác trên form thật (VD "Đóng", "Ký số").
    return nut.find(b => /^\+?$/.test((b.textContent || '').trim())
        && (/\+/.test(b.textContent || '') || b.querySelector('.fa-plus, .glyphicon-plus')))
        || nut.find(b => b.querySelector('.fa-plus, .glyphicon-plus'))
        || null;
}

function daCoDong(ten) {
    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien);
    if (!bang) return false;
    const gon = ten.replace(/\s+/g, '').toUpperCase();
    return Array.from(bang.querySelectorAll('tbody tr'))
        .some(tr => (tr.textContent || '').replace(/\s+/g, '').toUpperCase().includes(gon));
}

function themDong(ten) {
    if (!ten) return;
    if (daCoDong(ten)) {
        console.log('[MPLIS TenFile] Bảng đã có dòng "' + ten + '" - không thêm nữa.');
        baoNhanh('Đã có dòng: ' + ten, '#b45309');
        return;
    }

    const o = timODienTen();
    const nut = o && timNutThem(o);
    if (!o || !nut) {
        console.log('[MPLIS TenFile] Không thấy ô "Tên tài liệu muốn thêm" hoặc nút "+" đang hiện.'
            + ' Ô tìm được: ' + (o ? 'có' : 'không') + ', nút: ' + (nut ? 'có' : 'không'));
        baoNhanh('Không thấy ô thêm tài liệu trên trang', '#b91c1c');
        return;
    }

    const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
    o.value = ten;
    if (jq) jq(o).val(ten).trigger('input').trigger('change');
    else {
        o.dispatchEvent(new Event('input', { bubbles: true }));
        o.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (jq) jq(nut).click(); else nut.click();

    console.log('[MPLIS TenFile] Đã điền "' + ten + '" và bấm "+" để tạo dòng.');
    baoNhanh('Đã tạo dòng: ' + ten, '#047857');
}

// Hồ sơ nhiều giấy chứng nhận: bấm "+" liên tiếp không được, mỗi lần bấm cổng gọi ajax dựng
// lại bảng. Nên thêm từng tên một, cách nhau THEM_DELAY_MS, và bỏ qua tên đã có trong bảng.
const THEM_DELAY_MS = 1200;

function themNhieuDong(dsTen) {
    const con = dsTen.filter(Boolean).filter(t => !daCoDong(t));
    if (!con.length) {
        console.log('[MPLIS TenFile] Mọi dòng cần thêm đều đã có trong bảng.');
        baoNhanh('Bảng đã có đủ các dòng', '#b45309');
        return;
    }
    console.log('[MPLIS TenFile] Thêm ' + con.length + ' dòng, cách nhau ' + THEM_DELAY_MS + 'ms: '
        + con.join(' | '));
    con.forEach((ten, i) => setTimeout(() => themDong(ten), i * THEM_DELAY_MS));
}

function tenGiayChungNhan(sph) {
    const maHS = layMaHoSoDayDu();
    return (maHS && sph) ? maHS + '-' + sph + DUOI : '';
}

function tenGiayToKem() {
    const maHS = layMaHoSoDayDu();
    return maHS ? maHS + '-' + layHauTo() + DUOI : '';
}

// Thêm dòng theo số người dùng tự gõ. Số dạng "BN 600374" (2 chữ cái + từ 6 số) khớp quy tắc
// tích ô gửi về một cửa, nên tool tích luôn; số dạng khác vẫn tạo được dòng nhưng tool KHÔNG
// tích, báo rõ để người dùng tự tích.
function themDongTay(raw, maHS) {
    const text = (raw || '').trim().toUpperCase();
    if (!text) {
        baoNhanh('Chưa gõ số nào', '#b45309');
        return;
    }
    if (!maHS) {
        baoNhanh('Không thấy mã hồ sơ trên trang', '#b91c1c');
        return;
    }

    const m = SPH_RE.exec(text);
    const sph = m ? m[1] + ' ' + m[2] : text;
    const ten = maHS + '-' + sph + DUOI;

    if (m) {
        themSphTay(maHS, sph);
    } else {
        console.log('[MPLIS TenFile] Số tự nhập "' + text + '" không đúng dạng "2 chữ cái + số"'
            + ' nên tool sẽ KHÔNG tự tích ô gửi về một cửa cho dòng này.');
        baoNhanh('Tạo dòng nhưng không tự tích ô một cửa (số không đúng dạng)', '#b45309');
    }
    themDong(ten);
}

// Thanh nút trên bảng "Danh sách giấy tờ đính kèm hồ sơ": 1 nút tên giấy chứng nhận (lấy Số
// phát hành đã nhớ), 1 nút tên giấy tờ kèm theo hậu tố đang đặt, kèm dòng nhắc tích/không tích
// ô đồng bộ về một cửa.
function ganThanhNut() {
    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien);
    const cu = document.getElementById(THANH_NUT_ID);
    if (!bang) {
        if (cu) cu.remove();
        return;
    }

    const maHS = layMaHoSoDayDu();
    // "tren" = số đang đọc được ngay trên màn hình; "nho" = số đã lưu (gồm cả số gõ tay).
    const tren = layDongGiayInMoi().map(d => d.sph);
    // Hồ sơ nhiều giấy chứng nhận: lấy HẾT số phát hành, không chỉ cái đầu. Gộp danh sách đang
    // hiện với danh sách đã nhớ, bỏ trùng.
    const sphList = Array.from(new Set(tren.concat(doclaiSph(maHS))));
    const hauTo = layHauTo();

    const dauTay = sphList.join(',');
    if (cu && cu._sph === dauTay && cu._hauTo === hauTo && cu.parentElement) return;
    // Đang gõ dở trong ô nhập tay thì khoan dựng lại thanh nút, không là mất chữ đang gõ.
    if (cu && cu.contains(document.activeElement)) return;
    if (cu) cu.remove();

    const thanh = document.createElement('div');
    thanh.id = THANH_NUT_ID;
    thanh._sph = dauTay;
    thanh._hauTo = hauTo;
    // Hồ sơ nhiều giấy chứng nhận thì nút xuống hàng; kẹp chiều cao ~2 hàng rồi cho cuộn dọc
    // bên trong, để thanh nút không đẩy cả bảng giấy tờ xuống dưới màn hình.
    thanh.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:6px;'
        + ' margin:8px 0; padding:7px 9px; background:#eef2ff; border:1px solid #c7d2fe;'
        + ' border-radius:8px; font:12px "Segoe UI", sans-serif; color:#1e293b;'
        + ' max-height:84px; overflow-y:auto;';

    const themNut = (chu, mau, title, onClick, tat, hep) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = chu;
        b.title = title;
        b.disabled = !!tat;
        b.style.cssText = 'min-height:30px; padding:' + (hep ? '5px 8px' : '5px 11px') + ';'
            + ' font:600 12px "Segoe UI", sans-serif;'
            + ' color:#fff; background:' + mau + '; border:none; border-radius:6px;'
            + ' cursor:' + (tat ? 'not-allowed' : 'pointer') + '; opacity:' + (tat ? '0.5' : '1') + ';';
        if (!tat) {
            b.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            };
        }
        thanh.appendChild(b);
    };

    if (!sphList.length) {
        themNut('+ Dòng giấy chứng nhận (chưa có Số phát hành)', '#4f46e5',
            'Chưa biết Số phát hành. Mở màn hình Cập nhật pháp lý giấy chứng nhận một lần để tool nhớ.',
            () => { }, true);
    } else if (sphList.length > 1) {
        themNut('+ Tất cả (' + sphList.length + ')', '#4f46e5',
            'Tạo lần lượt ' + sphList.length + ' dòng: ' + sphList.map(x => maHS + '-' + x + DUOI).join(', '),
            () => themNhieuDong(sphList.map(tenGiayChungNhan)), !maHS);
    }

    // Mỗi số phát hành 1 cặp nút: tạo dòng (có chữ) + copy tên (chỉ icon cho đỡ chiếm chỗ).
    for (const sph of sphList) {
        themNut('+ ' + sph, '#4f46e5',
            'Tạo dòng "' + (maHS || '<mã hồ sơ>') + '-' + sph + DUOI + '" rồi tích ô gửi về một cửa.',
            () => themDong(tenGiayChungNhan(sph)), !maHS);
        themNut('⧉', '#475569',
            'Copy "' + (maHS || '<mã hồ sơ>') + '-' + sph + DUOI + '" để đổi tên file quét trên máy.',
            () => copyTen(sph), false, true);
        // Số đang hiện trên màn hình thì không cho xoá - quét lại là nó về ngay, xoá chẳng để làm gì.
        if (!tren.includes(sph)) {
            themNut('✕', '#b91c1c',
                'Xoá "' + sph + '" khỏi danh sách nhớ của tool (gõ nhầm thì xoá ở đây).'
                + ' KHÔNG xoá dòng đã tạo trong bảng - dòng đó xoá bằng nút "Xóa" màu đỏ của cổng.',
                () => xoaSphNho(maHS, sph), !maHS, true);
        }
    }

    themNut('+ ' + hauTo, '#0f766e',
        'Tạo dòng "' + (maHS || '<mã hồ sơ>') + '-' + hauTo + DUOI + '", KHÔNG tích ô gửi về một cửa.'
        + ' Đổi GT/PT trong tab Cài đặt của tool.',
        () => themDong(tenGiayToKem()), !maHS);
    themNut('⧉', '#475569',
        'Copy "' + (maHS || '<mã hồ sơ>') + '-' + hauTo + DUOI + '" để đổi tên file quét trên máy.',
        copyTenGiayToKem, false, true);

    // Ô nhập tay: thế chấp (số BN) hoặc hồ sơ nào đó tool chưa đọc được Số phát hành.
    const o = document.createElement('input');
    o.type = 'text';
    o.id = 'mplis-tenfile-input-tay';
    o.placeholder = 'Số tự nhập, VD: BN 600374';
    o.title = 'Gõ số rồi bấm "+ Thêm": tạo dòng "' + (maHS || '<mã hồ sơ>') + '-<số>' + DUOI + '"';
    o.style.cssText = 'min-height:30px; width:150px; padding:4px 8px; font:12px "Segoe UI", sans-serif;'
        + ' color:#1e293b; background:#fff; border:1px solid #c7d2fe; border-radius:6px;';
    // Enter trong ô này là thêm dòng luôn, khỏi rê chuột sang nút.
    o.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            themDongTay(o.value, maHS);
        }
    };
    thanh.appendChild(o);

    themNut('+', '#7c3aed',
        'Tạo dòng theo số vừa gõ. Số dạng "BN 600374" thì tool tích luôn ô gửi về một cửa.',
        () => themDongTay(o.value, maHS), !maHS);

    const nhac = document.createElement('span');
    nhac.style.cssText = 'margin-left:auto; font-size:11px; color:#475569; white-space:nowrap;';
    nhac.title = 'Dòng tên theo Số phát hành thì tool tích ô "Giấy tờ gửi về một cửa";'
        + ' dòng ' + hauTo + ' thì bỏ tích.';
    nhac.textContent = sphList.length + ' GCN · tích một cửa | ' + hauTo + ' · không tích';
    thanh.appendChild(nhac);

    const noi = bang.parentElement || bang;
    noi.insertBefore(thanh, bang);
}

// Tích/bỏ tích ô "Giấy tờ gửi về một cửa" theo TÊN FILE trên từng dòng của bảng giấy tờ đính kèm:
//   <mã hồ sơ>-AA 09122314.pdf  (hậu tố là Số phát hành) -> tích
//   <mã hồ sơ>-GT.pdf / -PT.pdf                          -> bỏ tích
// Mỗi dòng có 2 ô tích: cột đầu là ô chọn dòng, cột "Giấy tờ gửi về một cửa" mới là ô cần đụng.
// Nên định vị theo CHỈ SỐ CỘT đọc từ hàng tiêu đề, không lấy bừa ô tích đầu tiên trong dòng.
// Không tìm được cột đó thì KHÔNG đụng gì, chỉ ghi log - tích nhầm ô là hồ sơ đồng bộ lệch.
const COT_MOT_CUA_RE = /một cửa/i;
const COT_TEN_RE = /tên giấy tờ/i;
// "...-AA 09122314.pdf": hậu tố là Số phát hành -> dòng giấy chứng nhận.
const TEN_GCN_RE = /-[A-Z]{2}\s*\d{6,}\.PDF$/;
// "...-GT.pdf" / "...-PT.pdf" -> dòng giấy tờ kèm.
const TEN_KEM_RE = /-(GT|PT)\.PDF$/;

function layChiSoCot(hang, re) {
    if (!hang) return -1;
    const o = Array.from(hang.children);
    for (let i = 0; i < o.length; i++) {
        if (re.test((o[i].textContent || '').trim())) return i;
    }
    return -1;
}

// Ô tích "Giấy tờ gửi về một cửa" trong 1 dòng.
// Hàng tiêu đề và hàng dữ liệu KHÔNG cùng số ô: dòng dữ liệu có thêm ô menu "⋮" nên chỉ số cột
// đọc từ tiêu đề bị lệch, lấy theo chỉ số là trúng cột "Đã ký số" (không có ô tích) rồi im lặng
// bỏ qua. Nên thử theo thứ tự:
//   1. Ô tích nằm đúng cột tiêu đề "một cửa" (khi 2 hàng khớp số ô).
//   2. Lệch ô: bù chênh lệch số ô giữa hàng dữ liệu và hàng tiêu đề.
//   3. Còn lại: bỏ ô tích ở cột đầu (ô chọn dòng), còn đúng 1 ô thì lấy ô đó.
// Cả 3 cách đều trượt thì trả null kèm lý do để ghi log, không đoán tiếp.
function timOMotCua(tr, cotMotCua, soOTieuDe) {
    const o = Array.from(tr.children);
    const layTrongO = (idx) => {
        const cell = idx >= 0 ? o[idx] : null;
        return cell ? cell.querySelector('input[type="checkbox"]') : null;
    };

    let cb = layTrongO(cotMotCua);
    if (cb) return { cb, cach: 'đúng chỉ số cột tiêu đề' };

    const lech = o.length - soOTieuDe;
    if (lech > 0) {
        cb = layTrongO(cotMotCua + lech);
        if (cb) return { cb, cach: 'bù lệch ' + lech + ' ô so với tiêu đề' };
    }

    const tatCa = Array.from(tr.querySelectorAll('input[type="checkbox"]'));
    const conLai = tatCa.filter(x => x.closest('td') !== o[0] && x.closest('th') !== o[0]);
    if (conLai.length === 1) return { cb: conLai[0], cach: 'ô tích duy nhất ngoài cột chọn dòng' };

    return {
        cb: null,
        cach: 'không xác định được (dòng có ' + o.length + ' ô, tiêu đề ' + soOTieuDe
            + ' ô, ' + tatCa.length + ' ô tích)'
    };
}

let _daLogThieuCot = false;
let _daLogBang = '';

function tuTichDongBo() {
    if (!tuTichBat()) return;

    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien);
    if (!bang) return;

    const hangTieuDe = bang.querySelector('thead tr') || bang.querySelector('tr');
    const soOTieuDe = hangTieuDe ? hangTieuDe.children.length : 0;
    const cotMotCua = layChiSoCot(hangTieuDe, COT_MOT_CUA_RE);
    const cotTen = layChiSoCot(hangTieuDe, COT_TEN_RE);

    if (cotMotCua < 0) {
        if (!_daLogThieuCot) {
            console.log('[MPLIS TenFile] Không thấy cột "một cửa" trong bảng giấy tờ đính kèm nên'
                + ' KHÔNG tích gì. Tiêu đề các cột đang có: '
                + (hangTieuDe ? Array.from(hangTieuDe.children).map(x => (x.textContent || '').trim() || '(trống)').join(' | ') : '(không đọc được)'));
            _daLogThieuCot = true;
        }
        return;
    }
    _daLogThieuCot = false;

    const dauBang = (bang.id || '') + '#' + cotMotCua + '#' + soOTieuDe;
    if (_daLogBang !== dauBang) {
        _daLogBang = dauBang;
        console.log('[MPLIS TenFile] Bảng "' + (bang.id || '(không id)') + '": cột "một cửa" ở vị trí '
            + cotMotCua + ', cột "tên giấy tờ" ở vị trí ' + cotTen + ', tiêu đề ' + soOTieuDe + ' ô.');
    }

    for (const tr of Array.from(bang.querySelectorAll('tbody tr'))) {
        if (!dangHien(tr)) continue;

        const o = Array.from(tr.children);
        // Cột tên cũng lệch như cột một cửa, nên dò cả 2 vị trí rồi lấy ô nào ra tên file .pdf.
        const lech = Math.max(0, o.length - soOTieuDe);
        const ungVienTen = [o[cotTen], o[cotTen + lech]].filter(Boolean);
        const ten = (ungVienTen.map(x => (x.textContent || '').replace(/\s+/g, ' ').trim())
            .find(t => /\.PDF$/i.test(t)) || (tr.textContent || '').replace(/\s+/g, ' ').trim());
        const tenGon = ten.replace(/\s+/g, '').toUpperCase();

        const laGcn = TEN_GCN_RE.test(tenGon);
        const laKem = TEN_KEM_RE.test(tenGon);
        if (!laGcn && !laKem) continue;

        const { cb, cach } = timOMotCua(tr, cotMotCua, soOTieuDe);
        if (!cb) {
            if (tr.getAttribute(DA_TICH_ATTR) !== 'bo-qua') {
                tr.setAttribute(DA_TICH_ATTR, 'bo-qua');
                console.log('[MPLIS TenFile] Dòng "' + ten + '": không tìm được ô "gửi về một cửa" - '
                    + cach + '. Không đụng gì.');
            }
            continue;
        }

        const muon = laGcn;
        // Đụng mỗi dòng 1 lần cho mỗi trạng thái: người dùng sửa lại bằng tay thì tool để yên.
        if (tr.getAttribute(DA_TICH_ATTR) === (muon ? 'tich' : 'bo-tich')) continue;
        tr.setAttribute(DA_TICH_ATTR, muon ? 'tich' : 'bo-tich');
        if (cb.checked === muon) continue;

        const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
        if (jq) jq(cb).click(); else cb.click();
        console.log('[MPLIS TenFile] ' + (muon ? 'Đã TÍCH' : 'Đã BỎ TÍCH') + ' ô "gửi về một cửa" cho: '
            + ten + ' (tìm ô theo: ' + cach + ')');
    }
}

function ganNut() {
    const dong = layDongGiayInMoi();
    if (dong.length) nhoSph(layMaHoSoDayDu(), dong.map(d => d.sph));
    for (const d of dong) {
        if (d.tr.querySelector('.' + BTN_CLASS)) continue;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BTN_CLASS;
        btn.setAttribute(BTN_MARK, d.sph);
        btn.textContent = 'Copy tên file';
        btn.title = 'Copy "<mã hồ sơ>-' + d.sph + DUOI + '" để đổi tên file quét';
        btn.style.cssText = 'margin-left:6px; padding:3px 8px; font:600 11px "Segoe UI", sans-serif;'
            + ' color:#fff; background:#4f46e5; border:none; border-radius:5px; cursor:pointer;';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyTen(d.sph);
        };
        d.cells[d.cells.length - 1].appendChild(btn);
    }
}

let _thieuDaLog = false;

setInterval(() => {
    try {
        ganNut();
        ganThanhNut();
        tuTichDongBo();
    } catch (e) {
        console.error('[MPLIS TenFile] Lỗi:', e);
    }
}, SCAN_INTERVAL_MS);

// Alt + D: copy tên của giấy in mới ĐẦU TIÊN - hồ sơ 1 giấy (phần lớn) thì khỏi rê chuột.
window.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'd' && e.key !== 'D')) return;
    e.preventDefault();

    const dong = layDongGiayInMoi();
    if (!dong.length) {
        if (!_thieuDaLog) {
            console.log('[MPLIS TenFile] Không thấy dòng "Giấy in mới" nào đang hiện. Mở màn hình'
                + ' "Cập nhật pháp lý giấy chứng nhận" (sau bước 1) rồi bấm lại Alt+D.');
            _thieuDaLog = true;
        }
        baoNhanh('Không thấy giấy in mới trên trang', '#b91c1c');
        return;
    }
    _thieuDaLog = false;
    copyTen(dong[0].sph);
    if (dong.length > 1) {
        console.log('[MPLIS TenFile] Hồ sơ có ' + dong.length + ' giấy in mới ('
            + dong.map(d => d.sph).join(', ') + '). Alt+D lấy giấy đầu; giấy còn lại bấm nút'
            + ' "Copy tên file" ngay trên dòng của nó.');
        baoNhanh('Có ' + dong.length + ' giấy in mới - đã copy giấy đầu, giấy khác bấm nút trên dòng', '#b45309');
    }
});

// Alt + G: copy tên giấy tờ kèm (<mã hồ sơ>-GT.pdf hoặc -PT.pdf theo Cài đặt).
window.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'g' && e.key !== 'G')) return;
    e.preventDefault();
    copyTenGiayToKem();
});
