// Dịch dòng log kỹ thuật (dùng để dò lỗi) sang câu người dùng bình thường đọc hiểu.
// - Dòng log GỐC vẫn được giữ nguyên trong bộ nhớ (nút "Copy log kỹ thuật" dùng bản gốc).
// - Hàm trả về: chuỗi (câu đã dịch) | null (ẩn khỏi nhật ký hiển thị vì chỉ là thao tác nhỏ/kỹ thuật).
// - Dòng cảnh báo/lỗi KHÔNG BAO GIỜ bị ẩn, dù quy tắc nào khớp.

const HIDE = null;

// Viết hoa chữ đầu, giữ nguyên các từ viết tắt thường gặp.
function viet(s) {
    let t = String(s || '').trim().toLowerCase();
    if (!t) return t;
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t.replace(/\biso\b/gi, 'ISO').replace(/\bqt(\d)\b/gi, 'QT$1');
}

const LOAI_FILE = {
    GCN: 'file giấy chứng nhận',
    PT: 'file phụ trang',
    GT: 'file giấy tờ kèm'
};

const TEN_BUOC_API = [
    [/KiemTraCapNhatDuLieuPhapLy/i, 'kiểm tra cập nhật dữ liệu pháp lý'],
    [/CapNhatDuLieuPhapLy/i, 'lưu dữ liệu pháp lý'],
    [/ThucHienKetISO/i, 'Kết ISO'],
    [/executeCommand/i, 'chuyển tiếp hồ sơ'],
    [/UpdateHoSoQuet/i, 'lưu kho hồ sơ quét']
];

function tenBuocTuApi(ep) {
    for (const [re, ten] of TEN_BUOC_API) if (re.test(ep)) return ten;
    return 'xử lý';
}

// Lấy lý do server trả về (nếu đọc được từ đoạn JSON đã cắt ngắn).
function lyDoTuServer(raw) {
    const t = String(raw || '');
    const m = /"noiDungNganChan":"([^"]+)"/.exec(t) || /"message":"([^"]+)"/.exec(t);
    return m ? m[1].replace(/\\r|\\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function gonTen(s) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > 70 ? t.slice(0, 67) + '...' : t;
}

// [mẫu khớp dòng gốc, kết quả]. Kết quả: chuỗi | hàm(m, text) | HIDE. Khớp mẫu đầu tiên.
const RULES = [
    // ---- Bắt đầu / kết thúc ----
    [/^Đã dừng hoạt động\.?$/, '⏸ Đã dừng theo yêu cầu'],
    [/^🎉 ĐÃ CHUYỂN TIẾP VÀ HOÀN THÀNH!?$/, '🎉 Xong hồ sơ: đã xử lý và chuyển tiếp'],
    [/^🎉 ĐÃ HOÀN THÀNH TẤT CẢ QUY TRÌNH!?$/, '🎉 Xong hồ sơ: đã làm hết các bước đã chọn'],
    [/^Hoàn tất chuyển tiếp và các quy trình/, HIDE],
    [/^Tất cả quy trình yêu cầu đã hoàn thành/, HIDE],
    [/^Tìm thấy nút 'Xử lý hồ sơ' ở trang chính/, 'Đang mở hồ sơ để xử lý...'],

    // ---- QT0: tệp đính kèm ----
    [/^Auto upload (GCN|GT|PT): (.+)$/i, (m) => 'Đang tải lên ' + (LOAI_FILE[m[1].toUpperCase()] || 'file') + ': ' + gonTen(m[2])],
    [/^Bấm 'Cập nhật' tệp đính kèm/, 'Đang lưu các file đính kèm vào hồ sơ...'],
    [/^API đã lưu tệp đính kèm/, '✅ Đã lưu xong file đính kèm'],
    [/^Bấm 'Đóng' bảng tệp đính kèm/, HIDE],
    [/^Bấm 'Xử lý hồ sơ' chuyển bước/, 'Chuyển sang bước xử lý các tác vụ'],
    [/^Bấm 'Xử lý tác vụ' cho: (.+?)\.{0,3}$/, (m) => '▶ Bắt đầu: ' + viet(m[1])],

    // ---- QT1: pháp lý ----
    [/^API DangKyAjax\/GetInfoCapNhatDuLieuPhapLy/, HIDE],
    [/^Tìm thấy nút 'Thực hiện'/, HIDE],
    [/^Phát hiện hộp thoại xác nhận cập nhật pháp lý/, 'Xác nhận cập nhật dữ liệu pháp lý...'],
    [/^API DangKyAjax\/KiemTraCapNhatDuLieuPhapLy/, (m, t) => /"success":true/.test(t) ? '✅ Hệ thống kiểm tra pháp lý: đạt' : HIDE],
    [/^API DangKyAjax\/CapNhatDuLieuPhapLy/, (m, t) => /"value":true/.test(t) ? '✅ Đã lưu dữ liệu pháp lý' : HIDE],
    [/^API \S+\/\S+ \(\d+\): /, HIDE],
    [/^API tác vụ đã xử lý:/, HIDE],

    // ---- QT2: lưu kho hồ sơ quét ----
    [/^Bấm 'Thêm mới' hồ sơ quét/, 'Đang mở bảng lưu kho hồ sơ quét...'],
    [/^Đã ghi nhớ các số phát hành: (.+)$/, (m) => 'Giấy chứng nhận của hồ sơ: ' + m[1]],
    [/^Bấm 'Chọn tập tin' để mở bảng chọn/, HIDE],
    [/^Bấm 'Chọn tất cả'/, HIDE],
    [/^Đang chọn đúng file của đơn này/, 'Đang chọn các file thuộc hồ sơ...'],
    [/^Đã tích hết bảng/, HIDE],
    [/^Chọn file: (.+)$/, (m) => 'Chọn file: ' + gonTen(m[1])],
    [/^Bỏ chọn file không thuộc đơn này: (.+)$/, (m) => 'Bỏ chọn file không thuộc đơn này: ' + gonTen(m[1])],
    [/^Bấm 'Chọn tập tin'\.{0,3}$/, HIDE],
    [/^Bấm 'Chỉnh sửa' file đính kèm(?: \(Gán: (.+?)\))?\.{0,3}$/, (m) => m[1] ? 'Đang gắn file vào giấy chứng nhận ' + m[1] + '...' : 'Đang chỉnh thông tin file...'],
    [/^Đã đổi Loại giấy tờ/, HIDE],
    [/^Đã gán Giấy chứng nhận: (.+)$/, (m) => 'Đã chọn đúng giấy chứng nhận ' + m[1]],
    [/^Bấm 'Lưu' chi tiết file/, HIDE],
    [/^Bấm 'Cập nhật' lưu kho/, 'Đang lưu kho hồ sơ quét...'],
    [/^API đã lưu hồ sơ quét/, '✅ Đã lưu kho hồ sơ quét'],
    [/^✅ Server xác nhận đủ (\d+) giấy chứng nhận đã gắn file: (.+)$/, (m) => '✅ Kiểm tra lại: ' + m[1] + ' giấy chứng nhận đã có file (' + m[2] + ')'],
    [/^Đã xử lý hết Đơn đăng ký/, HIDE],
    [/^Đang chọn đơn đăng ký thứ (\d+)/, (m) => 'Đang chọn đơn đăng ký thứ ' + m[1] + '...'],
    [/^Bỏ qua file không khớp giấy chứng nhận nào \((.+?)\): (.+)$/, (m) => 'ℹ️ Bỏ qua file không thuộc giấy chứng nhận nào: ' + gonTen(m[2])],

    // ---- QT3: sổ địa chính ----
    [/^Đang click chọn dòng thửa đất/, 'Đang chọn thửa đất...'],
    [/^Đã chọn thửa, bấm 'Xem sổ địa chính'/, 'Đang mở sổ địa chính...'],
    [/^Bấm 'Cập nhật' sổ địa chính/, 'Đang cập nhật sổ địa chính...'],
    [/^API đã lưu sổ địa chính/, '✅ Đã lưu sổ địa chính'],
    [/^Cập nhật xong\. Đóng bảng chi tiết/, HIDE],
    [/^Đã xử lý hết các thửa đất/, '✅ Xong tất cả thửa đất'],
    [/^Mạng chậm, huỷ chờ bảng chi tiết/, 'Mạng chậm, đang quét lại...'],

    // ---- QT4: Kết ISO ----
    [/^Phát hiện hộp thoại kết ISO/, 'Xác nhận Kết ISO...'],

    // ---- QT5: chuyển tiếp ----
    [/^Các QT đã xong, đang bấm nút 'Chuyển tiếp'/, 'Các bước đã xong, đang chuyển hồ sơ cho người tiếp theo...'],
    [/^Tìm thấy người nhận '(.+?)'/, (m) => 'Chọn người nhận: ' + m[1]],
    [/^Bấm 'Thực hiện' chuyển tiếp/, HIDE],
    [/^Phát hiện hộp thoại chuyển tiếp/, 'Xác nhận chuyển tiếp...'],
    [/^API chuyển tiếp xong(?: → (.+?))?\.?$/, (m) => m[1] ? '✅ Đã chuyển hồ sơ sang bước "' + m[1] + '"' : '✅ Đã chuyển tiếp hồ sơ'],
    [/^Không thấy '(.+?)', tải lại danh sách/, (m) => 'Chưa thấy người nhận "' + m[1] + '", đang tải lại danh sách...'],

    // ---- Hộp thoại chung ----
    [/^Phát hiện popup xác nhận\. Tự động bấm 'Đồng ý'\.{0,3}(?: \[nội dung: (.+)\])?$/, (m) => m[1] ? 'Đồng ý hộp xác nhận: "' + gonTen(m[1]) + '"' : 'Đồng ý hộp xác nhận của hệ thống'],
    [/^Phát hiện hộp thoại báo Thành công/, HIDE],

    // ---- Cảnh báo / lỗi (câu dễ hiểu, kèm hướng xử lý) ----
    [/^⚠️ Server từ chối (\S+): (.*?) — DỪNG AUTO\.?$/, (m) => {
        const ly = lyDoTuServer(m[2]);
        return '⛔ Hệ thống không cho phép bước "' + tenBuocTuApi(m[1]) + '"' + (ly ? ': ' + ly : '') + '. Tool đã dừng, bạn xem hồ sơ trên màn hình.';
    }],
    [/^⚠️ Hộp thoại không mong đợi: '(.*?)' — (.*?)\. DỪNG AUTO\.?$/, (m) => '⛔ Có hộp thông báo lạ' + (m[1] ? ' «' + m[1] + '»' : '') + ': ' + m[2] + '. Tool đã dừng, bạn xem màn hình rồi bấm xử lý lại.'],
    [/^⚠️ Phát hiện thông báo lỗi lạ\/sai hồ sơ: (.*?) — DỪNG AUTO!?$/, (m) => '⛔ Hệ thống báo lỗi: ' + gonTen(m[1]) + '. Tool đã dừng, bạn xem màn hình.'],
    [/^⚠️ Hộp 'Đồng ý' cập nhật pháp lý xuất hiện LẦN 2/, '⛔ Hệ thống hỏi xác nhận pháp lý lần thứ 2, có thể đang có cảnh báo. Tool đã dừng, bạn xem màn hình.'],
    [/^⚠️ Không thấy đủ phản hồi lưu\/nạp lại tệp đính kèm sau (\d+)s/, (m) => '⚠️ Chờ ' + m[1] + ' giây mà chưa thấy hệ thống báo lưu xong file đính kèm nên tool tạm đóng bảng. Bạn kiểm tra lại file đính kèm của hồ sơ.'],
    [/^⚠️ Server không lưu được tệp đính kèm: (.*?) — DỪNG AUTO\.?$/, () => '⛔ Hệ thống không lưu được file đính kèm. Tool đã dừng, bạn thử lưu lại bằng tay.'],
    [/^⚠️ Upload (.+?) lỗi mạng, thử lại lần (\d)\/2/, (m) => '⚠️ Tải file ' + gonTen(m[1]) + ' bị lỗi mạng, đang thử lại (lần ' + m[2] + '/2)...'],
    [/^⚠️ Upload (.+?) lỗi mạng (\d+) lần liên tiếp\. DỪNG AUTO\.?$/, (m) => '⛔ Tải file ' + gonTen(m[1]) + ' lỗi mạng nhiều lần. Tool đã dừng, bạn tải file này lên bằng tay.'],
    [/^⚠️ Không tìm file (GCN|GT|PT)(?: \(suffix (.+?)\))?\. Dừng để upload tay\.?$/, (m) => '⚠️ Không tìm thấy ' + (LOAI_FILE[m[1]] || 'file') + ' trong thư mục' + (m[2] ? ' (đuôi ' + m[2] + ')' : '') + '. Bạn tải file này lên bằng tay.'],
    [/^⚠️ Chưa đọc được số phát hành của hồ sơ/, '⚠️ Chưa đọc được số phát hành của hồ sơ nên tool không biết chọn file giấy chứng nhận nào. Tool đã dừng, bạn tải file lên bằng tay.'],
    [/^⚠️ Mã \.\.\.(\d+): có (\d+) file cùng khớp/, (m) => '⚠️ Có ' + m[2] + ' file cùng đuôi số ' + m[1] + ' trong thư mục, tool không biết chọn file nào. Bạn tải file lên bằng tay.'],
    [/^⚠️ Không có thửa đất nào\./, '⛔ Hồ sơ không có thửa đất nào để ký sổ. Tool đã dừng.'],
    [/^⚠️ LỖI: (SERVER TỪ CHỐI|SERVER KHÔNG LƯU)/, '⛔ Tool đã dừng vì hệ thống từ chối một bước (xem dòng ở trên).'],
    [/^⚠️ LỖI: (.+?)(?: — xem log)?!?$/, (m) => '⛔ Tool đã dừng: ' + viet(m[1])]
];

// Chuyển log gốc → { hien: chuỗi|null }. null = ẩn khỏi nhật ký người dùng.
function thanThien(text) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return raw;
    // Chỉ dòng mang dấu cảnh báo/LỖI mới được bảo vệ. (Chữ "DỪNG AUTO" cũng xuất hiện ở kết thúc bình thường.)
    const canhBao = /⚠️|LỖI/.test(raw);
    for (const [re, ket] of RULES) {
        const m = re.exec(raw);
        if (!m) continue;
        const out = typeof ket === 'function' ? ket(m, raw) : ket;
        if (out === HIDE && canhBao) return raw; // lỗi/cảnh báo không bao giờ được ẩn
        return out;
    }
    // Không có quy tắc: giữ nguyên, chỉ thay cụm "DỪNG AUTO" cho dễ hiểu.
    return raw.replace(/\s*—?\s*DỪNG AUTO[.!]?/g, ' Tool đã dừng.');
}

// Mô tả lỗi cho tin Telegram: { lyDo, huongXuLy } - câu thường, không kèm dữ liệu kỹ thuật.
function moTaLoiTelegram(loai, tieuDe, noiDung) {
    const nd = gonTen(noiDung || '').slice(0, 300);
    const L = String(loai || '');
    let m;
    if ((m = /^Server từ chối (\S+)/.exec(L))) {
        const ly = lyDoTuServer(noiDung);
        return {
            lyDo: 'Hệ thống không cho phép bước "' + tenBuocTuApi(m[1]) + '"' + (ly ? ': ' + ly : ''),
            huongXuLy: 'Vào hồ sơ xem thông báo của hệ thống, xử lý xong thì bấm chạy lại.'
        };
    }
    if (/^Hộp thoại lạ/.test(L)) {
        return {
            lyDo: 'Có hộp thông báo lạ' + (tieuDe && tieuDe.trim() ? ' «' + tieuDe.trim() + '»' : '') + (nd ? ': ' + nd : ''),
            huongXuLy: 'Xem hộp thông báo trên màn hình, xử lý rồi bấm chạy lại.'
        };
    }
    if (/^Thông báo lỗi/.test(L)) return { lyDo: 'Hệ thống báo lỗi' + (nd ? ': ' + nd : ''), huongXuLy: 'Xem thông báo trên màn hình rồi bấm chạy lại.' };
    if (/^Cập nhật pháp lý bị từ chối/.test(L)) {
        return { lyDo: 'Hệ thống từ chối cập nhật dữ liệu pháp lý' + (nd ? ': ' + nd : ''), huongXuLy: 'Kiểm tra dữ liệu pháp lý của hồ sơ (ngày vào sổ, số phát hành...) rồi chạy lại.' };
    }
    if ((m = /^QT2 · (.+)$/.exec(L))) {
        return { lyDo: m[1] + (nd ? ': ' + nd : ''), huongXuLy: 'Kiểm tra tên file và giấy chứng nhận của hồ sơ rồi chạy lại.' };
    }
    return { lyDo: L + (nd ? ': ' + nd : ''), huongXuLy: 'Xem hồ sơ trên màn hình rồi bấm chạy lại.' };
}

export { thanThien, moTaLoiTelegram };
