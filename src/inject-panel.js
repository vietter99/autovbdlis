import { ProcessModule } from './process-module.js';
import { ReturnModule } from './return-module.js';
import { UpdateParcelModule } from './update-parcel-module.js';
import { ExcelModule } from './excel-module.js';
import { AlertModule } from './alert-module.js';
import { isAutoConfirmEnabled } from './utils.js';
import { toggleProcess, toggleReturn } from './toggle.js';

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

        panel.innerHTML = `
            <div class="mplis-panel-header">
                <div class="mplis-panel-title">
                    <span class="mplis-logo">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </span>
                    MPLIS AUTO <span class="mplis-author-tag">by Việt · v8</span>
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
                    <button class="mplis-tab active" data-tab="tab-process" title="Xử lý Quy trình">⚙️</button>
                    <button class="mplis-tab" data-tab="tab-alert" title="Nhắc nhở hồ sơ trễ hạn">⏰</button>
                    <button class="mplis-tab" data-tab="tab-excel" title="Xuất dữ liệu Excel">📊</button>
                    <button class="mplis-tab mplis-tab-extra" data-tab="tab-return" title="Trả hồ sơ" style="display:none;">📬</button>
                    <button class="mplis-tab mplis-tab-extra" data-tab="tab-update" title="Auto sửa Thửa/Tờ" style="display:none;">🔄</button>
                    <button class="mplis-tab mplis-tab-extra" data-tab="tab-settings" title="Cài đặt" style="display:none;">🛠️</button>
                    <button class="mplis-tab-toggle" id="mplis-btn-toggle-extra" title="Hiện thêm tab">⋯</button>
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

                        <div class="mplis-card" id="fw-user-group" style="display: ${pCfg.isQT5 ? 'block' : 'none'};">
                            <span class="mplis-section-label">Chuyển tiếp (sau khi Kết ISO)</span>
                            <input type="text" id="cfg-p-forwardUser" value="${pCfg.forwardUser || ''}" placeholder="Tên tài khoản, VD: dla.thoitd" style="background: rgba(0,0,0,0.25); border: 1px solid var(--mplis-border); border-radius: 8px; padding: 8px 10px; color: #f8fafc; width: 100%; font-size: 12px;">
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
                            <button class="mplis-filter-tab active" data-step="all" style="flex:1; padding:6px 0; font-size:11px; border:none; background:transparent; border-radius:6px; color:#fff; cursor:pointer;">Tất cả</button>
                            <button class="mplis-filter-tab" data-step="2" style="flex:1; padding:6px 0; font-size:11px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">2·Xử lý</button>
                            <button class="mplis-filter-tab" data-step="4" style="flex:1; padding:6px 0; font-size:11px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">4·Thế chấp</button>
                            <button class="mplis-filter-tab" data-step="5" style="flex:1; padding:6px 0; font-size:11px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">5·Xác nhận</button>
                            <button class="mplis-filter-tab" data-step="iso" style="flex:1; padding:6px 0; font-size:11px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer;">Kết ISO</button>

                        </div>

                        <div style="display:flex; justify-content:space-between; margin-bottom: 12px; font-size: 11px; color: var(--mplis-text-dim);">
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
                            <button class="mplis-filter-tab mplis-excel-filter active" data-excel-bucket="krongnang" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Krông Năng</button>
                            <button class="mplis-filter-tab mplis-excel-filter" data-excel-bucket="phuxuan" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Phú Xuân</button>
                            <button class="mplis-filter-tab mplis-excel-filter" data-excel-bucket="tamgiang" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Tam Giang</button>
                            <button class="mplis-filter-tab mplis-excel-filter" data-excel-bucket="dlieya" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Dliê Ya</button>
                            <button class="mplis-filter-tab mplis-excel-filter" data-excel-bucket="khac" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Khác</button>
                            <button class="mplis-filter-tab mplis-excel-filter" data-excel-bucket="thechap" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Thế chấp</button>
                            <button class="mplis-filter-tab mplis-excel-filter" data-excel-bucket="xacnhan" style="padding:5px 9px; font-size:10.5px; border:none; border-radius:6px; background:transparent; color:#94a3b8; cursor:pointer;">Xác nhận</button>
                        </div>
                        <div style="font-size:11px; color:var(--mplis-text-dim); margin-bottom:10px;">Hiển thị/Tổng: <b id="excel-count" style="color:#fde047;">0</b> · tự động quét khi mở QT</div>
                        <div style="max-height:170px; overflow-y:auto; margin-bottom:10px; border:1px solid var(--mplis-border); border-radius:10px;">
                            <table id="table-excel-cart" style="width:100%; font-size:10px; color:#f8fafc; border-collapse:collapse; text-align:center;">
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
                        <textarea id="update-excel-input" placeholder="Số phát hành, Tờ mới, Thửa mới, Tờ cũ, Thửa cũ" style="background: rgba(0,0,0,0.25); border: 1px solid var(--mplis-border); border-radius: 8px; padding: 8px; color: #f8fafc; width: 100%; height: 60px; font-size: 10px; resize:none; margin-bottom:8px;"></textarea>
                        <div style="display:flex; gap:6px; margin-bottom:10px;">
                            <button class="mplis-btn-primary" id="btn-update-parse" style="flex:1; background:linear-gradient(135deg,#3b82f6,#2563eb); font-size:11px; padding:8px;">Nạp dữ liệu</button>
                            <button class="mplis-btn-primary" id="btn-update-start" style="flex:1; background:linear-gradient(135deg,#10b981,#059669); font-size:11px; padding:8px;" disabled>Bắt đầu</button>
                            <button class="mplis-btn-primary" id="btn-update-stop" style="flex:1; background:linear-gradient(135deg,#f43f5e,#e11d48); font-size:11px; padding:8px; display:none;">Dừng lại</button>
                        </div>
                        <div class="mplis-status-bar">
                            <div class="mplis-status-row">
                                <div class="mplis-status-lbl">Tiến độ: <span id="stat-current" style="color:var(--mplis-accent-2); font-weight:bold;">0</span> / <span id="stat-total">0</span></div>
                                <div style="color: var(--mplis-text-dim);"><span class="mplis-status-dot" id="update-dot"></span><span id="stat-status">Chưa bắt đầu</span></div>
                            </div>
                            <div class="mplis-log" id="vbdlis-logs" style="height: 60px; overflow-y:auto; white-space:pre-wrap; font-family: monospace; font-size: 9px; line-height: 1.4;">Sẵn sàng</div>
                        </div>
                        <div style="max-height:100px; overflow-y:auto; margin-top:10px; border:1px solid var(--mplis-border); border-radius:8px;">
                            <table style="width:100%; font-size:10px; color:#f8fafc; border-collapse:collapse; text-align:left;">
                                <tbody id="result-table-body"></tbody>
                            </table>
                        </div>
                        <button class="mplis-btn-primary mplis-btn-ghost" id="btn-update-copy" style="width:100%; margin-top:8px; font-size:11px; padding:8px; box-shadow:none;">📋 Copy trạng thái gốc</button>
                    </div>

                    <!-- TAB 6: SETTINGS -->
                    <div class="mplis-panel-body" id="tab-settings">
                        <span class="mplis-section-label">An toàn</span>
                        <div class="mplis-card">
                            <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:12px; color:#e2e8f0;">
                                <input type="checkbox" id="chk-auto-confirm" ${isAutoConfirmChecked} style="margin-top:2px;">
                                <span>
                                    Tự động chấp nhận mọi hộp thoại confirm()/alert() của trang<br/>
                                    <span style="color:var(--mplis-text-dim); font-size:11px;">Tắt nếu bạn muốn tự tay xác nhận từng hộp thoại quan trọng (VD: ký số, kết ISO). Cần <b>tải lại trang</b> để áp dụng thay đổi.</span>
                                </span>
                            </label>
                        </div>

                        <span class="mplis-section-label">Phím tắt</span>
                        <div class="mplis-card" style="font-size:11.5px; color:#cbd5e1; line-height:2;">
                            <div><b style="color:#fff;">Alt + S</b> — Bật/tắt tab đang mở (Xử lý hoặc Trả hồ sơ)</div>
                            <div><b style="color:#fff;">Alt + H</b> — Ẩn/hiện bảng điều khiển</div>
                        </div>

                        <span class="mplis-section-label">Thông tin</span>
                        <div class="mplis-card mplis-hint" style="margin-bottom:0;">
                            Phiên bản 8.0 — giữ nguyên toàn bộ logic tự động hóa của bản 7.0, chỉ thiết kế lại giao diện và bổ sung các lớp an toàn hiển thị (escape dữ liệu, công tắc auto-confirm).
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
                    notice.style.cssText = 'margin-top:8px; font-size:11px; color:#f59e0b; font-weight:600;';
                    settingsTab.insertBefore(notice, settingsTab.children[1]);
                }
                if (notice) notice.textContent = '⚠️ Đã lưu. Tải lại trang (F5) để áp dụng thay đổi.';
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

        // Ẩn/hiện 3 tab ít dùng (Trả hồ sơ, Auto sửa Thửa/Tờ, Cài đặt) — mặc định ẩn, bấm nút "⋯" để hiện lại khi cần
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
            ProcessModule.saveConfig({ forwardUser: e.target.value.trim() });
        };

        document.querySelectorAll('input[name="mplis-workflow"]').forEach(cb => {
            cb.onchange = () => {
                const checked = Array.from(document.querySelectorAll('input[name="mplis-workflow"]:checked')).map(c => c.value);
                ProcessModule.saveConfig({ activeWorkflows: checked });
            };
        });

        document.getElementById('btn-toggle-process').onclick = toggleProcess;
        document.getElementById('btn-toggle-return').onclick = toggleReturn;


        AlertModule.init();
        ExcelModule.init();
        UpdateParcelModule.init();
    }

export { injectPanel };
