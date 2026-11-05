/* globals unsafeWindow, GM_setClipboard */
import { escapeHtml } from './utils.js';

const MAX_RESULTS = 30;

function parseAspNetDate(str) {
    const m = (str || '').match(/\/Date\((\d+)\)\//);
    if (!m) return '';
    const d = new Date(parseInt(m[1], 10));
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildPattern(raw) {
    const q = (raw || '').trim();
    if (!q) return '';
    return q.startsWith('%') ? q : '%' + q;
}

function search(pattern) {
    return new Promise((resolve, reject) => {
        const jq = typeof unsafeWindow !== 'undefined' && unsafeWindow.$ ? unsafeWindow.$ : null;
        if (!jq || !jq.ajax) { reject(new Error('Trang chưa sẵn sàng (không có jQuery)')); return; }
        jq.ajax({
            url: 'https://dla.mplis.gov.vn/dc/DangKyAjax/AdvancedSearchHoSoTiepNhan',
            method: 'POST',
            data: {
                start: 0,
                length: MAX_RESULTS,
                'model[tinhId]': 66,
                'model[huyenId]': 650,
                'model[xaId]': '',
                'model[quytrinh]': '',
                'model[state]': '',
                'model[soBienNhan]': pattern,
                'model[laHoSoMotCua]': false,
                'model[tiepNhanTuNgay]': '',
                'model[tiepNhanDenNgay]': '',
                'model[henTraTuNgay]': '',
                'model[henTraDenNgay]': '',
                'model[trangThaiHoSo]': 0,
                'model[trangThaiKetISO][]': 0,
                'model[diaChiTaiSan]': '',
                'model[soThua]': '',
                'model[soTo]': '',
                'model[diaChi]': '',
                'model[hoTen]': '',
                'model[soDienThoai]': '',
                'model[giayChungMinh]': '',
                'model[daXuLy]': -1
            }
        }).done((json) => resolve(json && Array.isArray(json.data) ? json.data : []))
          .fail((xhr) => reject(new Error('Lỗi ' + xhr.status)));
    });
}

function chip(text, cls) {
    return `<span class="mplis-chip ${cls || ''}">${escapeHtml(text)}</span>`;
}

function pickField(obj, regex) {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of Object.keys(obj)) {
        if (!regex.test(k)) continue;
        const v = obj[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number') return String(v);
    }
    return '';
}

function findDeep(obj, regex, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 4) return '';
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (regex.test(k) && typeof v === 'string' && v.trim()) return v.trim();
    }
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object') {
            const found = findDeep(v, regex, depth + 1);
            if (found) return found;
        }
    }
    return '';
}

function extractApplicant(item) {
    const n = item.nguoiNopDon || {};
    const hoTen = pickField(n, /^(hoTen|hovaten|tenNguoiNop|tenNguoiNopDon|ten)$/i) || pickField(n, /ten/i);
    const soGiayTo = pickField(n, /(giayChungMinh|soGiayTo|cmnd|cccd|cmt|dinhDanh|soGiay)/i);
    const sdt = pickField(n, /(dienThoai|sdt|phone)/i);
    const diaChi = pickField(n, /^(diaChi|diaChiThuongTru|diaChiLienHe|diaChiNguoiNop)$/i) || pickField(n, /diaChi/i);
    const wardMatch = diaChi.match(/(Xã|Phường|Thị trấn)\s+[^,]+/i);
    const taiSanMatch = String(item.diaChiTaiSan || '').match(/(Xã|Phường|Thị trấn)\s+[^,]+/i);
    const phuongXa = (taiSanMatch ? taiSanMatch[0].trim() : '')
        || findDeep(item, /^(phuongXa|tenPhuongXa)$/i)
        || (wardMatch ? wardMatch[0].trim() : '');
    if (!hoTen || !soGiayTo || !sdt) {
        try { console.log('[MPLIS Lookup] Thiếu thông tin người nộp, nguoiNopDon =', JSON.stringify(item.nguoiNopDon)); } catch (e) { }
    }
    return { hoTen, soGiayTo, sdt, phuongXa };
}

function renderCard(item) {
    const state = (item.state && item.state.Title) || 'Đang xử lý';
    const chips = [];
    if (item.daTra) chips.push(chip('Đã trả ' + parseAspNetDate(item.ngayTra), 'good'));
    if (item.daKetISO) chips.push(chip('Đã kết ISO', 'info'));
    if (item.daCapNhatDuLieuPhapLy) chips.push(chip('Đã cập nhật pháp lý', 'info'));
    if (item.choBoSung) chips.push(chip('Chờ bổ sung', 'warn'));

    const docs = Array.isArray(item.giayToDinhKem) ? item.giayToDinhKem : [];
    const docHtml = docs.length
        ? docs.map((g) => {
            const ten = escapeHtml(g.tenGiayTo || g.Title || '(không tên)');
            const label = g.tepDinhKem
                ? `<a class="mplis-lk-doc" href="https://dla.mplis.gov.vn/dc/PdfViewer?fileId=${encodeURIComponent(g.tepDinhKem)}" target="_blank" rel="noopener" title="Mở file trong tab mới">${ten}</a>`
                : ten;
            return `<li>${label}${g.laGiayToKySo ? ' ' + chip('ký số', 'good') : ''}</li>`;
        }).join('')
        : '<li class="mplis-dim">Chưa có giấy tờ đính kèm</li>';

    const row = (label, val) => `<div class="mplis-lk-row"><span>${label}</span><b>${escapeHtml(val || '—')}</b></div>`;
    const hen = parseAspNetDate(item.ngayhenTra);
    const ap = extractApplicant(item);

    return `
        <div class="mplis-card mplis-lk-card">
            <div class="mplis-lk-head">
                <button type="button" class="mplis-lk-code" data-copy="${escapeHtml(item.soBienNhan)}" title="Bấm để copy mã hồ sơ">${escapeHtml(item.soBienNhan)}</button>
            </div>
            <div class="mplis-lk-state">${escapeHtml(state)}</div>
            <div class="mplis-lk-chips">${chips.join('')}</div>
            ${row('Người đang xử lý', item.tenNguoiTiepNhan)}
            ${row('Người chuyển tiếp', item.tenNguoiChuyenTiep)}
            ${hen ? row('Hẹn trả', hen) : ''}
            <div class="mplis-lk-docs-title">Thông tin người nộp đơn</div>
            ${row('Người nộp hồ sơ', ap.hoTen)}
            ${row('Số giấy tờ', ap.soGiayTo)}
            ${row('Số điện thoại', ap.sdt)}
            ${row('Phường/Xã', ap.phuongXa)}
            <div class="mplis-lk-docs-title">Giấy tờ đính kèm (${docs.length})</div>
            <ul class="mplis-lk-docs">${docHtml}</ul>
        </div>`;
}

function copyText(text) {
    try { GM_setClipboard(text); } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
}

const LookupModule = {
    init() {
        const input = document.getElementById('lookup-input');
        const btn = document.getElementById('btn-lookup');
        const out = document.getElementById('lookup-results');
        const info = document.getElementById('lookup-info');
        if (!input || !btn || !out || !info) return;

        let seq = 0;
        const run = async () => {
            const pattern = buildPattern(input.value);
            if (!pattern) { info.textContent = 'Nhập một phần mã hồ sơ, ví dụ 0402 hoặc 9-0402.'; out.innerHTML = ''; return; }
            const mine = ++seq;
            info.textContent = 'Đang tìm...';
            btn.disabled = true;
            try {
                const items = await search(pattern);
                if (mine !== seq) return;
                info.textContent = items.length ? `Tìm thấy ${items.length} hồ sơ` + (items.length >= MAX_RESULTS ? ' (hiện tối đa ' + MAX_RESULTS + ')' : '') : 'Không tìm thấy hồ sơ nào.';
                out.innerHTML = items.map(renderCard).join('');
            } catch (e) {
                if (mine !== seq) return;
                info.textContent = 'Lỗi: ' + e.message;
                out.innerHTML = '';
            } finally {
                if (mine === seq) btn.disabled = false;
            }
        };

        btn.onclick = run;
        input.onkeydown = (e) => { if (e.key === 'Enter') run(); };
        out.onclick = (e) => {
            const b = e.target.closest('[data-copy]');
            if (!b) return;
            copyText(b.dataset.copy);
            const old = b.textContent;
            b.textContent = 'Đã copy!';
            setTimeout(() => { b.textContent = old; }, 1200);
        };
    }
};

// Tên người nộp của 1 hồ sơ theo mã đầy đủ (dùng cho tin Telegram). Lỗi/không thấy thì trả chuỗi rỗng.
async function tenNguoiNop(maDayDu) {
    const items = await search(buildPattern(maDayDu));
    const it = items.find((x) => x.soBienNhan === maDayDu) || items[0];
    return it ? extractApplicant(it).hoTen : '';
}

// Tra theo đuôi mã hồ sơ (dùng cho bot Telegram): trả về danh sách hồ sơ khớp, tối đa MAX_RESULTS.
async function traCuuHoSo(raw) {
    return search(buildPattern(raw));
}

export { LookupModule, tenNguoiNop, traCuuHoSo, extractApplicant, parseAspNetDate };
