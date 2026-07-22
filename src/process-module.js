import { topWin, clickElement, isSystemLoading, querySelectorAllCustom } from './utils.js';
import { createModuleRuntime } from './module-runtime.js';

    const ProcessModule = (function () {
        const defaultConfig = {
            activeWorkflows: ["QT0", "QT1", "QT2", "QT3"],
            isQT5: false,
            forwardUser: "",
            delayOpen: 500, delayAction: 500, delayNext: 500,
            selectorMainProcess: "button:contains('Xử lý hồ sơ'), a:contains('Xử lý hồ sơ'), .btn-process",
            selectorExecute: "button:contains('Thực hiện'), button:contains('Cập nhật'), button:contains('Chấp nhận'), button:contains('Đồng ý'), a:contains('Thực hiện')",
            selectorConfirm: "button:contains('Đồng ý'), button:contains('Xác nhận'), button:contains('OK'), button:contains('Có')"
        };

        const { getTopState, writeLog, updateStatus, incrementSuccess, setLastActionTime, saveConfig } = createModuleRuntime({
            globalStateKey: 'MPLIS_AUTO_STATE',
            configStorageKey: 'mplis_auto_config_v4_1',
            defaultConfig,
            logPrefix: '[MPLIS QT] ',
            domSuffix: 'process'
        });

        function getTaskText(tName) {
            if (tName === 'QT1') return 'cập nhật dữ liệu pháp lý';
            if (tName === 'QT2') return 'lưu kho hồ sơ quét';
            if (tName === 'QT3') return 'ký số sổ địa chính';
            if (tName === 'QT4') return 'kết iso';
            return tName.toLowerCase();
        }

        function findTaskProcessButton(taskNames) {
            if (!taskNames || taskNames.length === 0) return null;
            try {
                const rows = Array.from(document.querySelectorAll('tr'));

                // Lặp theo thứ tự ưu tiên của danh sách quy trình được chọn (VD: QT1 xong mới tới QT3)
                for (const tCode of taskNames) {
                    if (tCode === 'QT0') continue; // QT0 là tác vụ ngoại lệ không nằm trong bảng Quy trình xử lý
                    const tName = getTaskText(tCode);
                    for (const row of rows) {
                        const rowText = (row.textContent || '').toLowerCase();
                        if (rowText.includes(tName)) {
                            let isDone = false;
                            const checkbox = row.querySelector('input[type="checkbox"]');
                            if (checkbox && checkbox.checked) isDone = true;
                            if (rowText.includes('đã xử lý') || rowText.includes('hoàn thành')) isDone = true;
                            if (row.querySelector('.k-i-check, .fa-check, img[src*="check"], .dx-icon-check')) isDone = true;
                            const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
                            if (inputs.some(input => (input.value || '').toLowerCase().includes('đã xử lý'))) isDone = true;
                            // Nếu bot đã bấm "Xử lý tác vụ" cho hàng này rồi, coi như đã xong
                            if (row.getAttribute('data-mplis-processed') === 'true') isDone = true;

                            // Nếu tác vụ này chưa làm, lập tức chọn nó
                            if (!isDone) {
                                const interactives = Array.from(row.querySelectorAll('a, button, [role="button"]'));
                                const targetBtn = interactives.find(el => {
                                    const btnText = (el.textContent || el.value || '').trim().toLowerCase();
                                    return btnText.includes('xử lý') || btnText.includes('tác vụ');
                                });
                                if (targetBtn) {
                                    return { button: targetBtn, taskName: tName, isDone: false };
                                }
                            }
                            // Nếu đã làm, tiếp tục vòng lặp để kiểm tra tác vụ tiếp theo trong chuỗi
                        }
                    }
                }

                // Nếu đến đây tức là không tìm thấy tác vụ CHƯA LÀM nào
                // Kiểm tra xem có tác vụ nào trong danh sách đang hiện hữu trên bảng hay không
                let foundAnyTask = false;
                for (const tCode of taskNames) {
                    if (tCode === 'QT0') continue;
                    const tNameText = getTaskText(tCode);
                    for (const row of rows) {
                        if ((row.textContent || '').toLowerCase().includes(tNameText)) {
                            foundAnyTask = true;
                            break;
                        }
                    }
                    if (foundAnyTask) break;
                }
                if (foundAnyTask) {
                    // Đã làm xong tất cả các tác vụ có trên màn hình
                    return { button: null, taskName: "Tất cả quy trình", isDone: true };
                }

            } catch (e) { }
            return null;
        }



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

                // --- KIỂM TRA HỘP THOẠI XÁC NHẬN (jConfirm) ƯU TIÊN CAO NHẤT ---
                const jconfirmBox = document.querySelector('.jconfirm-box');
                if (jconfirmBox) {
                    const jcRect = jconfirmBox.getBoundingClientRect();
                    if (jcRect.width > 0 && jcRect.height > 0) {
                        const jcMessage = (jconfirmBox.querySelector('.jconfirm-content, .jconfirm-message') || {}).textContent || '';
                        const jcTitle = (jconfirmBox.querySelector('.jconfirm-title') || {}).textContent || '';

                        const msgLower = jcMessage.toLowerCase();
                        const titleLower = jcTitle.toLowerCase();

                        const isQT1Confirm = msgLower.includes('cập nhật dữ liệu pháp lý') || titleLower.includes('cập nhật dữ liệu pháp lý');
                        const isQT4Confirm = msgLower.includes('bạn có thật sự muốn kết iso hồ sơ này hay không');
                        const isQT5Confirm = msgLower.includes('chuyển bước') || msgLower.includes('chuyển tiếp') || msgLower.includes('chuyển tác vụ') || msgLower.includes('chuyển');

                        if (isQT1Confirm || isQT4Confirm || isQT5Confirm) {
                            // Tiêu đề hộp cảnh báo của MPLIS thay đổi tùy trường hợp nên không lọc được
                            // bằng từ khóa. Nhưng về nghiệp vụ, 1 lượt bấm "Thực hiện" cập nhật pháp lý (QT1)
                            // chỉ nên hỏi "Đồng ý" ĐÚNG 1 LẦN. Nếu hộp thoại có nút Đồng ý này bật lên
                            // LẦN 2 liên tiếp mà chưa bấm lại "Thực hiện", rất có thể đây là hộp CẢNH BÁO
                            // (VD: dữ liệu bất thường) chứ không phải xác nhận hợp lệ -> dừng để kiểm tra tay.
                            if (isQT1Confirm && (topState.qt1ConfirmStreak || 0) >= 1) {
                                writeLog("⚠️ Hộp 'Đồng ý' cập nhật pháp lý xuất hiện LẦN 2 liên tiếp (tiêu đề: '" + jcTitle.trim() + "'). Có thể là cảnh báo. DỪNG AUTO để kiểm tra.");
                                updateStatus("Nghi cảnh báo - Dừng", "idle");
                                if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: HỘP XÁC NHẬN CẬP NHẬT PHÁP LÝ LẶP LẠI LẦN 2!");
                                return;
                            }

                            // Đúng hộp thoại mong đợi: bấm Đồng ý
                            const agreeBtn = jconfirmBox.querySelector('.jconfirm-buttons .btn-orange, .jconfirm-buttons button:first-child');
                            if (agreeBtn && !agreeBtn.hasAttribute('data-mplis-clicked')) {
                                setLastActionTime(now, topState.config.delayNext);
                                if (isQT4Confirm) writeLog("Phát hiện hộp thoại kết ISO. Bấm 'Đồng ý'...");
                                else if (isQT5Confirm) writeLog("Phát hiện hộp thoại chuyển tiếp. Bấm 'Đồng ý'...");
                                else writeLog("Phát hiện hộp thoại xác nhận cập nhật pháp lý. Bấm 'Đồng ý'...");

                                agreeBtn.setAttribute('data-mplis-clicked', 'true');
                                setTimeout(() => { try { agreeBtn.removeAttribute('data-mplis-clicked'); } catch (e) { } }, 3000); // Thử lại sau 3s nếu kẹt

                                const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
                                if (jq) jq(agreeBtn).click();
                                else clickElement(agreeBtn);

                                if (isQT1Confirm) topState.qt1ConfirmStreak = (topState.qt1ConfirmStreak || 0) + 1;

                                incrementSuccess();
                                updateStatus("Chờ xử lý...", "waiting");
                                return;
                            }
                        } else {
                            // Hộp thoại lạ không mong đợi nhưng có thể là hộp thoại báo thành công
                            if (msgLower.includes('thành công') || titleLower.includes('thành công')) {
                                const okBtn = jconfirmBox.querySelector('.jconfirm-buttons button:first-child');
                                if (okBtn && !okBtn.hasAttribute('data-mplis-clicked')) {
                                    writeLog("Phát hiện hộp thoại báo Thành công. Đóng hộp thoại...");
                                    okBtn.setAttribute('data-mplis-clicked', 'true');
                                    setTimeout(() => { try { okBtn.removeAttribute('data-mplis-clicked'); } catch (e) { } }, 3000);

                                    const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
                                    if (jq) jq(okBtn).click();
                                    else clickElement(okBtn);

                                    setLastActionTime(now, 500);
                                    return;
                                }
                            }

                            // Hộp thoại lạ không mong đợi → DỪNG AUTO
                            writeLog("⚠️ Hộp thoại không mong đợi: '" + jcTitle.trim() + "'. DỪNG AUTO.");
                            updateStatus("Hộp thoại lạ - Dừng", "idle");
                            if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: PHÁT HIỆN HỘP THOẠI LẠ!");
                            return;
                        }
                    }
                }

                // --- KIỂM TRA POPUP XÁC NHẬN LƯU (ĐỒNG Ý/XÁC NHẬN) ƯU TIÊN CAO NHẤT ---
                const confirmBtns = querySelectorAllCustom(topState.config.selectorConfirm);
                const visibleConfirmBtns = confirmBtns.filter(el => {
                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                });

                // Lọc ra các popup có chứa cảnh báo lỗi
                let hasErrorWarning = false;
                let errorText = "";
                const activeModals = Array.from(document.querySelectorAll('.modal.in, .modal.show, .dx-popup-content, .k-window'));
                for (const m of activeModals) {
                    const text = (m.textContent || '').toLowerCase();
                    if (text.includes('sai hồ sơ') || text.includes('có lỗi xảy ra') || text.includes('không hợp lệ') || text.includes('cảnh báo')) {
                        hasErrorWarning = true;
                        errorText = text;
                        break;
                    }
                }

                if (hasErrorWarning && visibleConfirmBtns.length > 0) {
                    writeLog("⚠️ Phát hiện thông báo lỗi lạ/sai hồ sơ. DỪNG AUTO!");
                    updateStatus("Lỗi - Dừng Auto", "idle");
                    if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: PHÁT HIỆN THÔNG BÁO LẠ!");
                    return;
                }

                if (visibleConfirmBtns.length > 0) {
                    const confirmBtn = visibleConfirmBtns[visibleConfirmBtns.length - 1];
                    if (!confirmBtn.hasAttribute('data-mplis-clicked')) {
                        setLastActionTime(now, topState.config.delayNext);
                        writeLog("Phát hiện popup xác nhận. Tự động bấm 'Đồng ý'...");

                        confirmBtn.setAttribute('data-mplis-clicked', 'true');
                        setTimeout(() => { try { confirmBtn.removeAttribute('data-mplis-clicked'); } catch (e) { } }, 3000); // Thử lại sau 3s

                        const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
                        if (jq) jq(confirmBtn).click();
                        else clickElement(confirmBtn);

                        incrementSuccess();
                        updateStatus("Chờ lưu...", "waiting");
                        return;
                    }
                }



                // --- QT0: CHỐT TỆP ĐÍNH KÈM (Bấm Cập nhật -> Đợi Nhập thông tin -> Đóng -> Xử lý hồ sơ) ---
                if (topState.config.activeWorkflows.includes("QT0")) {
                    const btnUpdateAttactFile = document.querySelector('#btnUpdateAttactFile');
                    const tbGiayToDinhKem = document.querySelector('#tbGiayToDinhKem');
                    const isAttachModalOpen = btnUpdateAttactFile && tbGiayToDinhKem && (() => { try { return btnUpdateAttactFile.getBoundingClientRect().width > 0; } catch (e) { return false; } })();

                    // Nếu đang mở modal tệp đính kèm và có nút Cập nhật
                    if (isAttachModalOpen) {
                        if (!topState.qt0Phase || topState.qt0Phase === 0) {
                            if (!btnUpdateAttactFile.hasAttribute('data-mplis-clicked')) {
                                writeLog("Bấm 'Cập nhật' tệp đính kèm...");
                                btnUpdateAttactFile.setAttribute('data-mplis-clicked', 'true');
                                clickElement(btnUpdateAttactFile);
                                topState.qt0Phase = 1;
                                setLastActionTime(now, 1000); // Đợi load file
                                return;
                            }
                        }
                        else if (topState.qt0Phase === 1) {
                            const rows = Array.from(tbGiayToDinhKem.querySelectorAll('tbody tr'));
                            const hasLoadedFiles = rows.some(tr => {
                                const text = tr.textContent.toUpperCase();
                                return text.includes('NHẬP THÔNG TIN') && (text.includes('.PDF') || text.includes('GT.PDF'));
                            });

                            if (hasLoadedFiles) {
                                const btnDongList = Array.from(document.querySelectorAll('.modal-footer button, .panel-footer button')).filter(b => {
                                    try {
                                        if (b.getBoundingClientRect().width === 0) return false;
                                        const t = (b.textContent || '').toLowerCase();
                                        return t.includes('đóng') || b.hasAttribute('data-dismiss');
                                    } catch (e) { return false; }
                                });

                                if (btnDongList.length > 0) {
                                    const btnDongModal = btnDongList[btnDongList.length - 1];
                                    if (!btnDongModal.hasAttribute('data-mplis-clicked')) {
                                        writeLog("Bấm 'Đóng' bảng tệp đính kèm...");
                                        btnDongModal.setAttribute('data-mplis-clicked', 'true');
                                        clickElement(btnDongModal);
                                        topState.qt0Phase = 2; // Sang bước tìm nút Xử lý hồ sơ
                                        setLastActionTime(now, 1000);
                                        return;
                                    }
                                }
                            } else {
                                updateStatus("Đợi file có 'Nhập thông tin'...", "waiting");
                                return;
                            }
                        }
                        else if (topState.qt0Phase === 2) {
                            updateStatus("Chờ bảng đính kèm đóng...", "waiting");
                        }
                        return; // Khoá vòng lặp ở đây nếu đang xử lý modal đính kèm
                    }
                    else if (topState.qt0Phase === 2) {
                        // Modal đã đóng, bây giờ bấm Xử lý hồ sơ ngoài màn hình chính
                        const btnXulyList = Array.from(document.querySelectorAll('button, a')).filter(b => {
                            const t = (b.textContent || b.innerText || '').trim().toLowerCase();
                            return b.id === 'btnXuly' || t === 'xử lý hồ sơ';
                        });

                        const btnXuly = btnXulyList.find(b => { try { return b.getBoundingClientRect().width > 0; } catch (e) { return false; } });

                        if (btnXuly) {
                            if (!btnXuly.hasAttribute('data-mplis-clicked')) {
                                writeLog("Bấm 'Xử lý hồ sơ' chuyển bước...");
                                btnXuly.setAttribute('data-mplis-clicked', 'true');
                                clickElement(btnXuly);
                                topState.qt0Phase = 0; // Reset
                                setLastActionTime(now, topState.config.delayAction);
                                return;
                            }
                        } else {
                            updateStatus("Đợi nút Xử lý hồ sơ...", "waiting");
                            return;
                        }
                    }
                }

                // --- BƯỚC CHUYỂN TIẾP HỒ SƠ (SAU KẾT ISO) ---
                const fwdTable = document.getElementById('frmChuyenTiepHoSo_tbUsers');
                if (fwdTable && topState.config.isQT5 && topState.config.forwardUser) {
                    const isTableVisible = (() => { try { return fwdTable.getBoundingClientRect().width > 0; } catch (e) { return false; } })();
                    if (isTableVisible) {
                        const searchKey = topState.config.forwardUser.toLowerCase();
                        const rows = Array.from(fwdTable.querySelectorAll('tbody tr'));
                        let matchedRow = null;
                        for (const row of rows) {
                            if ((row.textContent || '').toLowerCase().includes(searchKey)) {
                                matchedRow = row;
                                break;
                            }
                        }

                        if (matchedRow) {
                            const checkBtn = matchedRow.querySelector('.chkSelect, .fa-check-circle');
                            if (checkBtn && !checkBtn.hasAttribute('data-mplis-clicked')) {
                                writeLog(`Tìm thấy người nhận '${topState.config.forwardUser}'. Đang chọn...`);
                                checkBtn.setAttribute('data-mplis-clicked', 'true');
                                clickElement(checkBtn);
                                setLastActionTime(now, topState.config.delayAction);
                                return;
                            }

                            // Cố gắng tìm nút submit của bảng
                            const modal = fwdTable.closest('.modal, .k-window, .ui-dialog') || document.body;
                            const submitBtns = Array.from(modal.querySelectorAll('button')).filter(b => {
                                const t = (b.textContent || '').trim().toLowerCase();
                                return t === 'thực thi' || b.id === 'btnExecuteCommand' || t === 'thực hiện' || t === 'chấp nhận' || t === 'chuyển tiếp' || t === 'lưu';
                            });

                            if (submitBtns.length > 0) {
                                const sBtn = submitBtns[submitBtns.length - 1];
                                if (!sBtn.hasAttribute('data-mplis-clicked')) {
                                    writeLog("Bấm 'Thực hiện' chuyển tiếp...");
                                    sBtn.setAttribute('data-mplis-clicked', 'true');
                                    clickElement(sBtn);
                                    setTimeout(() => { try { sBtn.removeAttribute('data-mplis-clicked'); } catch (e) { } }, 5000); // Retry sau 5s
                                    setLastActionTime(now, topState.config.delayNext);
                                    return;
                                } else {
                                    updateStatus("Đợi hoàn tất chuyển tiếp...", "waiting");
                                    return;
                                }
                            }
                        } else {
                            // Không thấy người dùng
                            const reloadBtn = document.getElementById('btnReloadUser');
                            if (reloadBtn && !reloadBtn.hasAttribute('data-mplis-clicked')) {
                                writeLog(`Không thấy '${topState.config.forwardUser}', tải lại danh sách...`);
                                reloadBtn.setAttribute('data-mplis-clicked', 'true');
                                clickElement(reloadBtn);
                                setLastActionTime(now, 2000);
                                return;
                            } else if (reloadBtn && reloadBtn.hasAttribute('data-mplis-clicked')) {
                                writeLog(`⚠️ Không thấy người nhận '${topState.config.forwardUser}'. DỪNG AUTO.`);
                                updateStatus("Lỗi người nhận", "idle");
                                if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: KHÔNG TÌM THẤY NGƯỜI NHẬN!");
                                return;
                            }
                        }
                    }
                }

                // Chống đua lệnh: Chờ bảng chi tiết QT3 mở ra hoàn toàn trước khi làm tiếp
                if (topState.isWaitingForQT3Modal) {
                    // Nút Cập nhật phải nằm trong modal/bảng ĐANG HIỂN THỊ - không tính nút Cập nhật của QT2 đang ẩn trong DOM
                    const isUpdateBtnVisible = Array.from(document.querySelectorAll('.modal.in .modal-body button, .modal.in .modal-body a, .modal.show .modal-body button, .k-window button, .k-window a, .ui-dialog button, .ui-dialog a, .dx-popup-content button')).some(el => {
                        if ((el.textContent || el.innerText || '').trim().toLowerCase() !== 'cập nhật') return false;
                        try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                    }) || Array.from(document.querySelectorAll('button, a')).some(el => {
                        if ((el.textContent || el.innerText || '').trim().toLowerCase() !== 'cập nhật') return false;
                        try {
                            const rect = el.getBoundingClientRect();
                            if (rect.width === 0) return false;
                            // Chắc chắn nút không nằm trong bảng QT2 đang ẩn
                            const qt2Panel = el.closest('[id="wpDonDangKy"], [id="lstDonDangKy"]');
                            if (qt2Panel) return false;
                            return true;
                        } catch (e) { return false; }
                    });
                    if (isUpdateBtnVisible) {
                        topState.isWaitingForQT3Modal = false; // Đã mở thành công
                    } else if (now - topState.lastActionTime > 15000) {
                        topState.isWaitingForQT3Modal = false; // Quá 15s không thấy, huỷ chờ
                        writeLog("Mạng chậm, huỷ chờ bảng chi tiết để quét lại...");
                    } else {
                        updateStatus("Chờ tải bảng...", "waiting");
                        return; // Đang chờ thì khoá vòng lặp
                    }
                }

                // --- BƯỚC CỦA QT3: XỬ LÝ SỔ ĐỊA CHÍNH (CẬP NHẬT / ĐÓNG MODAL) ---
                // isInsideQT3 = true nếu:
                // (A) Nút 'Xem sổ địa chính' đang hiển thị (đang ở trang danh sách thửa), HOẶC
                // (B) Modal chi tiết đang mở che nút đó, nhưng có nút 'Cập nhật' hiển thị bên ngoài QT2
                const isInsideQT3 = Array.from(document.querySelectorAll('button, a')).some(el => {
                    if ((el.textContent || el.innerText || '').trim().toLowerCase() !== 'xem sổ địa chính') return false;
                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                }) || (topState.qt3ModalContext === true && Array.from(document.querySelectorAll('button, a')).some(el => {
                    if ((el.textContent || el.innerText || '').trim().toLowerCase() !== 'cập nhật') return false;
                    try {
                        if (el.getBoundingClientRect().width === 0) return false;
                        if (el.closest('#wpDonDangKy, #lstDonDangKy')) return false;
                        return true;
                    } catch (e) { return false; }
                }));
                const isInsideQT2 = (function () {
                    // Cách 1: Kiểm tra tiêu đề bảng Lưu kho có đang HIỂN THỊ không.
                    const qt2Heading = Array.from(document.querySelectorAll('.panel-heading, .modal-header')).find(el =>
                        (el.textContent || '').toLowerCase().includes('lưu kho hồ sơ')
                    );
                    if (qt2Heading) {
                        try { if (qt2Heading.getBoundingClientRect().width > 0) return true; } catch (e) { }
                    }
                    // Cách 2: Nếu popup chọn file đang mở (che tiêu đề), vẫn coi là đang trong QT2
                    const chkAll = document.querySelector('#chkSelectAll');
                    if (chkAll) {
                        try { if (chkAll.getBoundingClientRect().width > 0) return true; } catch (e) { }
                    }
                    // Cách 3: Nếu form thêm mới đang mở
                    const btnOpenFile = document.querySelector('#btnOpenFormChonFileHoSoQuet');
                    if (btnOpenFile) {
                        try { if (btnOpenFile.getBoundingClientRect().width > 0) return true; } catch (e) { }
                    }
                    // Cách 4: Nếu đang ở form chỉnh sửa (có nút Lưu)
                    const btnLuu = document.querySelector('#btnLuuHoSoQuet');
                    if (btnLuu) {
                        try { if (btnLuu.getBoundingClientRect().width > 0) return true; } catch (e) { }
                    }
                    return false;
                })();

                if (isInsideQT3) {
                    const updateBtns = Array.from(document.querySelectorAll('button, a')).filter(el => {
                        const text = (el.textContent || el.innerText || '').trim().toLowerCase();
                        return text === 'cập nhật';
                    });
                    const visibleUpdateBtns = updateBtns.filter(el => {
                        try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                    });

                    if (visibleUpdateBtns.length > 0) {
                        const updateBtn = visibleUpdateBtns[visibleUpdateBtns.length - 1];
                        if (!updateBtn.hasAttribute('data-mplis-clicked')) {
                            updateBtn.setAttribute('data-mplis-clicked', 'true');
                            setLastActionTime(now, topState.config.delayAction);
                            writeLog("Bấm 'Cập nhật' sổ địa chính...");
                            clickElement(updateBtn);
                            updateStatus("Chờ cập nhật...", "waiting");
                            return;
                        } else {
                            // Đã bấm cập nhật, giờ tìm dấu X để đóng modal
                            const closeBtns = Array.from(document.querySelectorAll('button.close, .modal-header .close'));
                            const visibleCloseBtns = closeBtns.filter(el => {
                                try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                            });
                            if (visibleCloseBtns.length > 0) {
                                const closeBtn = visibleCloseBtns[visibleCloseBtns.length - 1];
                                setLastActionTime(now, topState.config.delayNext);
                                writeLog("Cập nhật xong. Đóng bảng chi tiết (X)...");
                                clickElement(closeBtn);
                                incrementSuccess(); // Thành công 1 thửa
                                topState.qt3ModalContext = false; // Xóa cờ khi đóng modal
                                updateStatus("Chờ lưu...", "waiting");
                                updateBtn.removeAttribute('data-mplis-clicked');
                                return;
                            }
                        }
                    }
                }

                // --- BƯỚC CỦA QT3: CHỌN THỬA ĐẤT VÀ XEM SỔ ĐỊA CHÍNH ---
                const viewBtns = Array.from(document.querySelectorAll('button, a')).filter(el => {
                    const text = (el.textContent || el.innerText || '').trim().toLowerCase();
                    return text === 'xem sổ địa chính';
                });
                const visibleViewBtns = viewBtns.filter(el => {
                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                });
                if (visibleViewBtns.length > 0) {
                    const viewBtn = visibleViewBtns[visibleViewBtns.length - 1];
                    // Lấy vùng chứa (modal) của nút Xem sổ, để tránh lấy nhầm các dòng tr ở màn hình nền
                    const modal = viewBtn.closest('.modal, .modal-dialog, .k-window, .ui-dialog, .dx-popup-content') || document.body;

                    // Kiểm tra bảng trống "Không có thửa đất"
                    const emptyCell = modal.querySelector('.dataTables_empty, td.dataTables_empty');
                    if (emptyCell && emptyCell.textContent.trim().toLowerCase().includes('không có thửa đất')) {
                        writeLog("⚠️ Không có thửa đất nào. DỪNG AUTO.");
                        updateStatus("Không có thửa đất", "idle");
                        if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC();
                        return;
                    }

                    // Chỉ lấy các dòng (tr) hiển thị trên màn hình và nằm trong modal này
                    const rows = Array.from(modal.querySelectorAll('tbody tr')).filter(row => {
                        if (row.classList.contains('k-grouping-row') || row.classList.contains('k-detail-row') || row.querySelector('th')) return false;
                        try { if (row.getBoundingClientRect().width === 0) return false; } catch (e) { }
                        return row.innerText.trim().length > 0;
                    });

                    // Trạng thái 2: Đã chọn thửa ở vòng lặp trước, giờ bấm "Xem sổ địa chính"
                    const selectedRow = rows.find(r => r.getAttribute('data-mplis-selected') === 'true' && r.getAttribute('data-mplis-processed') !== 'true');
                    if (selectedRow) {
                        selectedRow.setAttribute('data-mplis-processed', 'true');
                        selectedRow.removeAttribute('data-mplis-selected');
                        if (!topState.processedParcelIndexes) topState.processedParcelIndexes = new Set();
                        const idx = parseInt(selectedRow.getAttribute('data-mplis-index'));
                        if (!isNaN(idx)) topState.processedParcelIndexes.add(idx);

                        setLastActionTime(now, topState.config.delayOpen);
                        topState.isWaitingForQT3Modal = true;
                        topState.qt3ModalContext = true; // Đánh dấu đang trong ngữ cảnh modal QT3
                        writeLog("Đã chọn thửa, bấm 'Xem sổ địa chính'...");
                        clickElement(viewBtn);
                        updateStatus("Chờ mở sổ...", "waiting");
                        return;
                    }

                    // Trạng thái 1: Tìm thửa chưa làm để chọn
                    let unprocessedRow = null;
                    let rowIndex = -1;

                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (row.getAttribute('data-mplis-processed') === 'true') continue;
                        if (topState.processedParcelIndexes && topState.processedParcelIndexes.has(i)) continue;
                        const text = row.textContent.toLowerCase();
                        if (text.includes('đã ký') || text.includes('hoàn thành')) continue;
                        unprocessedRow = row;
                        rowIndex = i;
                        break;
                    }

                    if (unprocessedRow) {
                        unprocessedRow.setAttribute('data-mplis-selected', 'true');
                        unprocessedRow.setAttribute('data-mplis-index', rowIndex.toString());

                        // Thực hiện nhiều kiểu Click để đảm bảo hệ thống nhận diện được click dòng
                        const firstTd = unprocessedRow.querySelector('td');
                        if (firstTd) clickElement(firstTd);
                        clickElement(unprocessedRow);

                        // Thử dùng API của Kendo Grid nếu có (VBDLIS hay dùng)
                        try {
                            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                            if (win.$) {
                                const $row = win.$(unprocessedRow);
                                $row.click(); // jQuery click
                                const $grid = $row.closest('.k-grid');
                                if ($grid.length > 0 && $grid.data('kendoGrid')) {
                                    $grid.data('kendoGrid').select(unprocessedRow);
                                }
                            }
                        } catch (e) { }

                        const input = unprocessedRow.querySelector('input[type="radio"], input[type="checkbox"]');
                        if (input) {
                            input.checked = true;
                            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
                            clickElement(input);
                            if (input.id) {
                                const lbl = document.querySelector(`label[for="${input.id}"]`);
                                if (lbl) clickElement(lbl);
                            }
                        }

                        setLastActionTime(now, 800); // Đợi 800ms để hệ thống kịp highlight dòng được chọn
                        writeLog("Đang click chọn dòng thửa đất...");
                        updateStatus("Chọn thửa...", "waiting");
                        return;
                    } else if (rows.length > 0) {
                        // Hết thửa đất, bấm Đóng
                        const btnCloseAll = Array.from(document.querySelectorAll('button, a')).filter(el => {
                            const text = (el.textContent || el.innerText || '').trim().toLowerCase();
                            return text === 'đóng';
                        });
                        const visibleCloseAll = btnCloseAll.filter(el => {
                            try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                        });
                        if (visibleCloseAll.length > 0) {
                            const closeAll = visibleCloseAll[visibleCloseAll.length - 1];
                            if (!closeAll.hasAttribute('data-mplis-clicked')) {
                                closeAll.setAttribute('data-mplis-clicked', 'true');
                                setLastActionTime(now, topState.config.delayNext);
                                writeLog("Đã xử lý hết các thửa đất. Đang đóng màn hình QT3...");
                                clickElement(closeAll);
                                updateStatus("Hoàn tất QT3...", "waiting");
                                return;
                            } else {
                                updateStatus("Chờ đóng QT3...", "waiting");
                                return;
                            }
                        }
                    }
                }

                // --- BƯỚC CỦA QT2: LƯU KHO HỒ SƠ QUÉT ---
                if (isInsideQT2) {
                    // === DEBUG LOG QT2 (mỗi 5 giây in 1 lần để tránh spam) ===
                    if (!topState._qt2DebugLast || (now - topState._qt2DebugLast > 5000)) {
                        topState._qt2DebugLast = now;
                        const _chk = document.querySelector('#chkSelectAll');
                        const _btnChon = document.querySelector('#btnChonFileHoSoQuet');
                        const _btnOpen = document.querySelector('#btnOpenFormChonFileHoSoQuet');
                        const _btnAdd = document.querySelector('#btnAddHoSoQuet');
                        const _btnAddFile = document.querySelector('#btnAddFileHoSoQuet');
                        const _donList = document.querySelectorAll('#lstDonDangKy ul.dondangky-item');
                        const _selectedDon = document.querySelector('#lstDonDangKy ul.dondangky-item.selected, #lstDonDangKy ul.dondangky-item.active');
                        const _w = (el) => { try { return el ? el.getBoundingClientRect().width : -1; } catch (e) { return -2; } };
                        console.log(
                            `%c[QT2 DEBUG] ` +
                            `isInsideQT2=${isInsideQT2} | ` +
                            `chkSelectAll: exists=${!!_chk}, w=${_w(_chk)}, checked=${_chk?.checked} | ` +
                            `btnChonFile: exists=${!!_btnChon}, w=${_w(_btnChon)} | ` +
                            `btnOpenForm: exists=${!!_btnOpen}, w=${_w(_btnOpen)} | ` +
                            `btnAddHoSo: exists=${!!_btnAdd}, w=${_w(_btnAdd)} | ` +
                            `btnAddFile: exists=${!!_btnAddFile}, w=${_w(_btnAddFile)} | ` +
                            `donList: count=${_donList.length}, selectedDon=${_selectedDon ? _selectedDon.className : 'null'} | ` +
                            `qt2FileSelected=${topState.qt2FileSelected} | ` +
                            `processedDonIndexes=${topState.processedDonIndexes ? JSON.stringify([...topState.processedDonIndexes]) : 'null'}`,
                            'color: #f59e0b; font-size: 11px;'
                        );
                    }
                    // 1. Nếu đang mở modal Chọn file (popup chọn file đang hiển thị)
                    const chkSelectAll = document.querySelector('#chkSelectAll');
                    const btnChonFile = document.querySelector('#btnChonFileHoSoQuet');
                    const isFilePopupOpen = chkSelectAll && (() => { try { return chkSelectAll.getBoundingClientRect().width > 0; } catch (e) { return false; } })();

                    if (isFilePopupOpen) {
                        if (!chkSelectAll.hasAttribute('data-mplis-clicked')) {
                            writeLog("Xử lý chống cache cho Checkbox Select All...");
                            chkSelectAll.setAttribute('data-mplis-clicked', 'true');

                            try {
                                chkSelectAll.classList.add('mplis-highlight-target');
                                setTimeout(() => { try { chkSelectAll.classList.remove('mplis-highlight-target'); } catch (e) { } }, 1200);

                                const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;

                                // Nếu ô đang bị tích sẵn do "lưu cache" từ hồ sơ trước, ta phải click 1 lần để GỠ TÍCH
                                if (chkSelectAll.checked) {
                                    if (jq) jq('#chkSelectAll').click();
                                    else chkSelectAll.click();
                                }

                                // Đợi 250ms để bảng dữ liệu nhận diện trạng thái gỡ tích, sau đó CLICK TÍCH LẠI
                                // Việc này ép Kendo UI phải quét lại danh sách và chọn tất cả các file của hồ sơ mới
                                setTimeout(() => {
                                    try {
                                        if (jq) jq('#chkSelectAll').click();
                                        else chkSelectAll.click();
                                    } catch (err) {
                                        chkSelectAll.click();
                                    }


                                    // Lọc file theo số phát hành đã nhớ (delay thêm chút để DOM kịp update checkbox)
                                    setTimeout(() => {
                                        if (topState.qt2SoPhatHanhList && topState.qt2SoPhatHanhList.length > 0) {
                                            const fileRows = Array.from(document.querySelectorAll('#tbDanhSachGiayToDinhKem tbody tr'));
                                            for (const row of fileRows) {
                                                const cb = row.querySelector('input[type="checkbox"]');
                                                if (cb) {
                                                    const fileName = (row.textContent || '').toUpperCase();
                                                    if (fileName.includes('.PDF')) {
                                                        const matchSPH = fileName.match(/[A-Z]{2}\s*\d+/);
                                                        if (matchSPH) {
                                                            const sphFile = matchSPH[0].replace(/\s+/g, '').toUpperCase();

                                                            // Đếm tổng số đơn trong hồ sơ
                                                            const totalDons = document.querySelectorAll('#lstDonDangKy ul.dondangky-item').length;

                                                            // CHỈ GỠ TICK NẾU HỒ SƠ CÓ NHIỀU ĐƠN.
                                                            // Nếu hồ sơ chỉ có 1 đơn duy nhất, tất cả file nạp vào chắc chắn là của đơn này
                                                            // (dù người dùng gõ sai mã SPH), nên ta GIỮ NGUYÊN KHÔNG GỠ TICK!
                                                            if (totalDons > 1 && !topState.qt2SoPhatHanhList.includes(sphFile) && cb.checked) {
                                                                if (jq) jq(cb).click(); else cb.click();
                                                                writeLog("Loại bỏ file không khớp số phát hành của đơn này: " + sphFile);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }, 300);

                                }, 250);

                            } catch (e) {
                                if (chkSelectAll.checked) chkSelectAll.click();
                                setTimeout(() => { chkSelectAll.click(); }, 250);
                            }

                            setLastActionTime(now, 1200);
                            return;
                        } else {
                            // Tìm nút "Chọn" / "Chọn tập tin" - thử bằng ID trước, sau đó fallback bằng text
                            let chonBtn = btnChonFile;
                            if (!chonBtn || (() => { try { return chonBtn.getBoundingClientRect().width === 0; } catch (e) { return true; } })()) {
                                // Fallback: tìm nút có text "Chọn" hoặc "Chọn tập tin" trong popup đang hiển thị
                                chonBtn = Array.from(document.querySelectorAll('button, a, input[type="button"]')).find(el => {
                                    const text = (el.textContent || el.innerText || el.value || '').trim().toLowerCase();
                                    if (text !== 'chọn' && text !== 'chọn tập tin') return false;
                                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                                });
                            }
                            if (chonBtn) {
                                writeLog("Bấm 'Chọn tập tin'...");
                                clickElement(chonBtn);
                                setLastActionTime(now, topState.config.delayOpen);
                                topState.qt2Phase = 1;
                                chkSelectAll.removeAttribute('data-mplis-clicked');
                                return;
                            } else {
                                writeLog("Chờ nút 'Chọn tập tin' hiện ra...");
                                updateStatus("Đợi nút Chọn", "waiting");
                                return;
                            }
                        }
                    }

                    // 2. Nếu đang mở form Thêm mới hồ sơ
                    const btnOpenFormChonFile = document.querySelector('#btnOpenFormChonFileHoSoQuet');
                    const btnLuuHoSoQuetCheck = document.querySelector('#btnLuuHoSoQuet');
                    const isFormThemMoMở = (btnOpenFormChonFile && (() => { try { return btnOpenFormChonFile.getBoundingClientRect().width > 0; } catch (e) { return false; } })()) ||
                        (btnLuuHoSoQuetCheck && (() => { try { return btnLuuHoSoQuetCheck.getBoundingClientRect().width > 0; } catch (e) { return false; } })());

                    if (isFormThemMoMở) {
                        if (!topState.qt2Phase || topState.qt2Phase === 0) {
                            if (!btnOpenFormChonFile.hasAttribute('data-mplis-clicked')) {
                                writeLog("Bấm 'Chọn tập tin' để mở bảng chọn...");
                                btnOpenFormChonFile.setAttribute('data-mplis-clicked', 'true');
                                clickElement(btnOpenFormChonFile);
                                topState.qt2Phase = 0; // Vẫn ở state 0 vì popup sẽ mở ra và handle ở đoạn code isFilePopupOpen
                                setLastActionTime(now, topState.config.delayOpen);
                                return;
                            }
                        }
                        else if (topState.qt2Phase === 1) {
                            // Phase 1: Đã chọn xong file, giờ tìm TẤT CẢ các file chứa Số phát hành để bấm Chỉnh sửa lần lượt
                            const rows = Array.from(document.querySelectorAll('#tbDanhSachFile tbody tr'));

                            // Nếu bảng chưa có file nào hoặc báo 'Không có dữ liệu', chứng tỏ mạng chậm file chưa tải xong -> CHỜ
                            if (rows.length === 0 || rows.some(tr => tr.textContent.includes('Không có dữ liệu') || tr.textContent.includes('đang tải'))) {
                                updateStatus("Đợi file tải lên...", "waiting");
                                return;
                            }

                            let targetRow = rows.find(tr => {
                                const t = tr.textContent.toUpperCase();
                                return t.includes('.PDF') && t.includes('GIẤY TỜ HỒ SƠ') && !t.includes('GT.PDF');
                            });

                            if (targetRow) {
                                const editBtn = targetRow.querySelector('#btnEditHoSoQuet');
                                if (editBtn && !editBtn.hasAttribute('data-mplis-clicked')) {
                                    // Lấy Số phát hành tiếp theo để gán cho file này
                                    topState.qt2SphIndex = topState.qt2SphIndex || 0;
                                    let assignedSph = null;
                                    if (topState.qt2SoPhatHanhList && topState.qt2SphIndex < topState.qt2SoPhatHanhList.length) {
                                        assignedSph = topState.qt2SoPhatHanhList[topState.qt2SphIndex];
                                    }

                                    writeLog(`Bấm 'Chỉnh sửa' file đính kèm${assignedSph ? ' (Gán: ' + assignedSph + ')' : ''}...`);
                                    editBtn.setAttribute('data-mplis-clicked', 'true');
                                    clickElement(editBtn);

                                    // Reset trạng thái nút Lưu của form cũ (vì MPLIS dùng lại cùng 1 DOM element)
                                    const oldBtnLuu = document.querySelector('#btnLuuHoSoQuet');
                                    if (oldBtnLuu) oldBtnLuu.removeAttribute('data-mplis-clicked');

                                    topState.qt2Phase = 2; // Sang bước sửa sub-form
                                    topState.qt2EditingSph = assignedSph; // Lưu lại Số phát hành đang được gán
                                    setLastActionTime(now, 500);
                                    return;
                                }
                            } else {
                                // Khi không còn file nào cần sửa, mới đi thẳng đến bước Cập nhật bảng lớn
                                topState.qt2Phase = 3;
                                return;
                            }
                        }
                        else if (topState.qt2Phase === 2) {
                            // Phase 2: Đổi Loại giấy tờ -> Chọn thẻ Mô tả -> Bấm Lưu chi tiết file
                            const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;

                            const selects = Array.from(document.querySelectorAll('select[name="loaiHoSoQuet"]')).filter(el => {
                                try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                            });
                            if (selects.length > 0) {
                                const selLoaiGiayTo = selects[selects.length - 1];
                                if (selLoaiGiayTo.value !== "1") {
                                    selLoaiGiayTo.value = "1";
                                    if (jq) jq(selLoaiGiayTo).val("1").trigger("change");
                                    selLoaiGiayTo.dispatchEvent(new Event('change', { bubbles: true }));
                                    writeLog("Đã đổi Loại giấy tờ thành 'Giấy chứng nhận'");

                                    setLastActionTime(now, 500); // Đợi Kendo UI hiện form "Mô tả"
                                    return;
                                }
                            }

                            // Nếu đang sửa 1 file thuộc về 1 SPH cụ thể, chọn giấy chứng nhận tương ứng ở ô "Mô tả"
                            if (topState.qt2EditingSph) {
                                const selMoTaList = Array.from(document.querySelectorAll('select[name="giayChungNhanId"]')).filter(el => {
                                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                                });
                                if (selMoTaList.length > 0) {
                                    const selMoTa = selMoTaList[selMoTaList.length - 1];
                                    const options = Array.from(selMoTa.options);
                                    const targetOpt = options.find(opt => opt.textContent.replace(/\s+/g, '').toUpperCase().includes(topState.qt2EditingSph));
                                    if (targetOpt && selMoTa.value !== targetOpt.value) {
                                        selMoTa.value = targetOpt.value;
                                        if (jq) jq(selMoTa).val(targetOpt.value).trigger("change");
                                        selMoTa.dispatchEvent(new Event('change', { bubbles: true }));
                                        writeLog(`Đã gán Giấy chứng nhận: ${topState.qt2EditingSph}`);

                                        setLastActionTime(now, 200); // Đợi thêm 1 nhịp nhẹ
                                        return;
                                    }
                                }
                            }

                            const btnLuuSub = document.querySelector('#btnLuuHoSoQuet');
                            if (btnLuuSub && !btnLuuSub.hasAttribute('data-mplis-clicked')) {
                                writeLog("Bấm 'Lưu' chi tiết file...");
                                btnLuuSub.setAttribute('data-mplis-clicked', 'true');
                                clickElement(btnLuuSub);

                                // Tăng chỉ số để gán file tiếp theo cho SPH tiếp theo
                                if (topState.qt2EditingSph) {
                                    topState.qt2SphIndex = (topState.qt2SphIndex || 0) + 1;
                                }

                                // Lưu xong file này, quay lại vòng lặp Phase 1 để xem CÒN FILE NÀO KHÁC cần sửa không!
                                topState.qt2Phase = 1;
                                setLastActionTime(now, topState.config.delayAction);
                                return;
                            } else {
                                updateStatus("Đợi nút Lưu file...", "waiting");
                                return;
                            }
                        }
                        else if (topState.qt2Phase === 3) {
                            // Phase 3: Bấm "Cập nhật" hoặc "Lưu" CỦA BẢNG THÊM MỚI (chứ không phải của sub-form)
                            const updateBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')).filter(el => {
                                // Bỏ qua nút Lưu của sub-form
                                if (el.id === 'btnLuuHoSoQuet') return false;

                                const text = (el.textContent || el.innerText || el.value || '').trim().toLowerCase();
                                return text === 'cập nhật' || text === 'lưu';
                            }).filter(el => { try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; } });

                            if (updateBtns.length > 0) {
                                const updateBtn = updateBtns[updateBtns.length - 1];
                                if (!updateBtn.hasAttribute('data-mplis-clicked')) {
                                    writeLog("Bấm 'Cập nhật' lưu kho...");
                                    updateBtn.setAttribute('data-mplis-clicked', 'true');
                                    clickElement(updateBtn);

                                    // Ghi nhận đã xử lý xong và reset state
                                    topState.qt2Phase = 0;
                                    if (topState.currentDonIndex !== undefined) {
                                        if (!topState.processedDonIndexes) topState.processedDonIndexes = new Set();
                                        topState.processedDonIndexes.add(topState.currentDonIndex);
                                    }

                                    setLastActionTime(now, topState.config.delayAction);
                                    return;
                                } else {
                                    updateStatus("Đang đóng bảng...", "waiting");
                                    return;
                                }
                            } else {
                                updateStatus("Đợi nút Cập nhật...", "waiting");
                                return;
                            }
                        }
                    }

                    // 3. Nếu đang ở màn hình chính của QT2 (Danh sách đơn đăng ký)
                    const donDangKyList = Array.from(document.querySelectorAll('#lstDonDangKy ul.dondangky-item'));
                    let unprocessedDon = null;
                    let donIndex = -1;

                    for (let i = 0; i < donDangKyList.length; i++) {
                        const don = donDangKyList[i];
                        if (don.getAttribute('data-mplis-processed') === 'true') continue;
                        if (topState.processedDonIndexes && topState.processedDonIndexes.has(i)) continue;
                        const text = don.textContent.toLowerCase();
                        if (text.includes('đã xử lý') || text.includes('hoàn thành')) continue;
                        unprocessedDon = don;
                        donIndex = i;
                        break;
                    }

                    if (unprocessedDon) {
                        // Đơn đăng ký phải ĐƯỢC CHỌN trước khi thao tác các nút bên trong
                        const isSelected = unprocessedDon.classList.contains('active') || unprocessedDon.classList.contains('selected') || unprocessedDon.getAttribute('data-mplis-selected') === 'true';

                        if (!isSelected) {
                            // NẾU ĐƠN CHƯA ĐƯỢC CHỌN -> Bắt buộc click chọn đơn này để load panel của nó!
                            // (Bỏ qua nút Thêm mới dù nó có đang hiện, vì nó đang thuộc về đơn cũ)
                            writeLog("Đang chọn đơn đăng ký thứ " + (donIndex + 1) + "...");
                            unprocessedDon.setAttribute('data-mplis-selected', 'true');
                            unprocessedDon.setAttribute('data-mplis-index', donIndex.toString());

                            // Xóa bộ nhớ đệm (cờ clicked) của tất cả các nút để chuẩn bị cho đơn mới
                            document.querySelectorAll('*[data-mplis-clicked="true"]').forEach(el => el.removeAttribute('data-mplis-clicked'));

                            // Click vào phần tử <li class="title"> bên trong đơn đăng ký
                            const titleLi = unprocessedDon.querySelector('li.title, li.list-group-item.title, li:first-child');
                            if (titleLi) {
                                clickElement(titleLi);
                            } else {
                                clickElement(unprocessedDon);
                            }

                            // Dùng jQuery click nếu có
                            try {
                                const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;
                                if (jq) {
                                    jq(unprocessedDon).click();
                                    jq(unprocessedDon).trigger('click');
                                }
                            } catch (e) { }

                            setLastActionTime(now, 1500); // Chờ load panel mới
                            return;
                        } else {
                            // NẾU ĐƠN ĐÃ ĐƯỢC CHỌN -> Bắt đầu quét nút Thêm mới của đơn đó
                            const btnAdd = document.querySelector('#btnAddHoSoQuet') || document.querySelector('#btnAddFileHoSoQuet');
                            const isBtnAddVisible = btnAdd && (() => { try { return btnAdd.getBoundingClientRect().width > 0; } catch (e) { return false; } })();

                            if (isBtnAddVisible) {
                                if (!btnAdd.hasAttribute('data-mplis-clicked')) {
                                    writeLog("Bấm 'Thêm mới' hồ sơ quét...");
                                    btnAdd.setAttribute('data-mplis-clicked', 'true');
                                    topState.currentDonIndex = donIndex;
                                    topState.qt2Phase = 0; // Bắt đầu lại quy trình 4 bước của Thêm mới
                                    topState.qt2SphIndex = 0; // Reset bộ đếm gán Giấy chứng nhận

                                    // Đọc và ghi nhớ danh sách Số phát hành của đơn đăng ký này
                                    topState.qt2SoPhatHanhList = [];

                                    // Tìm thẻ chứa treeGiayChungNhan ĐANG HIỂN THỊ (thuộc về đơn hiện tại)
                                    const activeTreeContainer = Array.from(document.querySelectorAll('#treeGiayChungNhan')).find(el => {
                                        try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                                    });

                                    if (activeTreeContainer) {
                                        const treeNodes = activeTreeContainer.querySelectorAll('a');
                                        for (const node of treeNodes) {
                                            const match = (node.textContent || '').match(/Số phát hành:\s*([A-Za-z0-9\s]+)\s*-/i);
                                            if (match) {
                                                const sph = match[1].trim().replace(/\s+/g, '').toUpperCase();
                                                if (!topState.qt2SoPhatHanhList.includes(sph)) {
                                                    topState.qt2SoPhatHanhList.push(sph);
                                                }
                                            }
                                        }
                                    }
                                    if (topState.qt2SoPhatHanhList.length > 0) {
                                        writeLog("Đã ghi nhớ các số phát hành: " + topState.qt2SoPhatHanhList.join(", "));
                                    }

                                    clickElement(btnAdd);
                                    setLastActionTime(now, topState.config.delayOpen);
                                    return;
                                } else {
                                    updateStatus("Chờ mở form...", "waiting");
                                    return;
                                }
                            } else {
                                // Đã chọn đơn nhưng nút Thêm mới chưa hiện ra
                                updateStatus("Đợi nút Thêm mới tải...", "waiting");
                                return;
                            }
                        }
                    } else if (donDangKyList.length > 0) {
                        // Hết Đơn đăng ký, đóng màn hình bằng nút X của panel Lưu kho
                        const qt2Headers = Array.from(document.querySelectorAll('.panel-heading')).filter(el => el.textContent.toLowerCase().includes('lưu kho hồ sơ'));
                        let btnCloseAll = [];
                        if (qt2Headers.length > 0) {
                            btnCloseAll = Array.from(qt2Headers[qt2Headers.length - 1].querySelectorAll('.close, button[data-dismiss="modal"]'));
                        } else {
                            const lstDonDangKy = document.querySelector('#lstDonDangKy');
                            const qt2Container = lstDonDangKy ? (lstDonDangKy.closest('.modal, .panel, .k-window, .dx-popup-content') || document.body) : document.body;
                            btnCloseAll = Array.from(qt2Container.querySelectorAll('.modal-header .close, .panel-heading .close, button[data-dismiss="modal"]'));
                        }

                        btnCloseAll = btnCloseAll.filter(el => { try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; } });

                        if (btnCloseAll.length > 0) {
                            const closeAll = btnCloseAll[btnCloseAll.length - 1];
                            if (!closeAll.hasAttribute('data-mplis-clicked')) {
                                closeAll.setAttribute('data-mplis-clicked', 'true');
                                setLastActionTime(now, topState.config.delayNext);
                                writeLog("Đã xử lý hết Đơn đăng ký. Đang đóng màn hình QT2...");
                                clickElement(closeAll);
                                updateStatus("Hoàn tất QT2...", "waiting");
                                return;
                            } else {
                                updateStatus("Chờ đóng QT2...", "waiting");
                                return;
                            }
                        }
                    } else {
                        return; // Danh sách đơn rỗng, chờ load
                    }
                }

                // --- BƯỚC CỦA QT1: NÚT THỰC HIỆN TRÊN FORM ---
                const execBtns = querySelectorAllCustom(topState.config.selectorExecute);
                const visibleExecBtns = execBtns.filter(el => {
                    try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                });
                if (visibleExecBtns.length > 0) {
                    // Đảm bảo nút thực hiện không nằm trong bảng chuyển tiếp (tránh click đúp)
                    const isInsideFwd = visibleExecBtns[0].closest('#frmChuyenTiepHoSo_tbUsers, .modal-chuyentiep');
                    if (!isInsideFwd) {
                        const execBtn = visibleExecBtns[0];
                        setLastActionTime(now, topState.config.delayAction);
                        writeLog("Tìm thấy nút 'Thực hiện'. Đang click...");
                        topState.qt1ConfirmStreak = 0; // Bắt đầu lượt cập nhật pháp lý mới, reset đếm lặp hộp xác nhận
                        clickElement(execBtn);
                        updateStatus("Chờ xác nhận...", "waiting");
                        return;
                    }
                }

                // --- BƯỚC CHUNG: BẢNG QUY TRÌNH -> NÚT "XỬ LÝ TÁC VỤ" CỦA HÀNG MỤC TIÊU ---
                // Nếu đang mở các Form của QT1, QT2 hoặc QT3 thì tuyệt đối KHÔNG bấm Xử lý tác vụ ở nền
                const isAnyFormOpen = isInsideQT3 || isInsideQT2 || visibleExecBtns.length > 0 || visibleConfirmBtns.length > 0;

                if (!isAnyFormOpen) {
                    const targetRowData = findTaskProcessButton(topState.config.activeWorkflows);
                    if (targetRowData) {
                        if (targetRowData.isDone) {
                            if (topState.config.isQT5 && topState.config.forwardUser) {
                                // Case-insensitive: commandname có thể là "chuyển tiếp" hoặc "Chuyển tiếp" tùy VBDLIS
                                const btnChuyenTiep = Array.from(document.querySelectorAll('button.btnWorkflowCommand')).find(b => {
                                    const cn = (b.getAttribute('commandname') || '').toLowerCase();
                                    return cn === 'chuyển tiếp';
                                });
                                const isBtnFwdVisible = btnChuyenTiep && (() => { try { return btnChuyenTiep.getBoundingClientRect().width > 0; } catch (e) { return false; } })();

                                if (isBtnFwdVisible && !btnChuyenTiep.hasAttribute('data-mplis-clicked')) {
                                    writeLog("Các QT đã xong, đang bấm nút 'Chuyển tiếp'...");
                                    btnChuyenTiep.setAttribute('data-mplis-clicked', 'true');
                                    clickElement(btnChuyenTiep);
                                    setLastActionTime(now, topState.config.delayOpen);
                                    return;
                                } else if (fwdTable && (() => { try { return fwdTable.getBoundingClientRect().width > 0; } catch (e) { return false; } })()) {
                                    // Đang ở bảng chuyển tiếp, để logic phía trên xử lý
                                } else if (btnChuyenTiep && btnChuyenTiep.hasAttribute('data-mplis-clicked')) {
                                    // Bảng đã đóng xong
                                    writeLog("Hoàn tất chuyển tiếp và các quy trình. DỪNG AUTO.");
                                    if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC("🎉 ĐÃ CHUYỂN TIẾP VÀ HOÀN THÀNH!");
                                    return;
                                }
                            } else {
                                writeLog("Tất cả quy trình yêu cầu đã hoàn thành. DỪNG AUTO.");
                                if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === 'function') topWin.MPLIS_AUTO_TOGGLE_FUNC("🎉 ĐÃ HOÀN THÀNH TẤT CẢ QUY TRÌNH!");
                                return;
                            }
                        }
                        if (targetRowData.button) {
                            try {
                                const rect = targetRowData.button.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    setLastActionTime(now, topState.config.delayOpen);
                                    if (targetRowData.taskName.toLowerCase().includes('địa chính')) {
                                        topState.processedParcelIndexes = new Set();
                                    }
                                    if (targetRowData.taskName.toLowerCase().includes('lưu kho') || targetRowData.taskName.toLowerCase().includes('hồ sơ quét')) {
                                        topState.processedDonIndexes = new Set();
                                        topState.qt2FileSelected = false;
                                    }
                                    writeLog(`Bấm 'Xử lý tác vụ' cho: ${targetRowData.taskName}...`);
                                    const tr = targetRowData.button.closest('tr');
                                    if (tr) tr.setAttribute('data-mplis-processed', 'true');
                                    clickElement(targetRowData.button);
                                    updateStatus("Chờ mở bảng...", "waiting");
                                    return;
                                }
                            } catch (e) { }
                        }
                    }
                }

                // --- BƯỚC CHUNG: NÚT "XỬ LÝ HỒ SƠ" Ở MÀN HÌNH DANH SÁCH ---
                const isTaskModalOpen = querySelectorAllCustom("a:contains('Xử lý tác vụ'), button:contains('Xử lý tác vụ')").length > 0;
                if (!isTaskModalOpen) {
                    const mainProcessBtns = querySelectorAllCustom(topState.config.selectorMainProcess);
                    const visibleMainBtns = mainProcessBtns.filter(el => {
                        try { return el.getBoundingClientRect().width > 0; } catch (e) { return false; }
                    });
                    if (visibleMainBtns.length > 0) {
                        const mainBtn = visibleMainBtns[0];
                        setLastActionTime(now, topState.config.delayOpen);
                        topState.processedParcelIndexes = new Set(); // Xóa lịch sử chọn thửa khi vào hồ sơ mới
                        writeLog("Tìm thấy nút 'Xử lý hồ sơ' ở trang chính. Đang click...");
                        clickElement(mainBtn);
                        updateStatus("Chờ tải quy trình...", "waiting");
                        return;
                    }
                }

                updateStatus("Đang quét...", "active");

            } catch (e) {
                console.error("[MPLIS Auto Scanner Error] ", e);
            }
        }



        setInterval(scanAndExecute, 1200);

        return {
            getTopState, saveConfig
        };
    })();


export { ProcessModule };
