import { topWin, clickElement, isSystemLoading } from './utils.js';
import { createModuleRuntime } from './module-runtime.js';

    const ReturnModule = (function () {
        const defaultConfig = { delayOpen: 500, delayAction: 500, delayNext: 500 };

        const { getTopState, writeLog, updateStatus, incrementSuccess, setLastActionTime, saveConfig } = createModuleRuntime({
            globalStateKey: 'MPLIS_AUTO_TRAHOSO_STATE',
            configStorageKey: 'mplis_auto_trahoso_config',
            defaultConfig,
            logPrefix: '[MPLIS TraHoSo] ',
            domSuffix: 'return'
        });

        async function scanAndExecute() {
            try {
                const topState = getTopState();
                if (!topState || !topState.isRunning) return;

                const now = Date.now();
                const lockDuration = topState.currentLockDuration || 1200;
                if (topState.lastActionTime && (now - topState.lastActionTime < lockDuration)) return;

                if (isSystemLoading()) {
                    updateStatus("Hệ thống đang xử lý...", "waiting");
                    return;
                }

                // 1. Kiểm tra hộp thoại xác nhận "Bạn có thật sự muốn trả hồ sơ hay không?"
                const jconfirmBox = document.querySelector('.jconfirm-box');
                if (jconfirmBox) {
                    const jcRect = jconfirmBox.getBoundingClientRect();
                    if (jcRect.width > 0 && jcRect.height > 0) {
                        const jcMessage = (jconfirmBox.querySelector('.jconfirm-content, .jconfirm-message') || {}).textContent || '';
                        if (jcMessage.toLowerCase().includes('thật sự muốn trả hồ sơ')) {
                            const agreeBtn = jconfirmBox.querySelector('.jconfirm-buttons .btn-orange, .jconfirm-buttons button:first-child');
                            if (agreeBtn) {
                                setLastActionTime(now, topState.config.delayNext);
                                writeLog("Phát hiện hộp thoại trả hồ sơ. Bấm 'Đồng ý'...");
                                clickElement(agreeBtn);
                                incrementSuccess();
                                updateStatus("Đang xử lý trả...", "waiting");
                                return;
                            }
                        }
                    }
                }

                // 1.5. Kiểm tra form Trả hồ sơ có nút "Thực hiện" (#btnLuuTraHoSo)
                const btnLuuTraHoSo = document.querySelector('#btnLuuTraHoSo');
                if (btnLuuTraHoSo && (() => { try { return btnLuuTraHoSo.getBoundingClientRect().width > 0; } catch (e) { return false; } })()) {
                    if (!btnLuuTraHoSo.hasAttribute('data-mplis-clicked')) {
                        setLastActionTime(now, topState.config.delayAction);
                        btnLuuTraHoSo.setAttribute('data-mplis-clicked', 'true');
                        writeLog("Bấm 'Thực hiện' lưu trả hồ sơ...");
                        clickElement(btnLuuTraHoSo);
                        updateStatus("Chờ xác nhận...", "waiting");
                        return;
                    } else {
                        updateStatus("Đợi xác nhận...", "waiting");
                        return; // Đang chờ hộp thoại jconfirm hiện ra
                    }
                }

                // 2. Kiểm tra bảng "Quy trình xử lý" (hiện lên sau khi bấm Xử lý hồ sơ)
                const btnXuLyTacVuList = Array.from(document.querySelectorAll('.btnXuLyTacVu[data-actioncode="TraHoSo"]'));
                const visibleBtnXuLyTacVu = btnXuLyTacVuList.filter(el => {
                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                });

                if (visibleBtnXuLyTacVu.length > 0) {
                    const btn = visibleBtnXuLyTacVu[0];
                    const tr = btn.closest('tr');
                    if (tr) {
                        const checkbox = tr.querySelector('input[type="checkbox"]');
                        if (checkbox && checkbox.checked) {
                            // Nếu đã được tích thì có thể bỏ qua hoặc đóng bảng
                            const closeBtn = document.querySelector('button.close, .modal-header .close, button[data-dismiss="modal"]');
                            if (closeBtn && (() => { try { return closeBtn.getBoundingClientRect().width > 0; } catch (e) { return false; } })()) {
                                if (!closeBtn.hasAttribute('data-mplis-clicked')) {
                                    closeBtn.setAttribute('data-mplis-clicked', 'true');
                                    setLastActionTime(now, topState.config.delayNext);
                                    writeLog("Đã xử lý xong tác vụ. Đóng bảng...");
                                    clickElement(closeBtn);
                                    return;
                                }
                            }
                        } else if (!btn.hasAttribute('data-mplis-clicked')) {
                            setLastActionTime(now, topState.config.delayAction);
                            btn.setAttribute('data-mplis-clicked', 'true');
                            writeLog("Bấm 'Xử lý tác vụ' cho 'Trả hồ sơ'...");
                            clickElement(btn);
                            updateStatus("Chờ xác nhận...", "waiting");
                            return;
                        } else {
                            updateStatus("Đợi xác nhận...", "waiting");
                            return;
                        }
                    }
                }

                // 3. Nếu đang mở bảng Quy trình mà KHÔNG CÓ nút Xử lý tác vụ của Trả hồ sơ, hoặc không hiện,
                // Cần kiểm tra xem có modal nào đang mở không, nếu có thì đừng chọn hồ sơ khác.
                const isAnyModalOpen = Array.from(document.querySelectorAll('.modal.in, .modal.show, .k-window, .ui-dialog, .dx-popup-content')).some(el => {
                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                });
                if (isAnyModalOpen) {
                    updateStatus("Đang mở bảng...", "waiting");
                    return;
                }

                // 4. Tìm hồ sơ ở màn hình chính
                const rows = Array.from(document.querySelectorAll('tr'));
                let targetRow = null;
                let hasAnyTargetInTable = false;
                for (const row of rows) {
                    // Bỏ qua các dòng tiêu đề hoặc không hợp lệ
                    if (row.querySelector('th')) continue;
                    try { if (row.getBoundingClientRect().width === 0) continue; } catch (e) { continue; }

                    const rowText = (row.textContent || '').toLowerCase();
                    if (rowText.includes('5. trả kết quả hồ sơ') || rowText.includes('6. trả kết quả hồ sơ') || rowText.includes('9. trả kết quả hồ sơ')) {
                        hasAnyTargetInTable = true;
                        if (row.getAttribute('data-mplis-processed') !== 'true') {
                            targetRow = row;
                            break;
                        }
                    }
                }

                if (targetRow) {
                    if (targetRow.getAttribute('data-mplis-selected') !== 'true') {
                        // Chọn dòng
                        targetRow.setAttribute('data-mplis-selected', 'true');

                        // Click to select
                        const firstTd = targetRow.querySelector('td');
                        if (firstTd) clickElement(firstTd);
                        clickElement(targetRow);

                        const input = targetRow.querySelector('input[type="radio"], input[type="checkbox"]');
                        if (input) {
                            input.checked = true;
                            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
                            clickElement(input);
                        }

                        try {
                            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                            if (win.$) {
                                const $row = win.$(targetRow);
                                $row.click();
                            }
                        } catch (e) { }

                        setLastActionTime(now, 800);
                        writeLog("Đã chọn hồ sơ (5/6/9). Chờ bấm Xử lý hồ sơ...");
                        updateStatus("Chọn hồ sơ...", "waiting");
                        return;
                    } else {
                        // Đã chọn, bấm Xử lý hồ sơ
                        const btnXuly = document.querySelector('#btnXuly') || Array.from(document.querySelectorAll('button, a')).find(el => {
                            const text = (el.textContent || '').trim().toLowerCase();
                            return text === 'xử lý hồ sơ';
                        });

                        if (btnXuly && (() => { try { return btnXuly.getBoundingClientRect().width > 0; } catch (e) { return false; } })()) {
                            setLastActionTime(now, topState.config.delayOpen);
                            writeLog("Bấm 'Xử lý hồ sơ'...");
                            clickElement(btnXuly);
                            targetRow.setAttribute('data-mplis-processed', 'true');
                            updateStatus("Chờ mở bảng...", "waiting");
                            return;
                        } else {
                            updateStatus("Đợi nút Xử lý hồ sơ...", "waiting");
                        }
                    }
                } else {
                    // Không tìm thấy hoặc đã làm xong
                    if (!hasAnyTargetInTable) {
                        writeLog("Không có hồ sơ Trả kết quả (5, 6, 9) nào. Dừng Auto.");
                        updateStatus("Hoàn thành", "idle");
                        if (typeof topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC("🎉 KHÔNG TÌM THẤY HỒ SƠ ĐỂ TRẢ!");
                        return;
                    } else {
                        const hasDone = rows.some(r => r.getAttribute('data-mplis-processed') === 'true');
                        if (hasDone) {
                            // Đã quét xong tất cả các dòng hiện có
                            writeLog("Hoàn thành! Đã quét hết hồ sơ Trả kết quả (5, 6, 9).");
                            updateStatus("Hoàn thành", "idle");
                            if (typeof topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC("🎉 ĐÃ HOÀN THÀNH TOÀN BỘ!");
                            return;
                        }
                    }
                }

                updateStatus("Đang quét...", "active");

            } catch (e) {
                console.error("[MPLIS Auto Trả Hồ Sơ Error] ", e);
            }
        }



        setInterval(scanAndExecute, 1200);

        return {
            getTopState, saveConfig
        };
    })();

export { ReturnModule };
