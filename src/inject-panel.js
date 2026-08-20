import { ProcessModule } from './process-module.js';
import { ReturnModule } from './return-module.js';
import { UpdateParcelModule } from './update-parcel-module.js';
import { ExcelModule } from './excel-module.js';
import { AlertModule } from './alert-module.js';
import { isAutoConfirmEnabled, escapeHtml } from './utils.js';
import { toggleProcess, toggleReturn } from './toggle.js';

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
                        <div class="mplis-checkbox-group" style="margin-bottom:14px;">
                            <label><input type="checkbox" name="mplis-workflow" value="QT0" ${isQT0}> QT0 · Cập nhật tệp đính kèm</label>
                            <label><input type="checkbox" name="mplis-workflow" value="QT1" ${isQT1}> QT1 · Cập nhật dữ liệu pháp lý</label>
                            <label><input type="checkbox" name="mplis-workflow" value="QT2" ${isQT2}> QT2 · Lưu kho hồ sơ quét</label>
                            <label><input type="checkbox" name="mplis-workflow" value="QT3" ${isQT3}> QT3 · Ký số sổ địa chính</label>
                            <label><input type="checkbox" name="mplis-workflow" value="QT4" ${isQT4}> QT4 · Kết ISO</label>
                            <label><input type="checkbox" id="chk-qt5" ${pCfg.isQT5 ? 'checked' : ''}> QT5 · Chuyển tiếp hồ sơ</label>
                        </div>

                        <div class="mplis-card mplis-collapse" id="qt2-file-group" style="display: ${isQT2 ? 'block' : 'none'};">
                            <button type="button" class="mplis-collapse-head" id="qt2-file-toggle" aria-expanded="false" aria-controls="qt2-file-body">
                                <span class="mplis-section-label">QT2 · Bảng chọn file quét</span>
                                <span class="mplis-collapse-state ${pCfg.qt2SelectAllFiles ? 'on' : ''}" id="qt2-file-state">${qt2FileState(pCfg.qt2SelectAllFiles)}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="qt2-file-body">
                                <div class="mplis-checkbox-group">
                                    <label><input type="checkbox" id="chk-qt2-selectall" ${pCfg.qt2SelectAllFiles ? 'checked' : ''}> Chọn hết file trong bảng</label>
                                </div>
                                <div class="mplis-hint" style="margin:8px 0 0;" id="qt2-file-hint">${qt2FileHint(pCfg.qt2SelectAllFiles)}</div>
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

                        <button class="mplis-btn-primary" id="btn-toggle-process">▶ Bắt đầu Xử Lý</button>
                        <div class="mplis-status-bar">
                            <div class="mplis-status-row">
                                <div class="mplis-status-lbl"><span class="mplis-status-dot" id="mplis-status-dot-process"></span><span id="mplis-status-text-process">Đang dừng</span></div>
                                <div style="color: var(--mplis-text-dim);">Thành công: <span id="mplis-counter-val-process" style="color: var(--mplis-accent-2); font-weight: bold;">0</span></div>
                            </div>
                            <div class="mplis-log" id="mplis-step-log-process">Sẵn sàng</div>
                        </div>
                    </div>

                    <!-- TAB 2: ALERT -->
                    <div class="mplis-panel-body" id="tab-alert">
                        <div style="display:flex; gap:4px; background:var(--mplis-surface); padding:4px; border-radius:9px; margin-bottom:12px;">
                            <button class="mplis-filter-tab active" data-step="all" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#fff; cursor:pointer;">Tất cả</button>
                            <button class="mplis-filter-tab" data-step="2" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">2·Xử lý</button>
                            <button class="mplis-filter-tab" data-step="4" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">4·Thế chấp</button>
                            <button class="mplis-filter-tab" data-step="5" style="flex:1; padding:8px 0; font-size:12px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">5·Xác nhận</button>
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
                        <div id="excel-filter-bar" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">
                            <button class="mplis-excel-filter active" data-excel-bucket="all" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Tất cả</button>
                            <button class="mplis-excel-filter" data-excel-bucket="krongnang" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Krông Năng</button>
                            <button class="mplis-excel-filter" data-excel-bucket="phuxuan" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Phú Xuân</button>
                            <button class="mplis-excel-filter" data-excel-bucket="tamgiang" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Tam Giang</button>
                            <button class="mplis-excel-filter" data-excel-bucket="dlieya" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Dliê Ya</button>
                            <button class="mplis-excel-filter" data-excel-bucket="thechap" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Thế chấp</button>
                            <button class="mplis-excel-filter" data-excel-bucket="xacnhan" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Xác nhận</button>
                            <button class="mplis-excel-filter" data-excel-bucket="khac" style="padding:7px 11px; font-size:12px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Khác</button>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                            <button id="btn-toggle-sheet-cfg" class="mplis-btn-ghost" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:8px; flex-shrink:0;" title="Cấu hình link Google Sheet (của tôi)" aria-label="Cấu hình link Google Sheet">${ICON_LINK}</button>
                            <span id="excel-sheet-status" style="font-size:12px; flex:1;"></span>
                        </div>
                        <div id="excel-sheet-cfg-row" style="display:none; align-items:center; gap:6px; margin-bottom:8px;">
                            <label for="cfg-excel-sheet-url" style="font-size:12px; color:var(--mplis-text-dim); flex-shrink:0;">Sheet (của tôi):</label>
                            <input type="text" id="cfg-excel-sheet-url" placeholder="Dán link Web App Google Apps Script..." style="flex:1; min-width:0; padding:7px 8px; background:rgba(0,0,0,0.25); border:1px solid var(--mplis-border); border-radius:6px; color:#f8fafc; font-size:12px;">
                        </div>
                        <div id="excel-account-filter-row" style="display:none; align-items:center; gap:6px; margin-bottom:8px;">
                            <label for="cfg-notify-account-filter" style="font-size:12px; color:var(--mplis-text-dim); flex-shrink:0;">TK lọc (Th.báo HS):</label>
                            <input type="text" id="cfg-notify-account-filter" placeholder="VD: dla.vietpq (để trống = không lọc)" style="flex:1; min-width:0; padding:7px 8px; background:rgba(0,0,0,0.25); border:1px solid var(--mplis-border); border-radius:6px; color:#f8fafc; font-size:12px;">
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            <button id="btn-notify-poll-status" class="mplis-btn-primary" style="flex:1; padding:9px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:7px; background:linear-gradient(135deg,#0ea5e9,#0284c7);" title="Tra lại trạng thái thời gian thực cho toàn bộ hồ sơ đang theo dõi ở 'Thông báo nhận HS'">${ICON_REFRESH}Tra trạng thái hồ sơ</button>
                        </div>
                        <div id="notify-poll-status" style="font-size:12px; color:var(--mplis-text-dim); margin-bottom:8px;"></div>
                        <div style="font-size:12px; color:var(--mplis-text-dim); margin-bottom:10px;">Số hồ sơ trong bảng: <b id="excel-count" style="color:#fde047;">0</b> · tự động quét khi mở QT</div>
                        <div style="max-height:170px; overflow-y:auto; margin-bottom:10px; border:1px solid var(--mplis-border); border-radius:10px;">
                            <table id="table-excel-cart" style="width:100%; font-size:12px; color:#f8fafc; border-collapse:collapse; text-align:center;">
                                <thead>
                                    <tr style="background:rgba(255,255,255,0.06);" id="table-excel-cart-head"></tr>
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
                    <div class="mplis-panel-body" id="tab-settings">
                        <span class="mplis-section-label">An toàn</span>
                        <div class="mplis-card">
                            <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:12px; color:#e2e8f0;">
                                <input type="checkbox" id="chk-auto-confirm" ${isAutoConfirmChecked} style="margin-top:2px;">
                                <span>
                                    Tự động chấp nhận mọi hộp thoại confirm()/alert() của trang<br/>
                                    <span style="color:var(--mplis-text-dim); font-size:12px;">Tắt nếu bạn muốn tự tay xác nhận từng hộp thoại quan trọng (VD: ký số, kết ISO). Cần <b>tải lại trang</b> để áp dụng thay đổi.</span>
                                </span>
                            </label>
                        </div>

                        <span class="mplis-section-label">Phím tắt</span>
                        <div class="mplis-card" style="font-size:11.5px; color:#cbd5e1; line-height:2;">
                            <div><b style="color:#fff;">Alt + S</b> — Bật/tắt tab đang mở (Xử lý hoặc Trả hồ sơ)</div>
                            <div><b style="color:#fff;">Alt + H</b> — Ẩn/hiện bảng điều khiển</div>
                        </div>

                        <span class="mplis-section-label">Tự điền sẵn</span>
                        <div class="mplis-card" style="margin-bottom:0;">
                            <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:12px; color:#e2e8f0;">
                                <input type="checkbox" id="chk-phaply-autofill" ${isPhapLyAutofillChecked} style="margin-top:2px;">
                                <span>
                                    Tự điền màn hình Cập nhật pháp lý<br/>
                                    <span style="color:var(--mplis-text-dim); font-size:12px;">Tích "Chính thức có pháp lý", chọn Loại GCN năm 2024, điền Người ký theo CB chuyển và Ngày vào sổ là hôm nay. Sửa tay đè lên lúc nào cũng được. Tắt thì để nguyên form, tự điền tay hết.</span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

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
                if (notice) notice.textContent = '⚠️ Đã lưu. Tải lại trang (F5) để áp dụng thay đổi.';
            };
        }

        // phaply-default.js đọc localStorage mỗi vòng quét (1s) chứ không đọc 1 lần lúc tải trang,
        // nên đổi công tắc này áp dụng ngay - không cần F5 như ô auto-confirm ở trên.
        const chkPhapLyAutofill = document.getElementById('chk-phaply-autofill');
        if (chkPhapLyAutofill) {
            chkPhapLyAutofill.onchange = (e) => {
                localStorage.setItem('mplis_phaply_autofill_enabled', e.target.checked ? 'true' : 'false');
            };
        }

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
        bindCollapse('qt2-file-group', 'qt2-file-toggle', 'mplis_qt2_file_open');
        bindCollapse('fw-user-group', 'fw-user-toggle', 'mplis_fw_user_open');

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
            };
        });

        document.getElementById('btn-toggle-process').onclick = toggleProcess;
        document.getElementById('btn-toggle-return').onclick = toggleReturn;


        AlertModule.init();
        ExcelModule.init();
        UpdateParcelModule.init();
    }

export { injectPanel };
