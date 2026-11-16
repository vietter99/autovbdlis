import { MA_HS_SRC } from './ma-ho-so.js';

// So tên không phân biệt hoa/thường, bỏ ".pdf", dấu chấm, dấu cách → "H15.50-1" == "h15 50-1.PDF".
const chuan = (s) => String(s || '').toUpperCase().replace(/\.PDF$/, '').replace(/[.\s ]/g, '');
const MA_RE = new RegExp(MA_HS_SRC);

// Chọn file scan cho 1 dòng upload. Nguyên tắc: chỉ trả file chắc chắn đúng; mơ hồ → soTrung>0, không có → file=null.
// Không bao giờ lấy file GT/PT của hồ sơ khác hay file GCN của số phát hành khác để "đỡ phải upload tay".
//   rowText  : chữ trong dòng upload (viết HOA)       fileType: 'GCN' | 'GT' | 'PT'
//   suffix   : n số cuối SPH của dòng                 sphNum  : toàn bộ chữ số của SPH dòng này
//   sphList  : mọi SPH của hồ sơ                      soChuSo : 3 hoặc 4
export function chonFile(files, { rowText, fileType, suffix, sphNum, sphList = [], soChuSo }) {
    let soTrung = 0;
    const duNhat = (ds) => { if (ds.length > 1) soTrung = ds.length; return ds.length === 1 ? ds[0] : null; };
    const ten = (f) => f.name.toUpperCase();

    const khopGcn = (sfx) => files.filter(f => {
        const n = ten(f);
        if (/(GT|PT)\.PDF$/.test(n)) return false;
        if (n.endsWith(sfx + '.PDF') || n.endsWith(sfx + '+.PDF')) return true;
        // File gộp nhiều mã: "1423+1422+.pdf" → tách theo "+", kiểm tra từng phần
        return n.replace(/\.PDF$/, '').split('+').some(p => p && p.endsWith(sfx));
    });

    // GCN của chính dòng này. Nhiều file cùng đuôi → thu hẹp bằng đủ số phát hành; vẫn còn nhiều → dừng.
    let gcnFile = null;
    if (suffix) {
        let ds = khopGcn(suffix);
        if (ds.length > 1 && sphNum) {
            const hep = ds.filter(f => chuan(f.name).replace(/\+$/, '').endsWith(sphNum));
            if (hep.length) ds = hep;
        }
        gcnFile = duNhat(ds);
    }
    if (soTrung) return { file: null, soTrung, warnSuffix: suffix };
    if (fileType === 'GCN') return { file: gcnFile, soTrung: 0, warnSuffix: suffix };

    // GT/PT: file GCN chỉ dùng để suy ra thư mục / tên gốc. Được phép lấy theo SPH khác của hồ sơ (không upload nó).
    let gcnRef = gcnFile;
    for (const sph of gcnRef ? [] : sphList) {
        const sfx2 = sph.replace(/[^0-9]/g, '').slice(-soChuSo);
        const ds = sfx2 && sfx2 !== suffix ? khopGcn(sfx2) : [];
        if (ds.length) { gcnRef = ds.find(f => f.name.includes('-')) || ds[0]; break; }
    }
    const gcnDir = gcnRef && gcnRef.webkitRelativePath ? gcnRef.webkitRelativePath.replace(/\/[^/]+$/, '') : null;
    // Base tên dài (chỉ khi có dấu "-", tránh nhầm tên ngắn "076+")
    const gcnBase = gcnRef && gcnRef.name.includes('-') ? gcnRef.name.replace(/-[^-]+\.pdf$/i, '') : null;

    const loai = fileType;
    const sfxM = rowText.match(new RegExp('\\b(\\d{3,}\\+?)-' + loai + '(?:\\.PDF)?(?![A-Z])', 'i'));
    const sfxFull = sfxM ? sfxM[1].toUpperCase() : null;
    const sfx = sfxFull ? sfxFull.replace(/\+$/, '').slice(-soChuSo) : null;
    // Tên đầy đủ cổng đang đòi (mã hồ sơ + -GT/-PT): khớp tên này là chắc nhất.
    const maM = rowText.match(new RegExp('(' + MA_HS_SRC + ')(\\+?)-' + loai + '(?![A-Z])', 'i'));
    const ma = maM ? chuan(maM[1]) : null;
    // File mang mã hồ sơ đầy đủ KHÁC mã đang xử lý là của hồ sơ khác (cùng 4 số cuối nhưng khác ngày).
    const hopLe = (f) => { const m = ten(f).match(MA_RE); return !m || !ma || chuan(m[0]) === ma; };
    const laLoai = (f) => ten(f).endsWith(loai + '.PDF');

    const buoc = [
        () => maM ? files.filter(f => chuan(f.name) === chuan(maM[1] + maM[2] + '-' + loai)) : [],
        () => sfxFull ? files.filter(f => hopLe(f) && ten(f).endsWith(sfxFull + '-' + loai + '.PDF')) : [],
        // Chế độ 4 số: file "<4 số mã hồ sơ>+.pdf" hoặc file gộp nhiều mã
        () => soChuSo === 4 && sfx ? files.filter(f => {
            const n = ten(f).replace(/\.PDF$/, '');
            return n.includes('+') && n.split('+').map(s => s.trim()).includes(sfx);
        }) : [],
        () => gcnBase ? files.filter(f => [chuan(gcnBase + '-' + loai), chuan(gcnBase + '+-' + loai)].includes(chuan(f.name))) : [],
        () => gcnDir ? files.filter(f => hopLe(f) && laLoai(f) && (f.webkitRelativePath || '').startsWith(gcnDir + '/')) : [],
        // Dòng không ghi sẵn tên GT/PT (chế độ 3 số): theo đuôi SPH của chính dòng này
        () => !sfxFull && soChuSo !== 4 && suffix
            ? files.filter(f => hopLe(f) && (ten(f).endsWith(suffix + '-' + loai + '.PDF') || ten(f).endsWith(suffix + '+-' + loai + '.PDF'))) : [],
        // File tổng hợp nhiều số có chứa mã này (VD 1387+1391+1392+.pdf), trừ khi GCN đã là file gộp riêng (bước dưới)
        () => sfx && !(gcnRef && gcnRef.name.includes('+')) ? files.filter(f => {
            const n = ten(f);
            return !/(GT|PT)\.PDF$/.test(n) && n.includes(sfx + '+') && f.name.split('+').length >= 3;
        }) : [],
    ];
    for (const b of buoc) {
        const f = duNhat(b());
        if (f) return { file: f, soTrung: 0, warnSuffix: sfxFull || sfx || suffix };
        if (soTrung) break;
    }
    // Không có file riêng → dùng GCN chỉ khi nó là file gộp nhiều số (có "+"); "5452.pdf" thì KHÔNG.
    const file = !soTrung && gcnRef && gcnRef.name.includes('+') ? gcnRef : null;
    return { file, soTrung, warnSuffix: sfxFull || sfx || suffix };
}
