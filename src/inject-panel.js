import { ProcessModule } from './process-module.js';
import { ReturnModule } from './return-module.js';
import { UpdateParcelModule } from './update-parcel-module.js';
import { ExcelModule } from './excel-module.js';
import { AlertModule } from './alert-module.js';
import { isAutoConfirmEnabled, escapeHtml } from './utils.js';
import { toggleProcess, toggleReturn } from './toggle.js';
import { getLogJson, clearLog, getLogCount, isLogEnabled, setLogEnabled } from './mplis-logger.js';

    // Icon dạng SVG inline (bộ Lucide, nét 2px, viewBox 24) thay cho emoji: emoji phụ thuộc font
    // của từng máy nên mỗi trình duyệt/Windows hiển thị một kiểu, lại không đổi màu theo trạng thái
    // tab được. SVG dùng currentColor nên tự đổi màu theo tab đang chọn / hover.
    const svgIcon = (paths, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex-shrink:0;">${paths}</svg>`;

    const ICON_PROCESS = svgIcon('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>');
    const ICON_ALERT = svgIcon('<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>');
    const ICON_EXCEL = svgIcon('<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>');
    const ICON_RETURN = svgIcon('<path d="M4 4h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><polyline points="4 8 12 13 20 8"></polyline>');
    const ICON_UPDATE = svgIcon('<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>');
    const ICON_SETTINGS = svgIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>');
    const ICON_MORE = svgIcon('<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>');
    const ICON_LINK = svgIcon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>', 16);
    const ICON_REFRESH = svgIcon('<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path>', 16);
    const ICON_CLIPBOARD = svgIcon('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect>', 16);

    function injectPanel() {
        if (document.getElementById('mplis-auto-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'mplis-auto-panel';
        panel.classList.add('minimized');

        const pCfg = ProcessModule.getTopState().config;
        const rCfg = ReturnModule.getTopState().config;

        const isQT0 = pCfg.activeWorkflows.includes('QT0') ? 'checked' : '';
        const isQT1 = pCfg.activeWorkflows.includes('QT1') ? 'checked' : '';
        const isQT2 = pCfg.activeWorkflows.includes('QT2') ? 'checked' : '';
        const isQT3 = pCfg.activeWorkflows.includes('QT3') ? 'checked' : '';
        const isQT4 = pCfg.activeWorkflows.includes('QT4') ? 'checked' : '';

        const isAutoConfirmChecked = isAutoConfirmEnabled() ? 'checked' : '';
        // Đọc chung 1 khoá localStorage với phaply-default.js (ENABLED_KEY ở đó) - 2 file không
        // import lẫn nhau, chỉ cần khớp đúng tên khoá 'mplis_phaply_autofill_enabled'.
        const isPhapLyAutofillChecked = localStorage.getItem('mplis_phaply_autofill_enabled') !== 'false' ? 'checked' : '';
        // Ngày vào sổ chọn sẵn - đọc chung khoá 'mplis_phaply_ngay_vao_so' với phaply-default.js.
        // Để trống = tool tự điền ngày hôm nay.
        const phapLyNgayVaoSo = (localStorage.getItem('mplis_phaply_ngay_vao_so') || '').trim();
        // Hậu tố tên file giấy tờ kèm - đọc chung khoá 'mplis_tenfile_hau_to' với filename-copy.js.
        const hauToTenFile = ['GT', 'PT'].includes((localStorage.getItem('mplis_tenfile_hau_to') || '').toUpperCase())
            ? localStorage.getItem('mplis_tenfile_hau_to').toUpperCase() : 'GT';
        // Tự tích ô đồng bộ một cửa - mặc định TẮT (ghi lên form thật của cổng).
        const isTuTichDongBoChecked = localStorage.getItem('mplis_tenfile_tu_tich_dongbo') === 'true' ? 'checked' : '';

        // Tốc độ chạy quy trình: 3 mức, đổi bộ delayOpen/delayAction/delayNext của ProcessModule.
        // Mức hiện tại suy ra từ delayAction đang lưu, khỏi thêm khoá localStorage riêng.
        const MUC_TOC_DO = [
            { key: 'thuong', label: 'Thường', delay: 500 },
            { key: 'nhanh', label: 'Nhanh', delay: 250 },
            { key: 'toida', label: 'Tối đa', delay: 120 }
        ];
        const tocDoHienTai = (MUC_TOC_DO.find(m => m.delay === pCfg.delayAction) || MUC_TOC_DO[0]).key;
        // Đọc chung 1 khoá localStorage với spatial-link-bypass.js - mặc định TẮT (khác các ô
        // trên) vì đây là bypass cảnh báo nghiệp vụ, không phải tiện ích an toàn.
        const isBypassSpatialLinkChecked = localStorage.getItem('mplis_bypass_spatial_link_enabled') === 'true' ? 'checked' : '';
        // Đọc chung 1 khoá localStorage với dakyso-bypass.js - mặc định TẮT.
        const isBypassDaKySoChecked = localStorage.getItem('mplis_bypass_dakyso_enabled') === 'true' ? 'checked' : '';

        // Câu mô tả dưới ô "Chọn hết file" - đổi theo trạng thái để nhìn là biết tool sắp làm gì,
        // khỏi phải nhớ ý nghĩa của ô tích.
        function qt2FileHint(selectAll) {
            return selectAll
                ? 'Bấm "Chọn tất cả" trước cho tích hết bảng, rồi lọc Số phát hành gỡ tích file sai đơn.'
                : 'Chỉ tích file khớp Số phát hành của đơn, cộng file gt/pt dùng chung.';
        }

        // Nhãn ngắn hiện ngay trên thanh tiêu đề, đọc được cả khi thẻ đang thu gọn.
        function qt2FileState(selectAll) {
            return selectAll ? 'Chọn tất cả + lọc SPH' : 'Lọc theo SPH';
        }

        function fwUserState(user) {
            return (user || '').trim() ? user.trim() : 'Chưa đặt';
        }

        // Gắn hành vi đóng/mở cho 1 thẻ .mplis-collapse. storageKey giữ trạng thái qua F5.
        function bindCollapse(cardId, toggleId, storageKey) {
            const card = document.getElementById(cardId);
            const toggle = document.getElementById(toggleId);
            if (!card || !toggle) return;
            if (localStorage.getItem(storageKey) === 'true') {
                card.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
            toggle.onclick = () => {
                const opened = card.classList.toggle('open');
                toggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
                localStorage.setItem(storageKey, opened ? 'true' : 'false');
            };
        }

        panel.innerHTML = `
            <div class="mplis-panel-header">
                <div class="mplis-panel-title">
                    <span class="mplis-logo">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </span>
                    MPLIS Auto
                </div>
                <button class="mplis-btn-minimize" id="mplis-btn-minimize" title="Thu nhỏ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                </button>
            </div>

            <button class="mplis-minimized-trigger" id="mplis-btn-maximize" title="Mở rộng MPLIS Auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </button>

            <div class="mplis-shell">
                <div class="mplis-tabs">
                    <button class="mplis-tab active" data-tab="tab-process" title="Xử lý Quy trình" aria-label="Xử lý Quy trình">${ICON_PROCESS}</button>
                    <button class="mplis-tab" data-tab="tab-alert" title="Nhắc nhở hồ sơ trễ hạn" aria-label="Nhắc nhở hồ sơ trễ hạn">${ICON_ALERT}</button>
                    <button class="mplis-tab" data-tab="tab-excel" title="Xuất dữ liệu Excel" aria-label="Xuất dữ liệu Excel">${ICON_EXCEL}</button>
                    <!-- ĐANG ẨN TẠM: 2 tab "Trả hồ sơ" và "Auto sửa Thửa/Tờ" (không dùng tới). Toàn bộ code
                         và phần nội dung 2 tab vẫn giữ nguyên bên dưới - muốn bật lại chỉ cần thêm lại 2 dòng:
                         <button class="mplis-tab mplis-tab-extra" data-tab="tab-return" title="Trả hồ sơ" aria-label="Trả hồ sơ" style="display:none;">ICON_RETURN</button>
                         <button class="mplis-tab mplis-tab-extra" data-tab="tab-update" title="Auto sửa Thửa/Tờ" aria-label="Auto sửa Thửa/Tờ" style="display:none;">ICON_UPDATE</button> -->
                    <button class="mplis-tab mplis-tab-extra" data-tab="tab-settings" title="Cài đặt" aria-label="Cài đặt" style="display:none;">${ICON_SETTINGS}</button>
                    <button class="mplis-tab-toggle" id="mplis-btn-toggle-extra" title="Hiện thêm tab" aria-label="Hiện thêm tab">${ICON_MORE}</button>
                </div>

                <div class="mplis-content">
                    <!-- TAB 1: PROCESS -->
                    <div class="mplis-panel-body active" id="tab-process">
                        <span class="mplis-section-label">Chọn quy trình tự động</span>
                        <!-- Xếp 2 cột + nhãn ngắn (tên đầy đủ nằm ở title) cho tab Xử lý gọn lại. -->
                        <div class="mplis-checkbox-group cols2" style="margin-bottom:10px;">
                            <label title="QT0 · Cập nhật tệp đính kèm"><input type="checkbox" name="mplis-workflow" value="QT0" ${isQT0}> QT0 · Tệp đính kèm</label>
                            <label title="QT1 · Cập nhật dữ liệu pháp lý"><input type="checkbox" name="mplis-workflow" value="QT1" ${isQT1}> QT1 · Dữ liệu pháp lý</label>
                            <label title="QT2 · Lưu kho hồ sơ quét"><input type="checkbox" name="mplis-workflow" value="QT2" ${isQT2}> QT2 · Lưu kho quét</label>
                            <label title="QT3 · Ký số sổ địa chính"><input type="checkbox" name="mplis-workflow" value="QT3" ${isQT3}> QT3 · Ký số sổ ĐC</label>
                            <label title="QT4 · Kết ISO"><input type="checkbox" name="mplis-workflow" value="QT4" ${isQT4}> QT4 · Kết ISO</label>
                            <label title="QT5 · Chuyển tiếp hồ sơ"><input type="checkbox" id="chk-qt5" ${pCfg.isQT5 ? 'checked' : ''}> QT5 · Chuyển tiếp</label>
                        </div>

                        <div class="mplis-card mplis-collapse" id="qt2-file-group" style="display: ${isQT2 ? 'block' : 'none'};">
                            <button type="button" class="mplis-collapse-head" id="qt2-file-toggle" aria-expanded="false" aria-controls="qt2-file-body">
                                <span class="mplis-section-label">QT2 · Bảng chọn file quét</span>
                                <span class="mplis-collapse-state ${pCfg.qt2SelectAllFiles ? 'on' : ''}" id="qt2-file-state">${qt2FileState(pCfg.qt2SelectAllFiles)}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="qt2-file-body">
                                <div class="mplis-bypass-row" style="margin-bottom:4px;">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Chọn hết file trong bảng</strong>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-qt2-selectall" ${pCfg.qt2SelectAllFiles ? 'checked' : ''}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                                <div class="mplis-hint" style="margin:4px 0 0;" id="qt2-file-hint">${qt2FileHint(pCfg.qt2SelectAllFiles)}</div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="qt-upload-group">
                            <button type="button" class="mplis-collapse-head" id="qt-upload-toggle" aria-expanded="false" aria-controls="qt-upload-body">
                                <span class="mplis-section-label">Upload file tự động</span>
                                <span class="mplis-collapse-state" id="qt-upload-state">Chưa chọn</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="qt-upload-body">
                                <input type="file" id="mplis-folder-picker" webkitdirectory multiple style="display:none">
                                <div style="display:flex; gap:6px; margin-bottom:8px;">
                                    <button type="button" id="btn-chon-thu-muc" class="mplis-btn-primary" style="flex:1; padding:9px; font-size:12px;">Chọn thư mục</button>
                                    <button type="button" id="btn-xoa-thu-muc" class="mplis-btn-ghost" style="padding:9px 12px; flex-shrink:0;" title="Xóa thư mục đã chọn">✕</button>
                                </div>
                                <div id="qt-upload-files-status" style="font-size:11.5px; color:var(--mplis-text-dim); margin-bottom:8px; word-break:break-all; line-height:1.5;"></div>
                                <div style="font-size:12px; color:#e2e8f0; margin-bottom:6px;">Số cuối SPH để khớp file GCN:</div>
                                <div id="qt-upload-sochuso-group" role="radiogroup" aria-label="Số chữ số cuối SPH" style="display:flex; gap:6px;">
                                    <button type="button" class="mplis-hauto-btn" data-sochuso="3" role="radio" aria-checked="${(pCfg.qt2SoChuSo || 3) === 3 ? 'true' : 'false'}" style="flex:1; font-size:11px;" title="TC, XN NN (3 số cuối SPH)">3 số</button>
                                    <button type="button" class="mplis-hauto-btn" data-sochuso="4" role="radio" aria-checked="${(pCfg.qt2SoChuSo || 3) === 4 ? 'true' : 'false'}" style="flex:1; font-size:11px;" title="GCN khác (4 số cuối SPH)">4 số</button>
                                </div>
                                <div class="mplis-hint" style="margin-top:6px;">VD: SPH <b>08107975</b> → 3 số: <b>975</b> · 4 số: <b>7975</b><br/>File GT.pdf / PT.pdf tự nhận theo đuôi tên.</div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="fw-user-group" style="display: ${pCfg.isQT5 ? 'block' : 'none'};">
                            <button type="button" class="mplis-collapse-head" id="fw-user-toggle" aria-expanded="false" aria-controls="fw-user-body">
                                <span class="mplis-section-label">Chuyển tiếp (sau khi Kết ISO)</span>
                                <span class="mplis-collapse-state ${pCfg.forwardUser ? 'on' : ''}" id="fw-user-state">${escapeHtml(fwUserState(pCfg.forwardUser))}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="fw-user-body">
                                <input type="text" id="cfg-p-forwardUser" value="${escapeHtml(pCfg.forwardUser || '')}" placeholder="Tên tài khoản, VD: dla.thoitd" style="background: rgba(0,0,0,0.25); border: 1px solid var(--mplis-border); border-radius: 8px; padding: 8px 10px; color: #f8fafc; width: 100%; font-size: 12px;">
                                <div class="mplis-hint" style="margin:8px 0 0;">Bỏ trống thì tool dừng lại sau Kết ISO, không chuyển cho ai.</div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="bypass-card" style="display: ${(isQT2 || isQT4) ? 'block' : 'none'};">
                            <button type="button" class="mplis-collapse-head" id="bypass-card-toggle" aria-expanded="false" aria-controls="bypass-card-body">
                                <span class="mplis-section-label">Bypass cảnh báo</span>
                                <span class="mplis-collapse-state" id="bypass-card-state">Tất cả tắt</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="bypass-card-body">
                                <div class="mplis-bypass-row" id="bypass-row-dakyso" style="display: ${isQT2 ? 'flex' : 'none'};">
                                    <div class="mplis-bypass-row-label">
                                        <strong>QT2 · Ký số GCN</strong>
                                        <span>Bỏ qua lỗi "chưa ký số" khi lưu kho</span>
                                    </div>
                                    <label class="mplis-toggle-sw" title="Tự bỏ qua kiểm tra ký số Giấy chứng nhận khi lưu kho hồ sơ quét">
                                        <input type="checkbox" id="chk-bypass-dakyso" ${isBypassDaKySoChecked}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                                <div class="mplis-bypass-row" id="bypass-row-kg" style="display: ${isQT4 ? 'flex' : 'none'};">
                                    <div class="mplis-bypass-row-label">
                                        <strong>QT4 · Liên kết không gian</strong>
                                        <span>Bỏ qua cảnh báo khi Kết ISO</span>
                                    </div>
                                    <label class="mplis-toggle-sw" title="Tự bỏ qua cảnh báo chưa liên kết không gian khi Kết ISO">
                                        <input type="checkbox" id="chk-bypass-kg" ${isBypassSpatialLinkChecked}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Tốc độ để ngay tab Xử lý, cạnh nút chạy: chỉnh lúc đang làm, khỏi
                             chui vào Cài đặt. Thẻ trong Cài đặt vẫn còn và đồng bộ 2 chiều. -->
                        <!-- Tốc độ: 1 hàng nhãn + 3 nút mức, thanh kéo nằm dưới cùng hàng card. -->
                        <div class="mplis-card" style="padding:8px 9px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span class="mplis-section-label" style="margin:0; flex-shrink:0;">Tốc độ</span>
                                <div id="tocdo-group-main" role="radiogroup" aria-label="Mức tốc độ dựng sẵn" style="display:flex; gap:4px; margin-left:auto;">
                                    ${MUC_TOC_DO.map(m => `<button type="button" class="mplis-hauto-btn" data-tocdo="${m.key}" role="radio" aria-checked="${m.key === tocDoHienTai ? 'true' : 'false'}" style="min-height:28px; padding:4px 9px !important; font-size:11px !important;">${m.label}</button>`).join('')}
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; margin-top:7px;">
                                <input type="range" id="tocdo-slider" min="100" max="1000" step="50" value="${pCfg.delayAction || 500}"
                                    aria-label="Thời gian nghỉ giữa 2 thao tác (mili giây)"
                                    style="flex:1; min-width:0; cursor:pointer;">
                                <span id="tocdo-value" style="flex-shrink:0; min-width:54px; text-align:right; font-size:11px; font-weight:700; color:var(--mplis-accent-2); font-variant-numeric:tabular-nums;"></span>
                            </div>
                        </div>

                        <button class="mplis-btn-primary" id="btn-toggle-process">▶ Bắt đầu Xử Lý</button>
                        <div class="mplis-status-bar">
                            <div class="mplis-status-row">
                                <div class="mplis-status-lbl"><span class="mplis-status-dot" id="mplis-status-dot-process"></span><span id="mplis-status-text-process">Đang dừng</span></div>
                                <div style="color: var(--mplis-text-dim);">Thành công: <span id="mplis-counter-val-process" style="color: var(--mplis-accent-2); font-weight: bold;">0</span></div>
                            </div>
                            <div class="mplis-log" id="mplis-step-log-process">Sẵn sàng</div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="proc-log-group" style="margin-top:8px;">
                            <button type="button" class="mplis-collapse-head" id="proc-log-toggle" aria-expanded="false" aria-controls="proc-log-body">
                                <span class="mplis-section-label">Log chi tiết</span>
                                <span class="mplis-collapse-state" id="proc-log-count-process" style="font-variant-numeric:tabular-nums;">0</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="proc-log-body">
                                <div id="mplis-log-area-process" style="max-height:180px; overflow-y:auto; font-family:'Consolas','Cascadia Code',monospace; font-size:11px; line-height:1.65; color:var(--mplis-text-dim); background:rgba(0,0,0,0.25); border-radius:6px; padding:6px 8px; word-break:break-all;"></div>
                                <div style="display:flex; gap:6px; margin-top:6px;">
                                    <button type="button" id="btn-proc-log-copy" class="mplis-btn-ghost" style="flex:1; font-size:11.5px; padding:7px;">Copy log</button>
                                    <button type="button" id="btn-proc-log-clear" class="mplis-btn-ghost" style="padding:7px 14px; font-size:11.5px;">Xóa</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: ALERT -->
                    <div class="mplis-panel-body" id="tab-alert">
                        <div style="display:flex; gap:4px; background:var(--mplis-surface); padding:4px; border-radius:9px; margin-bottom:12px;">
                            <button class="mplis-filter-tab active" data-step="all" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#fff; cursor:pointer;">Tất cả</button>
                            <button class="mplis-filter-tab" data-step="luutru" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">Lưu trữ hồ sơ</button>
                            <button class="mplis-filter-tab" data-step="iso" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">Kết ISO</button>

                        </div>

                        <div style="display:flex; justify-content:space-between; margin-bottom: 12px; font-size: 12px; color: var(--mplis-text-dim);">
                            <div style="display:flex; align-items:center; gap:6px;">Báo trước (phút): <input type="number" id="cfg-alert-minutes" value="1440" step="1" style="width:60px; padding:4px; background:rgba(0,0,0,0.25); border:1px solid var(--mplis-border); border-radius:6px; color:#fff; text-align:center;"></div>
                            <div style="display:flex; align-items:center; gap:5px;">Hiển thị: <span id="stat-m-visible" style="color:var(--mplis-good); font-weight:bold; font-size:12px;">0</span> / <span id="stat-m-total" style="color:var(--mplis-accent-2); font-weight:bold; font-size:12px;">0</span></div>
                        </div>

                        <div style="display:flex; gap: 8px; margin-bottom: 12px;">
                            <button class="mplis-btn-primary" id="btn-m-reload-table" style="flex:1; padding:10px; background:linear-gradient(135deg,#8b5cf6,#7c3aed);" title="Tải lại bảng dữ liệu"><i class="fa fa-refresh"></i></button>
                            <button class="mplis-btn-primary" id="btn-m-scan-now" style="flex:1; padding:10px;" title="Quét & Phân loại dữ liệu hiện tại"><i class="fa fa-magic"></i></button>
                            <button class="mplis-btn-primary" id="btn-m-copy-all" style="flex:1; padding:10px; background:linear-gradient(135deg,#10b981,#059669);" title="Copy danh sách hồ sơ đang lọc"><i class="fa fa-copy"></i></button>
                        </div>

                        <div class="mplis-status-bar" style="margin-top:0;">
                            <div class="mplis-status-row">
                                <div class="mplis-status-lbl"><span class="mplis-status-dot" id="stat-m-status-dot"></span><span id="stat-m-status">Chờ lệnh quét</span></div>
                                <div style="color: var(--mplis-text-dim);">Cảnh báo: <span id="stat-m-count" style="color: var(--mplis-bad); font-weight: bold;">0</span></div>
                            </div>
                            <div class="mplis-log" id="vbdlis-m-logs" style="height: 80px; overflow-y: auto; white-space: pre-wrap;">Sẵn sàng</div>
                        </div>
                    </div>

                    <!-- TAB 3: EXCEL -->
                    <div class="mplis-panel-body" id="tab-excel">
                        <div id="excel-filter-bar" style="display:none;"><button class="mplis-excel-filter active" data-excel-bucket="all" style="display:none;"></button></div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px; padding:8px 10px; background:rgba(255,255,255,0.04); border:1px solid var(--mplis-border); border-radius:10px;">
                            <button id="btn-toggle-sheet-cfg" class="mplis-btn-ghost" style="width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:8px; flex-shrink:0;" title="Cấu hình link Google Sheet" aria-label="Cấu hình link Google Sheet">${ICON_LINK}</button>
                            <span id="excel-sheet-status" style="font-size:12px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
                            <button id="btn-test-sheet-link" class="mplis-btn-ghost" style="width:26px; height:26px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:7px; flex-shrink:0;" title="Kiểm tra link Sheet còn hoạt động không" aria-label="Kiểm tra link Sheet">${ICON_REFRESH}</button>
                            <span style="flex-shrink:0; font-size:11px; color:var(--mplis-text-dim);">Hồ sơ: <b id="excel-count" style="color:#fde047; font-variant-numeric:tabular-nums;">0</b></span>
                        </div>
                        <div id="excel-sheet-cfg-row" style="display:none; align-items:center; gap:6px; margin-bottom:8px;">
                            <label for="cfg-excel-sheet-url" style="font-size:12px; color:var(--mplis-text-dim); flex-shrink:0;">Sheet:</label>
                            <input type="text" id="cfg-excel-sheet-url" placeholder="Dán link Web App Google Apps Script..." style="flex:1; min-width:0; padding:7px 8px; background:rgba(0,0,0,0.25); border:1px solid var(--mplis-border); border-radius:6px; color:#f8fafc; font-size:12px;">
                        </div>
                        <div id="excel-account-filter-row" style="display:none;"></div>
                        <div style="flex:1; overflow-y:auto; margin-bottom:10px; border:1px solid var(--mplis-border); border-radius:10px; max-height:190px;">
                            <table id="table-excel-cart" style="width:100%; font-size:12px; color:#f8fafc; border-collapse:collapse; text-align:center;">
                                <thead>
                                    <tr style="background:rgba(255,255,255,0.06); position:sticky; top:0; z-index:1;" id="table-excel-cart-head"></tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button id="btn-excel-copy" class="mplis-btn-primary" style="flex:1; background:linear-gradient(135deg,#8b5cf6,#7c3aed);" title="Copy bảng đang xem">COPY</button>
                            <button id="btn-excel-clear" class="mplis-btn-primary" style="flex:0.35; background:linear-gradient(135deg,#f43f5e,#e11d48);" title="Xóa bảng đang xem">XÓA</button>
                        </div>
                    </div>


                    <!-- TAB 4: RETURN -->
                    <div class="mplis-panel-body tab-return-color" id="tab-return">
                        <div class="mplis-hint">Tự động quét các bước:<br/><b style="color:#fde047">5 · 6 · 9 — Trả kết quả hồ sơ</b></div>

                        <button class="mplis-btn-primary" id="btn-toggle-return">▶ Bắt đầu Trả Hồ Sơ</button>
                        <div class="mplis-status-bar">
                            <div class="mplis-status-row">
                                <div class="mplis-status-lbl"><span class="mplis-status-dot" id="mplis-status-dot-return"></span><span id="mplis-status-text-return">Đang dừng</span></div>
                                <div style="color: var(--mplis-text-dim);">Thành công: <span id="mplis-counter-val-return" style="color: #eab308; font-weight: bold;">0</span></div>
                            </div>
                            <div class="mplis-log" id="mplis-step-log-return">Sẵn sàng</div>
                        </div>
                    </div>

                    <!-- TAB 5: UPDATE PARCEL -->
                    <div class="mplis-panel-body" id="tab-update">
                        <span class="mplis-section-label">Dán dữ liệu từ Excel</span>
                        <textarea id="update-excel-input" placeholder="Số phát hành, Tờ mới, Thửa mới, Tờ cũ, Thửa cũ" style="background: rgba(0,0,0,0.25); border: 1px solid var(--mplis-border); border-radius: 8px; padding: 8px; color: #f8fafc; width: 100%; height: 72px; font-size: 12px; resize:none; margin-bottom:8px;"></textarea>
                        <div style="display:flex; gap:6px; margin-bottom:10px;">
                            <button class="mplis-btn-primary" id="btn-update-parse" style="flex:1; background:linear-gradient(135deg,#3b82f6,#2563eb); font-size:12px; padding:9px;">Nạp dữ liệu</button>
                            <button class="mplis-btn-primary" id="btn-update-start" style="flex:1; background:linear-gradient(135deg,#10b981,#059669); font-size:12px; padding:9px;" disabled>Bắt đầu</button>
                            <button class="mplis-btn-primary" id="btn-update-stop" style="flex:1; background:linear-gradient(135deg,#f43f5e,#e11d48); font-size:12px; padding:9px; display:none;">Dừng lại</button>
                        </div>
                        <div class="mplis-status-bar">
                            <div class="mplis-status-row">
                                <div class="mplis-status-lbl">Tiến độ: <span id="stat-current" style="color:var(--mplis-accent-2); font-weight:bold;">0</span> / <span id="stat-total">0</span></div>
                                <div style="color: var(--mplis-text-dim);"><span class="mplis-status-dot" id="update-dot"></span><span id="stat-status">Chưa bắt đầu</span></div>
                            </div>
                            <div class="mplis-log" id="vbdlis-logs" style="height: 60px; overflow-y:auto; white-space:pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.5;">Sẵn sàng</div>
                        </div>
                        <div style="max-height:100px; overflow-y:auto; margin-top:10px; border:1px solid var(--mplis-border); border-radius:8px;">
                            <table style="width:100%; font-size:12px; color:#f8fafc; border-collapse:collapse; text-align:left;">
                                <tbody id="result-table-body"></tbody>
                            </table>
                        </div>
                        <button class="mplis-btn-primary mplis-btn-ghost" id="btn-update-copy" style="width:100%; margin-top:8px; font-size:12px; padding:9px; box-shadow:none;">${ICON_CLIPBOARD}Copy trạng thái gốc</button>
                    </div>

                    <!-- TAB 6: SETTINGS -->
                    <!-- Mỗi mục là 1 thẻ thu gọn: đóng lại chỉ còn tiêu đề + trạng thái, nên tab
                         Cài đặt không dài tới mức phải cuộn mới thấy mục cuối. Trạng thái nằm trên
                         thanh tiêu đề để đóng vẫn biết đang bật/tắt gì. -->
                    <div class="mplis-panel-body" id="tab-settings">
                        <div class="mplis-card mplis-collapse" id="set-safe-group">
                            <button type="button" class="mplis-collapse-head" id="set-safe-toggle" aria-expanded="false" aria-controls="set-safe-body">
                                <span class="mplis-section-label">An toàn</span>
                                <span class="mplis-collapse-state ${isAutoConfirmChecked ? 'on' : ''}" id="set-safe-state">${isAutoConfirmChecked ? 'Tự đồng ý' : 'Hỏi tay'}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-safe-body">
                                <div class="mplis-bypass-row">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Tự đồng ý hộp thoại</strong>
                                        <span>Tắt nếu muốn tự xác nhận (ký số, kết ISO). Cần <b>tải lại trang</b>.</span>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-auto-confirm" ${isAutoConfirmChecked}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="set-autofill-group">
                            <button type="button" class="mplis-collapse-head" id="set-autofill-toggle" aria-expanded="false" aria-controls="set-autofill-body">
                                <span class="mplis-section-label">Tự điền pháp lý</span>
                                <span class="mplis-collapse-state ${isPhapLyAutofillChecked ? 'on' : ''}" id="set-autofill-state">${isPhapLyAutofillChecked ? (phapLyNgayVaoSo ? 'Bật · ngày cố định' : 'Bật · hôm nay') : 'Tắt'}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-autofill-body">
                                <div class="mplis-bypass-row" style="margin-bottom:10px;">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Tự điền pháp lý</strong>
                                        <span>Tích "Chính thức", Loại GCN, Người ký, Ngày vào sổ. Sửa tay đè lên được.</span>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-phaply-autofill" ${isPhapLyAutofillChecked}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>

                                <div style="display:flex; align-items:center; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid var(--mplis-border);">
                                    <label for="cfg-phaply-ngay-vao-so" style="font-size:12px; color:var(--mplis-text-dim); flex-shrink:0;">Ngày vào sổ:</label>
                                    <input type="date" id="cfg-phaply-ngay-vao-so" value="${escapeHtml(phapLyNgayVaoSo)}" style="flex:1; min-width:0; padding:7px 8px; background:rgba(0,0,0,0.25); border:1px solid var(--mplis-border); border-radius:6px; color:#f8fafc; font-size:12px; color-scheme:dark;">
                                    <button type="button" id="btn-phaply-ngay-hom-nay" class="mplis-btn-ghost" style="padding:7px 10px; font-size:11.5px; flex-shrink:0;">Hôm nay</button>
                                </div>
                                <div id="phaply-ngay-state" style="margin-top:6px; font-size:11.5px; line-height:1.5;"></div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="set-tenfile-group">
                            <button type="button" class="mplis-collapse-head" id="set-tenfile-toggle" aria-expanded="false" aria-controls="set-tenfile-body">
                                <span class="mplis-section-label">Tên file quét</span>
                                <span class="mplis-collapse-state on" id="set-tenfile-state">${hauToTenFile}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-tenfile-body">
                                <div style="font-size:12px; color:#e2e8f0;">Hậu tố tên <b>giấy tờ kèm</b></div>
                                <div id="tenfile-hauto-group" role="radiogroup" aria-label="Hậu tố tên file giấy tờ kèm" style="display:flex; gap:6px; margin-top:8px;">
                                    <button type="button" class="mplis-hauto-btn" data-hauto="GT" aria-checked="${hauToTenFile === 'GT' ? 'true' : 'false'}" role="radio" style="flex:1; min-height:34px;">GT</button>
                                    <button type="button" class="mplis-hauto-btn" data-hauto="PT" aria-checked="${hauToTenFile === 'PT' ? 'true' : 'false'}" role="radio" style="flex:1; min-height:34px;">PT</button>
                                </div>
                                <div id="tenfile-hauto-state" style="margin-top:8px; font-size:11.5px; color:var(--mplis-text-dim); line-height:1.6;"></div>

                                <div class="mplis-bypass-row" style="margin-top:10px; padding-top:10px; border-top:1px solid var(--mplis-border);">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Tự tích đồng bộ một cửa</strong>
                                        <span>Dòng SPH thì tích, dòng GT/PT thì bỏ tích. <b>Mặc định TẮT</b> vì ghi form thật.</span>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-tenfile-dongbo" ${isTuTichDongBoChecked}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="set-speed-group">
                            <button type="button" class="mplis-collapse-head" id="set-speed-toggle" aria-expanded="false" aria-controls="set-speed-body">
                                <span class="mplis-section-label">Tốc độ chạy</span>
                                <span class="mplis-collapse-state on" id="set-speed-state">${MUC_TOC_DO.find(m => m.key === tocDoHienTai).label}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-speed-body">
                                <div id="tocdo-group" role="radiogroup" aria-label="Tốc độ chạy quy trình" style="display:flex; gap:6px;">
                                    ${MUC_TOC_DO.map(m => `<button type="button" class="mplis-hauto-btn" data-tocdo="${m.key}" role="radio" aria-checked="${m.key === tocDoHienTai ? 'true' : 'false'}" style="flex:1; min-height:34px;">${m.label}</button>`).join('')}
                                </div>
                                <div id="tocdo-state" style="margin-top:8px; font-size:11.5px; color:var(--mplis-text-dim); line-height:1.6;"></div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="set-keys-group">
                            <button type="button" class="mplis-collapse-head" id="set-keys-toggle" aria-expanded="false" aria-controls="set-keys-body">
                                <span class="mplis-section-label">Phím tắt</span>
                                <span class="mplis-collapse-state" id="set-keys-state">4 phím</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-keys-body" style="font-size:11.5px; color:#cbd5e1; line-height:1.9;">
                                <div><b style="color:#fff;">Alt + S</b> — Bật/tắt tab đang mở</div>
                                <div><b style="color:#fff;">Alt + H</b> — Ẩn/hiện bảng điều khiển</div>
                                <div><b style="color:#fff;">Alt + D</b> — Copy tên file giấy chứng nhận</div>
                                <div><b style="color:#fff;">Alt + G</b> — Copy tên file giấy tờ kèm</div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="set-log-group" style="margin-bottom:0;">
                            <button type="button" class="mplis-collapse-head" id="set-log-toggle" aria-expanded="false" aria-controls="set-log-body">
                                <span class="mplis-section-label">Nhật ký</span>
                                <span class="mplis-collapse-state" id="set-log-state">0 mục</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-log-body">
                                <div style="font-size:11.5px; color:var(--mplis-text-dim); margin-bottom:8px; line-height:1.6;">Ghi lại fetch, response, lỗi JS. Copy paste cho Claude để phân tích và nâng cấp.</div>
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:8px;">
                                    <input type="checkbox" id="chk-log-enabled" style="width:16px;height:16px;cursor:pointer;" />
                                    <span style="font-size:12px; color:#e2e8f0;">Bật ghi nhật ký</span>
                                </label>
                                <div style="display:flex; gap:6px; margin-bottom:8px;">
                                    <button type="button" id="btn-log-copy" class="mplis-btn-ghost" style="flex:1;">Copy log</button>
                                    <button type="button" id="btn-log-clear" class="mplis-btn-ghost" style="padding:7px 12px;">Xóa</button>
                                </div>
                                <div id="log-preview" style="font-size:10.5px; color:var(--mplis-text-dim); font-family:monospace; max-height:90px; overflow-y:auto; line-height:1.6; word-break:break-all; background:rgba(0,0,0,0.2); border-radius:6px; padding:6px 8px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Badge trạng thái trên thanh tiêu đề từng thẻ Cài đặt - đóng thẻ vẫn thấy đang bật gì.
        function veBadge(id, chu, on) {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = chu;
            el.classList.toggle('on', !!on);
        }

        const chkAutoConfirm = document.getElementById('chk-auto-confirm');
        if (chkAutoConfirm) {
            chkAutoConfirm.onchange = (e) => {
                localStorage.setItem('mplis_auto_confirm_override', e.target.checked ? 'true' : 'false');
                const settingsTab = document.getElementById('tab-settings');
                let notice = document.getElementById('auto-confirm-notice');
                if (!notice && settingsTab) {
                    notice = document.createElement('div');
                    notice.id = 'auto-confirm-notice';
                    notice.style.cssText = 'margin-top:8px; font-size:12px; color:#f59e0b; font-weight:600;';
                    settingsTab.insertBefore(notice, settingsTab.children[1]);
                }
                veBadge('set-safe-state', e.target.checked ? 'Tự đồng ý' : 'Hỏi tay', e.target.checked);
                if (notice) notice.textContent = '⚠️ Đã lưu. Tải lại trang (F5) để áp dụng thay đổi.';
            };
        }

        // phaply-default.js đọc localStorage mỗi vòng quét (1s) chứ không đọc 1 lần lúc tải trang,
        // nên đổi công tắc này áp dụng ngay - không cần F5 như ô auto-confirm ở trên.
        const chkPhapLyAutofill = document.getElementById('chk-phaply-autofill');
        if (chkPhapLyAutofill) {
            chkPhapLyAutofill.onchange = (e) => {
                localStorage.setItem('mplis_phaply_autofill_enabled', e.target.checked ? 'true' : 'false');
                const coNgay = !!(document.getElementById('cfg-phaply-ngay-vao-so') || {}).value;
                veBadge('set-autofill-state',
                    e.target.checked ? (coNgay ? 'Bật · ngày cố định' : 'Bật · hôm nay') : 'Tắt',
                    e.target.checked);
            };
        }

        // Ô chọn Ngày vào sổ. Để trống = hôm nay (mặc định). Chọn ngày cụ thể thì MỌI hồ sơ điền
        // ngày đó cho tới khi bấm "Hôm nay" - dễ quên nên dòng trạng thái dưới ô tô màu cảnh báo.
        const inpPhapLyNgay = document.getElementById('cfg-phaply-ngay-vao-so');
        const statePhapLyNgay = document.getElementById('phaply-ngay-state');
        if (inpPhapLyNgay && statePhapLyNgay) {
            const veTrangThai = () => {
                const val = inpPhapLyNgay.value.trim();
                if (!val) {
                    statePhapLyNgay.style.color = 'var(--mplis-text-dim)';
                    statePhapLyNgay.textContent = 'Đang để trống: tự điền ngày hôm nay.';
                    return;
                }
                const [yyyy, mm, dd] = val.split('-');
                statePhapLyNgay.style.color = '#f59e0b';
                statePhapLyNgay.textContent = '⚠️ Cố định ' + dd + '/' + mm + '/' + yyyy
                    + ' cho mọi hồ sơ. Bấm "Hôm nay" để trả về mặc định.';
            };

            const luuNgay = () => {
                try { localStorage.setItem('mplis_phaply_ngay_vao_so', inpPhapLyNgay.value.trim()); } catch (e) { }
                veTrangThai();
                const bat = (document.getElementById('chk-phaply-autofill') || {}).checked;
                veBadge('set-autofill-state',
                    bat ? (inpPhapLyNgay.value.trim() ? 'Bật · ngày cố định' : 'Bật · hôm nay') : 'Tắt', bat);
            };

            inpPhapLyNgay.onchange = luuNgay;
            inpPhapLyNgay.oninput = luuNgay;

            const btnNgayHomNay = document.getElementById('btn-phaply-ngay-hom-nay');
            if (btnNgayHomNay) {
                btnNgayHomNay.onclick = () => {
                    inpPhapLyNgay.value = '';
                    luuNgay();
                };
            }

            veTrangThai();
        }

        // Chọn hậu tố GT/PT cho tên giấy tờ kèm. filename-copy.js đọc localStorage mỗi lần bấm
        // nên đổi ở đây áp dụng ngay, không cần F5.
        const hauToGroup = document.getElementById('tenfile-hauto-group');
        const hauToState = document.getElementById('tenfile-hauto-state');
        if (hauToGroup && hauToState) {
            const veHauTo = (hauTo) => {
                hauToGroup.querySelectorAll('.mplis-hauto-btn').forEach(b => {
                    const on = b.dataset.hauto === hauTo;
                    b.setAttribute('aria-checked', on ? 'true' : 'false');
                    b.classList.toggle('on', on);
                });
                veBadge('set-tenfile-state', hauTo, true);
                hauToState.innerHTML = 'Giấy tờ kèm: <b style="color:#fff;">&lt;mã hồ sơ&gt;-'
                    + hauTo + '.pdf</b> — không tích ô đồng bộ một cửa.<br/>'
                    + 'Giấy chứng nhận: <b style="color:#fff;">&lt;mã hồ sơ&gt;-&lt;Số phát hành&gt;.pdf</b>'
                    + ' — tích ô đồng bộ một cửa.<br/>'
                    + 'Phím tắt: <b style="color:#fff;">Alt+D</b> giấy chứng nhận, '
                    + '<b style="color:#fff;">Alt+G</b> giấy tờ kèm.';
            };

            hauToGroup.querySelectorAll('.mplis-hauto-btn').forEach(b => {
                b.onclick = () => {
                    const hauTo = b.dataset.hauto;
                    try { localStorage.setItem('mplis_tenfile_hau_to', hauTo); } catch (e) { }
                    veHauTo(hauTo);
                };
            });
            veHauTo(hauToTenFile);
        }

        // Tự tích ô "đồng bộ về một cửa". filename-copy.js đọc localStorage mỗi vòng quét nên đổi
        // là áp dụng ngay, không cần F5.
        const chkTenFileDongBo = document.getElementById('chk-tenfile-dongbo');
        if (chkTenFileDongBo) {
            chkTenFileDongBo.onchange = (e) => {
                localStorage.setItem('mplis_tenfile_tu_tich_dongbo', e.target.checked ? 'true' : 'false');
            };
        }

        // Tốc độ chạy: ghi thẳng vào config của ProcessModule, áp dụng ngay vòng quét kế tiếp.
        // Tốc độ chỉnh được ở 2 nơi (tab Xử lý và Cài đặt) + thanh kéo mịn. Tất cả ghi vào cùng
        // config của ProcessModule, nên đổi ở đâu cũng vẽ lại cả 2 chỗ.
        const tocDoSlider = document.getElementById('tocdo-slider');
        const tocDoValue = document.getElementById('tocdo-value');
        const tocDoState = document.getElementById('tocdo-state');
        const nhomTocDo = ['tocdo-group', 'tocdo-group-main']
            .map(id => document.getElementById(id)).filter(Boolean);

        function tenMucTocDo(delay) {
            const khop = MUC_TOC_DO.find(m => m.delay === delay);
            if (khop) return khop.label;
            if (delay <= 200) return 'Tuỳ chỉnh · rất nhanh';
            if (delay >= 700) return 'Tuỳ chỉnh · chậm';
            return 'Tuỳ chỉnh';
        }

        function veTocDo(delay) {
            const muc = MUC_TOC_DO.find(m => m.delay === delay);
            nhomTocDo.forEach(g => g.querySelectorAll('.mplis-hauto-btn').forEach(b => {
                const on = !!muc && b.dataset.tocdo === muc.key;
                b.setAttribute('aria-checked', on ? 'true' : 'false');
                b.classList.toggle('on', on);
            }));
            if (tocDoSlider && Number(tocDoSlider.value) !== delay) tocDoSlider.value = delay;
            if (tocDoValue) {
                tocDoValue.textContent = delay + 'ms';
                tocDoValue.title = tenMucTocDo(delay);
            }
            veBadge('set-speed-state', tenMucTocDo(delay), true);
            if (tocDoState) {
                tocDoState.innerHTML = 'Nghỉ giữa 2 thao tác: <b style="color:#fff;">' + delay + 'ms</b>'
                    + ' · vòng quét 400ms. Kéo thanh ở tab Xử lý để chỉnh từng 50ms.<br/>'
                    + 'Số càng nhỏ chạy càng sát; mạng hoặc cổng chậm mà để dưới <b style="color:#fff;">200ms</b>'
                    + ' thì dễ bấm lúc trang chưa dựng xong, auto gặp hộp thoại lạ rồi tự dừng.';
            }
        }

        function datTocDo(delay) {
            const d = Math.min(1000, Math.max(100, Number(delay) || 500));
            ProcessModule.saveConfig({ delayOpen: d, delayAction: d, delayNext: d });
            veTocDo(d);
        }

        nhomTocDo.forEach(g => g.querySelectorAll('.mplis-hauto-btn').forEach(b => {
            b.onclick = () => {
                const muc = MUC_TOC_DO.find(m => m.key === b.dataset.tocdo) || MUC_TOC_DO[0];
                datTocDo(muc.delay);
            };
        }));
        if (tocDoSlider) tocDoSlider.oninput = () => datTocDo(tocDoSlider.value);
        if (nhomTocDo.length || tocDoSlider) veTocDo(pCfg.delayAction || 500);


        // Bypass toggles: cả 2 đọc localStorage mỗi request nên đổi áp dụng ngay, không cần F5.
        function veBypassCardState() {
            const kg = (document.getElementById('chk-bypass-kg') || {}).checked;
            const dakyso = (document.getElementById('chk-bypass-dakyso') || {}).checked;
            const count = (kg ? 1 : 0) + (dakyso ? 1 : 0);
            veBadge('bypass-card-state', count === 0 ? 'Tất cả tắt' : count === 1 ? '1 bypass bật' : '2 bypass bật', count > 0);
        }

        const chkBypassSpatialLink = document.getElementById('chk-bypass-kg');
        if (chkBypassSpatialLink) {
            chkBypassSpatialLink.onchange = (e) => {
                localStorage.setItem('mplis_bypass_spatial_link_enabled', e.target.checked ? 'true' : 'false');
                veBypassCardState();
            };
        }

        const chkBypassDaKySo = document.getElementById('chk-bypass-dakyso');
        if (chkBypassDaKySo) {
            chkBypassDaKySo.onchange = (e) => {
                localStorage.setItem('mplis_bypass_dakyso_enabled', e.target.checked ? 'true' : 'false');
                veBypassCardState();
            };
        }

        veBypassCardState();

        if (localStorage.getItem('mplis_auto_minimized') === 'true') panel.classList.add('minimized');

        // --- Events ---
        document.getElementById('mplis-btn-minimize').onclick = () => { panel.classList.add('minimized'); localStorage.setItem('mplis_auto_minimized', 'true'); };
        document.getElementById('mplis-btn-maximize').onclick = () => { panel.classList.remove('minimized'); localStorage.setItem('mplis_auto_minimized', 'false'); };

        // Tabs
        document.querySelectorAll('.mplis-tab').forEach(tab => {
            tab.onclick = () => {
                const content = document.querySelector('.mplis-content');
                const startHeight = content.getBoundingClientRect().height;

                document.querySelectorAll('.mplis-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.mplis-panel-body').forEach(b => b.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.getAttribute('data-tab');
                document.getElementById(targetId).classList.add('active');

                // Các tab có độ dài nội dung khác nhau rất nhiều (VD: "Xử lý quy trình" dài hơn hẳn
                // "Trả hồ sơ"), nên đổi tab tức thì làm cả khung panel (neo theo "bottom") nhảy cao/thấp
                // đột ngột, nhìn giật. Thay vì chặn cứng 1 chiều cao, đo chiều cao thật của tab mới rồi
                // chuyển min-height mượt từ chiều cao cũ sang chiều cao mới (kỹ thuật FLIP).
                content.style.transition = 'none';
                content.style.minHeight = '0px';
                const endHeight = content.scrollHeight;
                content.style.minHeight = startHeight + 'px';
                void content.offsetHeight; // ép trình duyệt áp dụng ngay chiều cao cũ trước khi bật lại transition
                content.style.transition = '';
                requestAnimationFrame(() => { content.style.minHeight = endHeight + 'px'; });

                // Pause the other tools automatically when switching tabs
                if (targetId === 'tab-process') {
                    if (ReturnModule.getTopState()?.isRunning) toggleReturn();
                } else if (targetId === 'tab-return') {
                    if (ProcessModule.getTopState()?.isRunning) toggleProcess();
                }
            };
        });

        // Ẩn/hiện 3 tab ít dùng (Trả hồ sơ, Auto sửa Thửa/Tờ, Cài đặt) — mặc định ẩn, bấm nút 3 chấm để hiện lại khi cần
        const extraTabs = document.querySelectorAll('.mplis-tab-extra');
        const btnToggleExtra = document.getElementById('mplis-btn-toggle-extra');
        function setExtraTabsVisible(visible) {
            extraTabs.forEach(t => { t.style.display = visible ? '' : 'none'; });
            if (btnToggleExtra) {
                btnToggleExtra.classList.toggle('expanded', visible);
                btnToggleExtra.title = visible ? 'Ẩn bớt tab' : 'Hiện thêm tab';
            }
            localStorage.setItem('mplis_extra_tabs_visible', visible ? 'true' : 'false');
        }
        let extraTabsVisible = localStorage.getItem('mplis_extra_tabs_visible') === 'true';
        setExtraTabsVisible(extraTabsVisible);
        if (btnToggleExtra) {
            btnToggleExtra.onclick = () => {
                extraTabsVisible = !extraTabsVisible;
                setExtraTabsVisible(extraTabsVisible);
                // Nếu vừa ẩn đi mà tab đang mở lại chính là 1 trong 2 tab đó, tự quay về tab Xử lý quy trình
                if (!extraTabsVisible) {
                    const activeExtra = Array.from(extraTabs).find(t => t.classList.contains('active'));
                    if (activeExtra) document.querySelector('.mplis-tab[data-tab="tab-process"]').click();
                }
            };
        }

        // Config Process
        document.getElementById('chk-qt5').onchange = (e) => {
            const checked = e.target.checked;
            document.getElementById('fw-user-group').style.display = checked ? 'block' : 'none';
            ProcessModule.saveConfig({ isQT5: checked });
        };

        document.getElementById('cfg-p-forwardUser').oninput = (e) => {
            const user = e.target.value.trim();
            const stateEl = document.getElementById('fw-user-state');
            stateEl.textContent = fwUserState(user);
            stateEl.classList.toggle('on', !!user);
            ProcessModule.saveConfig({ forwardUser: user });
        };

        // Nhớ trạng thái đóng/mở qua F5, giống cách nút 3 chấm nhớ mplis_extra_tabs_visible
        // Upload folder picker
        const folderPickerEl = document.getElementById('mplis-folder-picker');
        const btnChonThuMuc = document.getElementById('btn-chon-thu-muc');
        const btnXoaThuMuc = document.getElementById('btn-xoa-thu-muc');
        const uploadStatusEl = document.getElementById('qt-upload-files-status');
        const uploadStateEl = document.getElementById('qt-upload-state');
        const soChuSoGroup = document.getElementById('qt-upload-sochuso-group');

        function veUploadState(files) {
            const n = files ? files.length : 0;
            if (n > 0) {
                const preview = files.slice(0, 3).map(f => f.name).join(', ');
                if (uploadStatusEl) uploadStatusEl.textContent = n + ' file: ' + preview + (n > 3 ? ' ... (+' + (n - 3) + ')' : '');
                if (uploadStateEl) { uploadStateEl.textContent = n + ' file'; uploadStateEl.classList.add('on'); }
            } else {
                if (uploadStatusEl) uploadStatusEl.textContent = '';
                if (uploadStateEl) { uploadStateEl.textContent = 'Chưa chọn'; uploadStateEl.classList.remove('on'); }
            }
        }

        function veSoChuSo(n) {
            if (!soChuSoGroup) return;
            soChuSoGroup.querySelectorAll('.mplis-hauto-btn').forEach(b => {
                const on = parseInt(b.dataset.sochuso) === n;
                b.setAttribute('aria-checked', on ? 'true' : 'false');
                b.classList.toggle('on', on);
            });
        }

        veSoChuSo(pCfg.qt2SoChuSo || 3);

        if (soChuSoGroup) {
            soChuSoGroup.querySelectorAll('.mplis-hauto-btn').forEach(b => {
                b.onclick = () => {
                    const n = parseInt(b.dataset.sochuso);
                    ProcessModule.saveConfig({ qt2SoChuSo: n });
                    veSoChuSo(n);
                };
            });
        }

        if (btnChonThuMuc && folderPickerEl) {
            btnChonThuMuc.onclick = () => folderPickerEl.click();
            folderPickerEl.onchange = () => {
                const files = Array.from(folderPickerEl.files || []);
                const ts = ProcessModule.getTopState();
                if (ts) ts.uploadFolderFiles = files;
                veUploadState(files);
                folderPickerEl.value = '';
            };
        }

        if (btnXoaThuMuc) {
            btnXoaThuMuc.onclick = () => {
                const ts = ProcessModule.getTopState();
                if (ts) ts.uploadFolderFiles = [];
                veUploadState(null);
            };
        }

        veUploadState(null);

        bindCollapse('proc-log-group', 'proc-log-toggle', 'mplis_proc_log_open');

        document.getElementById('btn-proc-log-copy').onclick = () => {
            const ts = ProcessModule.getTopState();
            const lines = (ts && ts.logBuffer || []).map(e => {
                const hh = new Date(e.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return '[' + hh + '] ' + e.msg;
            }).join('\n');
            if (!lines) return;
            try { GM_setClipboard(lines); } catch (e) {
                const ta = document.createElement('textarea'); ta.value = lines;
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            }
            const btn = document.getElementById('btn-proc-log-copy');
            if (btn) { const old = btn.textContent; btn.textContent = 'Đã copy!'; setTimeout(() => btn.textContent = old, 1800); }
        };

        document.getElementById('btn-proc-log-clear').onclick = () => {
            const ts = ProcessModule.getTopState();
            if (ts) ts.logBuffer = [];
            const area = document.getElementById('mplis-log-area-process');
            if (area) area.innerHTML = '';
            const badge = document.getElementById('proc-log-count-process');
            if (badge) badge.textContent = '0';
        };

        bindCollapse('bypass-card', 'bypass-card-toggle', 'mplis_bypass_card_open');
        bindCollapse('qt2-file-group', 'qt2-file-toggle', 'mplis_qt2_file_open');
        bindCollapse('qt-upload-group', 'qt-upload-toggle', 'mplis_qt_upload_open');
        bindCollapse('fw-user-group', 'fw-user-toggle', 'mplis_fw_user_open');
        bindCollapse('set-safe-group', 'set-safe-toggle', 'mplis_set_safe_open');
        bindCollapse('set-autofill-group', 'set-autofill-toggle', 'mplis_set_autofill_open');
        bindCollapse('set-tenfile-group', 'set-tenfile-toggle', 'mplis_set_tenfile_open');
        bindCollapse('set-speed-group', 'set-speed-toggle', 'mplis_set_speed_open');
        bindCollapse('set-keys-group', 'set-keys-toggle', 'mplis_set_keys_open');
        bindCollapse('set-log-group', 'set-log-toggle', 'mplis_set_log_open');

        function veLogState() {
            const n = getLogCount();
            const el = document.getElementById('set-log-state');
            if (el) { el.textContent = n + ' mục'; el.classList.toggle('on', n > 0); }
            const preview = document.getElementById('log-preview');
            if (preview) {
                if (n === 0) {
                    preview.textContent = 'Chưa có dữ liệu. Thao tác trên trang để ghi log.';
                } else {
                    try {
                        const all = JSON.parse(getLogJson());
                        preview.textContent = all.slice(-8).map(e => {
                            const time = new Date(e.t).toLocaleTimeString('vi-VN');
                            if (e.type === 'fetch') return `[${time}] ${e.method} ${e.ep} → ${e.status}`;
                            if (e.type === 'jsError') return `[${time}] ERR ${e.msg}`;
                            if (e.type === 'rejection') return `[${time}] REJECT ${e.msg?.slice(0, 60)}`;
                            return `[${time}] ${e.type} ${e.action || ''}`;
                        }).join('\n');
                    } catch {}
                }
            }
        }

        document.getElementById('btn-log-copy').onclick = () => {
            try {
                GM_setClipboard(getLogJson());
                const btn = document.getElementById('btn-log-copy');
                if (btn) { btn.textContent = 'Đã copy!'; setTimeout(() => { btn.textContent = 'Copy log'; }, 1800); }
            } catch (e) { alert('Copy thất bại: ' + e.message); }
        };
        document.getElementById('btn-log-clear').onclick = () => {
            clearLog();
            veLogState();
        };

        const chkLogEnabled = document.getElementById('chk-log-enabled');
        if (chkLogEnabled) {
            chkLogEnabled.checked = isLogEnabled();
            chkLogEnabled.onchange = () => setLogEnabled(chkLogEnabled.checked);
        }

        // Cập nhật preview khi mở log card
        document.getElementById('set-log-toggle')?.addEventListener('click', () => {
            setTimeout(veLogState, 50);
        });
        // Cập nhật số mục mỗi 5s khi đang mở tab settings
        setInterval(() => {
            const settingsTab = document.getElementById('tab-settings');
            if (settingsTab && settingsTab.classList.contains('active')) veLogState();
        }, 5000);

        document.getElementById('chk-qt2-selectall').onchange = (e) => {
            const checked = e.target.checked;
            document.getElementById('qt2-file-hint').textContent = qt2FileHint(checked);
            const stateEl = document.getElementById('qt2-file-state');
            stateEl.textContent = qt2FileState(checked);
            stateEl.classList.toggle('on', checked);
            ProcessModule.saveConfig({ qt2SelectAllFiles: checked });
        };

        document.querySelectorAll('input[name="mplis-workflow"]').forEach(cb => {
            cb.onchange = () => {
                const checked = Array.from(document.querySelectorAll('input[name="mplis-workflow"]:checked')).map(c => c.value);
                ProcessModule.saveConfig({ activeWorkflows: checked });
                // Ô "Chọn hết file" chỉ có nghĩa khi QT2 đang chạy - ẩn đi cho đỡ rối khi tắt QT2
                const qt2Group = document.getElementById('qt2-file-group');
                if (qt2Group) qt2Group.style.display = checked.includes('QT2') ? 'block' : 'none';
                // Bypass card: hiện khi QT2 hoặc QT4 bật; mỗi row hiện/ẩn theo QT tương ứng
                const hasQT2 = checked.includes('QT2'), hasQT4 = checked.includes('QT4');
                const bypassCard = document.getElementById('bypass-card');
                if (bypassCard) bypassCard.style.display = (hasQT2 || hasQT4) ? 'block' : 'none';
                const rowDakyso = document.getElementById('bypass-row-dakyso');
                if (rowDakyso) rowDakyso.style.display = hasQT2 ? 'flex' : 'none';
                const rowKg = document.getElementById('bypass-row-kg');
                if (rowKg) rowKg.style.display = hasQT4 ? 'flex' : 'none';
            };
        });

        document.getElementById('btn-toggle-process').onclick = toggleProcess;
        document.getElementById('btn-toggle-return').onclick = toggleReturn;


        AlertModule.init();
        ExcelModule.init();
        UpdateParcelModule.init();
    }

export { injectPanel };
