import { escapeHtml } from './utils.js';

    const UpdateParcelModule = (function () {
        const state = {
            isRunning: false,
            excelData: [],
            currentIndex: 0,
            logBuffer: [],
            config: {
                delayAction: 1500,
                delayPageLoad: 3000
            }
        };

        function writeLog(msg) {
            const logContent = document.getElementById('vbdlis-logs');
            if (!logContent) return;
            const time = new Date().toLocaleTimeString();
            logContent.innerHTML += `[${time}] ${msg}\n`;
            logContent.scrollTop = logContent.scrollHeight;
        }

        // Parses the tab-separated content pasted from Excel
        function parseExcelInput() {
            const rawText = document.getElementById('update-excel-input').value.trim();
            if (!rawText) {
                writeLog("⚠️ Chưa có dữ liệu Excel được dán vào!");
                return;
            }

            const lines = rawText.split('\n');
            const parsed = [];
            const groupCounts = {};

            lines.forEach((line, idx) => {
                const cols = line.split('\t').map(c => c.trim());
                // Bỏ qua dòng tiêu đề nếu chứa chữ 'số phát hành' hoặc 'tham chiếu'
                if (line.toLowerCase().includes('số phát hành') || line.toLowerCase().includes('tham chiếu')) {
                    return;
                }

                if (cols.length >= 4) {
                    let sph = '';
                    let newTo, rawNewThua, oldTo, oldThua;

                    if (cols.length >= 5) {
                        sph = cols[0].toUpperCase();
                        newTo = cols[1];
                        rawNewThua = cols[2];
                        oldTo = cols[3];
                        oldThua = cols[4];
                    } else {
                        // Nếu chỉ có 4 cột (người dùng không copy cột SPH)
                        sph = '';
                        newTo = cols[0];
                        rawNewThua = cols[1];
                        oldTo = cols[2];
                        oldThua = cols[3];
                    }

                    // Phân tách bằng phẩy, chấm phẩy, hoặc dấu chấm
                    let thuaList = rawNewThua.split(/[,;.]+/).map(x => x.trim()).filter(x => x);
                    if (thuaList.length === 0) thuaList = [rawNewThua];

                    // Nhóm các dòng có chung SPH, Tờ mới, và Danh sách thửa mới
                    let groupKey = `${sph}_${newTo}_${rawNewThua}`;
                    groupCounts[groupKey] = (groupCounts[groupKey] || 0) + 1;

                    // Hàm trích xuất chuỗi số đầu tiên (để xử lý "23 (ứng đại diện)" -> "23")
                    const extractNum = (str) => {
                        const match = str.match(/\d+/);
                        return match ? match[0] : str;
                    };

                    parsed.push({
                        sph: sph,
                        newTo: newTo,
                        newThuaList: thuaList,
                        newThua: thuaList[0], // Lấy số đầu tiên
                        newThuaIndex: 0,
                        oldTo: extractNum(oldTo),
                        oldThua: extractNum(oldThua),
                        groupKey: groupKey
                    });
                }
            });

            if (parsed.length === 0) {
                writeLog("❌ Không thể phân tích dữ liệu. Vui lòng kiểm tra lại cấu trúc cột!");
                return;
            }

            // Đánh dấu dòng nào thuộc nhóm Gộp thửa (ứng đại diện)
            parsed.forEach(t => { t.isGroup = groupCounts[t.groupKey] > 1; });

            state.excelData = parsed;
            state.groupSuccess = {}; // Reset trạng thái thành công của các nhóm
            state.currentIndex = 0;

            document.getElementById('stat-total').textContent = parsed.length;
            document.getElementById('stat-current').textContent = "1";
            document.getElementById('btn-update-start').removeAttribute('disabled');

            writeLog(`✅ Đã phân tích xong ${parsed.length} dòng dữ liệu!`);
            console.log("Parsed Excel Data:", parsed);
        }

        function startAuto() {
            if (state.excelData.length === 0) return;
            state.isRunning = true;

            document.getElementById('stat-status').textContent = "Đang chạy...";
            document.getElementById('stat-status').className = "status-running";
            document.getElementById('btn-update-start').style.display = 'none';
            document.getElementById('btn-update-stop').style.display = 'block';

            writeLog("▶️ Bắt đầu tiến trình tự động...");
        }

        function stopAuto() {
            state.isRunning = false;
            document.getElementById('stat-status').textContent = "Tạm dừng";
            document.getElementById('stat-status').className = "status-paused";
            document.getElementById('btn-update-start').style.display = 'block';
            document.getElementById('btn-update-stop').style.display = 'none';

            writeLog("⏸️ Đã tạm dừng tiến trình Auto.");
        }

        // Kiểm tra xem trang có đang hiển thị thông báo loading/đang xử lý không
        function isPageLoading() {
            try {
                const commonLoaders = Array.from(document.querySelectorAll('.loading, .loader, #loading, #loader, .k-loading-mask, .blockUI.blockOverlay, .blockUI.blockMsg, .dx-loadpanel, #AjaxLoader, .dataTables_processing'));
                for (const loader of commonLoaders) {
                    const style = window.getComputedStyle(loader);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        const rect = loader.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) return true;
                    }
                }
                const allElements = Array.from(document.querySelectorAll('div, span, p'));
                for (const el of allElements) {
                    if (el.children.length <= 2) {
                        const text = (el.textContent || '').trim().toLowerCase();
                        if (text === 'đang xử lý...' || text === 'đang xử lý') {
                            const style = window.getComputedStyle(el);
                            if (style.display !== 'none' && style.visibility !== 'hidden') {
                                const rect = el.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) return true;
                            }
                        }
                    }
                }
            } catch (e) { }
            return false;
        }

        // Helper: Lấy phần tử ĐANG THỰC SỰ HIỂN THỊ trên màn hình (chống lỗi nhiều modal ẩn trùng ID)
        function getVisibleElement(selector) {
            const els = Array.from(document.querySelectorAll(selector));
            return els.find(el => el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none');
        }

        // Main execution loop run by setInterval
        setInterval(() => {
            if (!state.isRunning) return;

            // Bỏ qua nhịp này nếu hệ thống VBDLIS đang báo "Đang xử lý..."
            if (isPageLoading()) {
                return;
            }

            if (state.currentIndex >= state.excelData.length) {
                writeLog("🎉 Hoàn thành cập nhật toàn bộ danh sách Excel!");
                stopAuto();
                return;
            }

            const task = state.excelData[state.currentIndex];
            document.getElementById('stat-current').textContent = state.currentIndex + 1;

            if (!state.step) {
                state.step = 'OPEN_SEARCH';
            }

            // jQuery helper if available
            const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.$) ? unsafeWindow.$ : null;

            switch (state.step) {
                case 'OPEN_SEARCH':
                    // Kiểm tra xem nhóm gộp thửa này đã có thửa nào đại diện thành công chưa
                    if (task.isGroup && state.groupSuccess[task.groupKey]) {
                        writeLog(`⏭️ Nhóm gộp thửa đã có 1 thửa đại diện thành công. Bỏ qua thửa cũ ${task.oldThua} (Đã ứng đại diện).`);
                        task.resultStatus = 'Đã ứng đại diện';
                        state.step = 'NEXT_TASK';
                        break;
                    }

                    // Bước 1: Bấm tra cứu
                    const btnSearch = getVisibleElement('#btnChonDonDangKy');
                    if (btnSearch) {
                        writeLog("Bước 1: Bấm nút 'Tra cứu'...");
                        if (jq) jq(btnSearch).click(); else btnSearch.click();

                        state.step = 'WAIT_OPEN_SEARCH';
                        state.lastOpenSearchTime = Date.now();
                    }
                    break;

                case 'WAIT_OPEN_SEARCH':
                    // Chờ form mở lên rồi mới bấm Làm mới
                    if (Date.now() - state.lastOpenSearchTime > 400) {
                        const btnRefresh = getVisibleElement('#btnKhoiTaoTraCuuTinhHinhDangKyChiTiet');
                        if (btnRefresh) {
                            writeLog("Làm mới form tra cứu để xóa kết quả cũ...");
                            if (jq) jq(btnRefresh).click(); else btnRefresh.click();
                        }

                        task.searchAttempt = task.searchAttempt || 0;
                        if (task.sph) {
                            state.step = 'SEARCH_SPH';
                        } else {
                            writeLog(`⚠️ Đơn này KHÔNG CÓ Số Phát Hành. Tự động chuyển thẳng sang tìm bằng Tờ/Thửa cũ...`);
                            task.searchAttempt = 1;
                            state.step = 'SEARCH_FALLBACK';
                        }
                    }
                    break;

                case 'SEARCH_SPH':
                    // Bước 2: Nhập số phát hành và bấm tìm kiếm
                    const inputSPH = getVisibleElement('input[name="soPhatHanh"]');
                    const btnSubmitSearch = getVisibleElement('#btnTraCuuTinhHinhDangKy');
                    if (inputSPH && btnSubmitSearch) {
                        writeLog(`Bước 2: Nhập SPH [${task.sph}] và tìm kiếm...`);

                        // Tạm khóa trạng thái để chờ setTimeout xử lý
                        state.step = 'WAIT_SEARCH';

                        setTimeout(() => {
                            inputSPH.value = task.sph;
                            inputSPH.dispatchEvent(new Event('input', { bubbles: true }));
                            inputSPH.dispatchEvent(new Event('change', { bubbles: true }));

                            setTimeout(() => {
                                if (jq) jq(btnSubmitSearch).click(); else btnSubmitSearch.click();

                                // Đổi state SAU KHI đã bấm tìm kiếm và bắt buộc chờ kết quả
                                state.step = 'WAIT_SEARCH_RESULT';
                                state.lastSearchTime = Date.now();
                            }, 200);
                        }, 200); // Đợi Làm mới xong mới điền
                    }
                    break;

                case 'SEARCH_FALLBACK':
                    // Bước 2 dự phòng 1: Tìm bằng Tờ cũ và Thửa cũ
                    const inputToCu = getVisibleElement('input[name="soHieuToBanDoCu"]');
                    const inputThuaCu = getVisibleElement('input[name="soThuTuThuaCu"]');
                    const btnSubmitSearch2 = getVisibleElement('#btnTraCuuTinhHinhDangKy');

                    if (inputToCu && inputThuaCu && btnSubmitSearch2) {
                        writeLog(`Bước 2 (Dự phòng 1): Nhập Tờ cũ [${task.oldTo}] & Thửa cũ [${task.oldThua}] và tìm kiếm...`);
                        state.step = 'WAIT_SEARCH';

                        setTimeout(() => {
                            inputToCu.value = task.oldTo;
                            inputToCu.dispatchEvent(new Event('input', { bubbles: true }));
                            inputToCu.dispatchEvent(new Event('change', { bubbles: true }));

                            inputThuaCu.value = task.oldThua;
                            inputThuaCu.dispatchEvent(new Event('input', { bubbles: true }));
                            inputThuaCu.dispatchEvent(new Event('change', { bubbles: true }));

                            setTimeout(() => {
                                if (jq) jq(btnSubmitSearch2).click(); else btnSubmitSearch2.click();
                                state.step = 'WAIT_SEARCH_RESULT';
                                state.lastSearchTime = Date.now();
                            }, 200);
                        }, 200);
                    } else {
                        writeLog(`⚠️ Lỗi giao diện: Không tìm thấy ô nhập Tờ/Thửa cũ.`);
                        task.resultStatus = 'Lỗi giao diện (thiếu ô Tờ/Thửa cũ)';
                        state.step = 'NEXT_TASK';
                        const btnCloseSearch2 = getVisibleElement('#TraCuuTinhHinhDangKy .close') || getVisibleElement('button[data-dismiss="modal"].close');
                        if (btnCloseSearch2) {
                            if (jq) jq(btnCloseSearch2).click(); else btnCloseSearch2.click();
                        }
                    }
                    break;

                case 'SEARCH_FALLBACK_2':
                    // Bước 2 dự phòng 2: Tìm bằng Tờ và Thửa mặc định
                    const inputToMacDinh = getVisibleElement('input[name="soHieuToBanDo"]');
                    const inputThuaMacDinh = getVisibleElement('input[name="soThuTuThua"]');
                    const btnSubmitSearch3 = getVisibleElement('#btnTraCuuTinhHinhDangKy');

                    if (inputToMacDinh && inputThuaMacDinh && btnSubmitSearch3) {
                        writeLog(`Bước 2 (Dự phòng 2): Nhập Tờ mặc định [${task.oldTo}] & Thửa mặc định [${task.oldThua}] và tìm kiếm...`);
                        state.step = 'WAIT_SEARCH';

                        setTimeout(() => {
                            inputToMacDinh.value = task.oldTo;
                            inputToMacDinh.dispatchEvent(new Event('input', { bubbles: true }));
                            inputToMacDinh.dispatchEvent(new Event('change', { bubbles: true }));

                            inputThuaMacDinh.value = task.oldThua;
                            inputThuaMacDinh.dispatchEvent(new Event('input', { bubbles: true }));
                            inputThuaMacDinh.dispatchEvent(new Event('change', { bubbles: true }));

                            setTimeout(() => {
                                if (jq) jq(btnSubmitSearch3).click(); else btnSubmitSearch3.click();
                                state.step = 'WAIT_SEARCH_RESULT';
                                state.lastSearchTime = Date.now();
                            }, 200);
                        }, 200);
                    } else {
                        writeLog(`⚠️ Lỗi giao diện: Không tìm thấy ô nhập Tờ/Thửa mặc định.`);
                        task.resultStatus = 'Lỗi giao diện (thiếu ô Tờ/Thửa mặc định)';
                        state.step = 'NEXT_TASK';
                        const btnCloseSearch3 = getVisibleElement('#TraCuuTinhHinhDangKy .close') || getVisibleElement('button[data-dismiss="modal"].close');
                        if (btnCloseSearch3) {
                            if (jq) jq(btnCloseSearch3).click(); else btnCloseSearch3.click();
                        }
                    }
                    break;

                case 'WAIT_SEARCH':
                    // Trạng thái chờ trung gian trong lúc setTimeout của SEARCH_SPH đang chạy
                    break;

                case 'WAIT_SEARCH_RESULT':
                    // Đợi ít nhất 1.2 giây cho chắc chắn kết quả cũ đã biến mất (kể cả khi không có loading)
                    if (Date.now() - state.lastSearchTime > 1200) {
                        state.step = 'SELECT_DOSSIER';
                    }
                    break;

                case 'SELECT_DOSSIER':
                    // Bước 3: Đợi kết quả và chọn đơn
                    const visibleTable = getVisibleElement('#tblTraCuuTinhHinhDangKy');
                    if (!visibleTable) {
                        if (Date.now() - state.lastSearchTime > 8000) {
                            writeLog(`⚠️ Không tìm thấy bảng kết quả tra cứu. Bỏ qua.`);
                            task.resultStatus = 'Lỗi giao diện (không thấy bảng)';
                            state.step = 'NEXT_TASK';
                        }
                        break;
                    }

                    const tbody = visibleTable.querySelector('tbody');

                    // Trường hợp 0: Trả về dòng "Không tìm thấy đơn..." (td.dataTables_empty)
                    const emptyCell = tbody ? tbody.querySelector('td.dataTables_empty') : null;
                    if (emptyCell && emptyCell.textContent.toLowerCase().includes('không tìm thấy')) {
                        task.searchAttempt = task.searchAttempt || 0;

                        if (task.searchAttempt === 0) {
                            writeLog(`⚠️ Không tìm thấy SPH [${task.sph}]. Chuyển sang tìm dự phòng (1) bằng Tờ/Thửa cũ...`);
                            task.searchAttempt = 1;

                            // Bấm làm mới form để xóa SPH cũ
                            const btnRefresh = getVisibleElement('#btnKhoiTaoTraCuuTinhHinhDangKyChiTiet');
                            if (btnRefresh) {
                                if (jq) jq(btnRefresh).click(); else btnRefresh.click();
                            }

                            state.step = 'SEARCH_FALLBACK';
                        } else if (task.searchAttempt === 1) {
                            writeLog(`⚠️ Không tìm thấy bằng Tờ/Thửa cũ. Chuyển sang tìm dự phòng (2) bằng Tờ/Thửa mặc định...`);
                            task.searchAttempt = 2;

                            // Bấm làm mới form để xóa Tờ/Thửa cũ
                            const btnRefresh = getVisibleElement('#btnKhoiTaoTraCuuTinhHinhDangKyChiTiet');
                            if (btnRefresh) {
                                if (jq) jq(btnRefresh).click(); else btnRefresh.click();
                            }

                            state.step = 'SEARCH_FALLBACK_2';
                        } else {
                            writeLog(`⚠️ Đã thử tìm bằng CẢ 3 CÁCH (SPH, Tờ/Thửa cũ, Tờ/Thửa mặc định) nhưng vẫn KHÔNG CÓ ĐƠN. Bỏ qua.`);
                            task.resultStatus = 'Không tìm thấy đơn (thử cả 3 cách)';

                            const btnCloseSearch = getVisibleElement('#TraCuuTinhHinhDangKy .close') || getVisibleElement('button[data-dismiss="modal"].close');
                            if (btnCloseSearch) {
                                if (jq) jq(btnCloseSearch).click(); else btnCloseSearch.click();
                            }

                            state.step = 'NEXT_TASK';
                        }
                        break;
                    }


                    // Lọc kỹ: chỉ đếm các dòng có dữ liệu, đang thực sự hiển thị và là con trực tiếp của tbody này
                    const rawRows = tbody ? Array.from(tbody.querySelectorAll('tr:not(.dataTables_empty)')) : [];
                    const rows = rawRows.filter(r => r.offsetWidth > 0 && r.parentElement === tbody);

                    const btnSelect = getVisibleElement('#btnLuuChonTinhHinhDangKy');

                    // Trường hợp 1: Trùng đơn (trả về >= 2 kết quả)
                    if (rows.length > 1) {
                        console.log("CHI TIẾT LỖI TRÙNG ĐƠN - Các dòng thu được:", rows.map(r => r.outerHTML));
                        writeLog(`⚠️ SPH [${task.sph}] có ${rows.length} đơn (Trùng đơn) → Bỏ qua và đóng tìm kiếm.`);
                        task.resultStatus = `Trùng đơn (${rows.length} kết quả)`;

                        // Bấm đóng popup tra cứu
                        const btnCloseSearch = getVisibleElement('#TraCuuTinhHinhDangKy .close') || getVisibleElement('button[data-dismiss="modal"].close');
                        if (btnCloseSearch) {
                            if (jq) jq(btnCloseSearch).click(); else btnCloseSearch.click();
                        }

                        state.step = 'NEXT_TASK';
                        break;
                    }

                    // Trường hợp 2: Có 1 đơn duy nhất
                    if (rows.length === 1 && btnSelect) {
                        const row = rows[0];
                        writeLog("Bước 3: Tìm thấy Đơn. Tiến hành chọn đơn...");

                        // Click cả checkbox lẫn dòng để đảm bảo Kendo/DataTables nhận sự kiện chọn
                        const cb = row.querySelector('td.select-checkbox');
                        if (jq) {
                            if (cb) jq(cb).click();
                            jq(row).click();
                            // Force add class selected nếu thư viện chưa kịp cập nhật
                            jq(row).addClass('selected');
                        } else {
                            if (cb) cb.click();
                            row.click();
                            row.classList.add('selected');
                        }

                        setTimeout(() => {
                            writeLog("Bấm 'Đồng ý' chọn đơn...");
                            if (jq) jq(btnSelect).click(); else btnSelect.click();
                        }, 800); // Tăng delay lên 800ms để hệ thống kịp nhận diện dòng được chọn

                        state.step = 'OPEN_PARCEL';
                        state.lastOpenParcelTime = Date.now();
                    } else {
                        // Nếu đợi quá 8 giây không thấy đơn thì bỏ qua dòng này
                        if (Date.now() - state.lastSearchTime > 8000) {
                            writeLog(`⚠️ Không tìm thấy Đơn cho SPH: ${task.sph}. Bỏ qua.`);
                            task.resultStatus = 'Không tìm thấy Đơn';
                            state.step = 'NEXT_TASK';
                        }
                    }
                    break;

                case 'OPEN_PARCEL':
                    // Bước 4: Tìm thửa đất cũ trong Cây tài sản
                    const tree = document.getElementById('treeTaiSan');
                    if (tree) {
                        const anchors = Array.from(tree.querySelectorAll('a.jstree-anchor'));
                        writeLog(`🔍 Đang tìm thửa cũ: Thửa ${task.oldThua}, Tờ ${task.oldTo} (Dạng hiển thị: ${task.oldThua} (${task.oldTo}))`);

                        // In danh sách các thửa đang có trên màn hình ra Console để kiểm tra
                        console.log("Danh sách thửa trên VBDLIS:", anchors.map(a => (a.textContent || '').trim()));

                        // Chuẩn hóa Thửa và Tờ (bỏ số 0 ở đầu để khớp chính xác, vd: "05" thành "5")
                        const cleanOldThua = parseInt(task.oldThua, 10).toString();
                        const cleanOldTo = parseInt(task.oldTo, 10).toString();

                        // Tìm thửa đất cũ có định dạng "Thửa (Tờ)", ví dụ: "271 (10001)" hoặc "271(10001)"
                        const targetAnchor = anchors.find(a => {
                            const txt = (a.textContent || '').trim();

                            // Loại bỏ tất cả dấu cách để so khớp cực kỳ chính xác
                            const cleanTxt = txt.replace(/\s+/g, '');
                            const cleanTarget1 = `${cleanOldThua}(${cleanOldTo})`; // dạng "271(10001)"

                            // Hoặc tìm dạng số liệu cũ nếu đã bị đổi trước đó
                            const cleanTarget2 = `cũ:${cleanOldThua}(${cleanOldTo})`; // dạng "cũ:271(10001)"

                            return cleanTxt.includes(cleanTarget1) || cleanTxt.includes(cleanTarget2);
                        });

                        if (targetAnchor) {
                            writeLog(`🎯 Đã tìm thấy thửa cũ khớp trên cây tài sản! Đang chọn...`);
                            if (!targetAnchor.classList.contains('jstree-clicked')) {
                                if (jq) jq(targetAnchor).click(); else targetAnchor.click();
                            }

                            const btnSua = document.getElementById('btnSuaTaiSan');
                            if (btnSua) {
                                setTimeout(() => {
                                    writeLog("Bấm nút 'Sửa' thửa đất...");
                                    if (jq) jq(btnSua).click(); else btnSua.click();
                                }, 500);
                                state.step = 'EDIT_PARCEL';
                                state.lastEditParcelTime = Date.now();
                            }
                        } else {
                            // Thử tìm xem Thửa mới đã có trên cây tài sản chưa (nghĩa là đã được cập nhật từ trước)
                            const cleanNewTo = parseInt(task.newTo, 10).toString();
                            const alreadyUpdatedAnchor = anchors.find(a => {
                                const txt = (a.textContent || '').trim();
                                const cleanTxt = txt.replace(/\s+/g, '');
                                return task.newThuaList.some(newTh => {
                                    const cleanNewTh = parseInt(newTh, 10).toString();
                                    return cleanTxt.includes(`${cleanNewTh}(${cleanNewTo})`);
                                });
                            });

                            if (alreadyUpdatedAnchor) {
                                writeLog(`✅ Thửa Mới đã có trên hệ thống (đã được cập nhật từ trước). Bỏ qua và đánh dấu thành công.`);
                                task.resultStatus = `Đã cập nhật trước đó`;
                                if (task.isGroup) {
                                    state.groupSuccess[task.groupKey] = true;
                                }
                                state.step = 'REMOVE_DOSSIER';
                                state.lastRemoveTime = Date.now();
                            } else {
                                // Đợi tối đa 10 giây nếu cây chưa load xong
                                if (Date.now() - state.lastOpenParcelTime > 10000) {
                                    writeLog(`⚠️ Không tìm thấy thửa cũ [Thửa ${task.oldThua} (Tờ ${task.oldTo})] → Bỏ đơn ra danh sách.`);
                                    task.resultStatus = `Không tìm thấy thửa ${task.oldThua} (${task.oldTo})`;
                                    state.step = 'REMOVE_DOSSIER';
                                    state.lastRemoveTime = Date.now();
                                }
                            }
                        }
                    }
                    break;

                case 'EDIT_PARCEL':
                    // Bước 5: Tìm form thửa đất (form có ID dạng frmThuaDat-{guid})
                    const formThuaDat = getVisibleElement('div[id^="frmThuaDat-"]');
                    const inputTo = formThuaDat ? formThuaDat.querySelector('input[name="soHieuToBanDo"]') : null;
                    const inputThua = formThuaDat ? formThuaDat.querySelector('input[name="soThuTuThua"]') : null;
                    const btnSaveThua = formThuaDat ? formThuaDat.parentElement.querySelector('button[id^="btnSaveThuaDat-"]') || document.querySelector('button[id^="btnSaveThuaDat-"]') : null;

                    if (formThuaDat && inputTo && inputThua && btnSaveThua) {
                        writeLog(`📝 Form thửa đất đã mở! Đang chờ giao diện ổn định...`);

                        // Khóa trạng thái để setInterval không lặp lại EDIT_PARCEL
                        state.step = 'WAIT_PARCEL_EDITING';

                        // Chờ 800ms cho VBDLIS bind xong tất cả các event listener vào form
                        setTimeout(() => {
                            writeLog(`Tiến hành điền Thửa mới [${task.newThua}], Tờ mới [${task.newTo}]...`);

                            // Hàm điền dữ liệu siêu tin cậy giả lập bàn phím
                            const fillInput = (el, val) => {
                                if (!el) return;
                                el.focus();
                                el.value = val;
                                el.setAttribute('value', val);
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                el.blur();
                                if (jq) jq(el).val(val).trigger('input').trigger('change').trigger('keyup');
                            };

                            fillInput(inputThua, task.newThua);
                            fillInput(inputTo, task.newTo);

                            if (task.newThuaIndex > 0) {
                                writeLog("🔁 Đang thử lại Thửa mới, bỏ qua kiểm tra Nguồn gốc đất.");
                                setTimeout(() => {
                                    writeLog("💾 Bấm lưu Thửa Đất (Thử lại)...");
                                    if (jq) jq(btnSaveThua).click(); else btnSaveThua.click();

                                    state.step = 'WAIT_PARCEL_SAVE';
                                    state.lastSaveTime = Date.now();
                                }, 500);
                            } else {
                                // Duyệt TỪNG mục đích sử dụng → click chọn active → điền Nguồn gốc đất
                                const formMdsdContainer = getVisibleElement('div[id^="frmMucDichSuDung-"]');
                                const mdsdForms = formMdsdContainer ? Array.from(formMdsdContainer.querySelectorAll('form[data-duplicate="mucdichsudung"]')) : [];

                                writeLog(`Tìm thấy ${mdsdForms.length} loại đất cần kiểm tra Nguồn gốc.`);

                                let mdsdDelay = 500; // Đợi 500ms sau khi điền Thửa/Tờ xong
                                mdsdForms.forEach((mdsdForm, idx) => {
                                    // Tối ưu: Nếu đã có sẵn nguồn gốc thì khỏi bấm Mở rộng làm gì cho chậm
                                    const preSelectNguonGoc = mdsdForm.querySelector('select[name="loaiNguonGocSuDungDatId"]');
                                    if (preSelectNguonGoc && preSelectNguonGoc.value && preSelectNguonGoc.value !== '0') {
                                        setTimeout(() => {
                                            writeLog(`✅ MĐSD thứ ${idx + 1} đã có sẵn nguồn gốc (mã ${preSelectNguonGoc.value}), khỏi mở form.`);
                                        }, mdsdDelay);
                                        return; // Bỏ qua form này
                                    }

                                    setTimeout(() => {
                                        // 1. Click vào string-wrapper để expand VÀ chọn form active (VBDLIS yêu cầu)
                                        const stringWrapper = mdsdForm.querySelector('.string-wrapper');
                                        if (stringWrapper) {
                                            if (jq) jq(stringWrapper).click(); else stringWrapper.click();
                                        }
                                        // Force add class để VBDLIS nhận diện form được chọn
                                        if (jq) {
                                            jq(mdsdForm).addClass('item-selected expanded');
                                        } else {
                                            mdsdForm.classList.add('item-selected', 'expanded');
                                        }

                                        // 2. Sau khi form đã mở và active, điền Nguồn gốc đất
                                        setTimeout(() => {
                                            // Tìm select Nguồn gốc ĐẤT (nằm trong div#frmNguonGocSuDung bên trong form MĐSD)
                                            const selectMdsd = mdsdForm.querySelector('select[name="loaiMucDichSuDungId"]');
                                            const selectNguonGoc = mdsdForm.querySelector('select[name="loaiNguonGocSuDungDatId"]');

                                            if (!selectMdsd || !selectNguonGoc) {
                                                writeLog(`⚠️ MĐSD thứ ${idx + 1}: Không tìm thấy select Nguồn gốc.`);
                                                return;
                                            }

                                            const mdsdText = selectMdsd.options[selectMdsd.selectedIndex]?.text || selectMdsd.value || '';
                                            const nguonGocVal = selectNguonGoc.value;

                                            // Nếu đã có mã nguồn gốc (khác 0 và khác rỗng) thì bỏ qua
                                            if (nguonGocVal && nguonGocVal !== '0') {
                                                writeLog(`✅ MĐSD [${mdsdText}] thứ ${idx + 1} đã có nguồn gốc (mã ${nguonGocVal}), bỏ qua.`);
                                                return;
                                            }

                                            // Chỉ ONT hoặc ODT → có thu tiền (mã 2), tất cả còn lại → không thu tiền (mã 3)
                                            const upperMdsd = mdsdText.toUpperCase();
                                            const isDatO = (upperMdsd.includes('ODT') || upperMdsd.includes('ONT'));
                                            const targetVal = isDatO ? '2' : '3';
                                            const targetName = isDatO ? 'Có thu tiền' : 'Không thu tiền';

                                            writeLog(`👉 MĐSD [${mdsdText}] thứ ${idx + 1} → Chọn Nguồn gốc '${targetName}'`);

                                            // Set giá trị và trigger cả native change lẫn Select2 change
                                            selectNguonGoc.value = targetVal;
                                            selectNguonGoc.dispatchEvent(new Event('change', { bubbles: true }));
                                            if (jq) {
                                                jq(selectNguonGoc).val(targetVal).trigger('change').trigger('change.select2');
                                            }
                                        }, 500);
                                    }, mdsdDelay);

                                    mdsdDelay += 1000; // Mỗi loại đất cách nhau 1s để đảm bảo VBDLIS kịp xử lý
                                });

                                // Sau khi xử lý tất cả MĐSD xong mới bấm Lưu Thửa Đất
                                setTimeout(() => {
                                    writeLog("💾 Bấm lưu Thửa Đất...");
                                    if (jq) jq(btnSaveThua).click(); else btnSaveThua.click();

                                    state.step = 'WAIT_PARCEL_SAVE';
                                    state.lastSaveTime = Date.now();
                                }, mdsdDelay + 800);
                            }
                        }, 800); // Đợi form stabilize
                    } else {
                        // Chờ form mở, timeout 8 giây
                        if (Date.now() - state.lastEditParcelTime > 8000) {
                            writeLog("⚠️ Không mở được form chỉnh sửa thửa đất (timeout 8s). Bỏ đơn ra danh sách.");
                            task.resultStatus = 'Lỗi mở form thửa';
                            state.step = 'REMOVE_DOSSIER';
                            state.lastRemoveTime = Date.now();
                        } else {
                            writeLog("⏳ Đang chờ form thửa đất mở...");
                        }
                    }
                    break;

                case 'WAIT_PARCEL_EDITING':
                    // Đang chờ chuỗi setTimeout điền Mục đích sử dụng hoàn tất
                    break;

                case 'WAIT_PARCEL_SAVE':
                    // Kiểm tra xem có báo lỗi "Thửa đất đã tồn tại" không
                    const errorConfirm = document.querySelector('.jconfirm-box');
                    if (errorConfirm) {
                        const msgEl = errorConfirm.querySelector('.jconfirm-content, .jconfirm-message');
                        const msgText = msgEl ? msgEl.textContent.trim().toLowerCase() : '';

                        if (msgText.includes('đã tồn tại') || msgText.includes('tồn tại') || msgText.includes('trùng')) {
                            writeLog(`⚠️ Phát hiện: "${msgText}" → Thửa [${task.newThua}] bị trùng.`);

                            // Bấm "Đồng ý" để đóng dialog
                            const btnOk = errorConfirm.querySelector('.btn-orange');
                            if (btnOk) {
                                if (jq) jq(btnOk).click(); else btnOk.click();
                            }

                            // Chuyển sang đợi dialog tắt
                            state.step = 'WAIT_DIALOG_CLOSE';
                            state.nextStepAfterDialog = 'CHECK_NEXT_THUA';
                            state.lastDialogCloseTime = Date.now();
                        } else {
                            // Dialog khác (có thể là thành công) → bấm đồng ý và tiếp tục
                            const btnOk = errorConfirm.querySelector('.btn-orange');
                            if (btnOk) {
                                if (jq) jq(btnOk).click(); else btnOk.click();
                            }

                            state.step = 'WAIT_DIALOG_CLOSE';
                            state.nextStepAfterDialog = 'SAVE_REGISTRATION';
                            state.lastDialogCloseTime = Date.now();
                        }
                    } else {
                        // Không có dialog → lưu thành công, chuyển sang bước tiếp
                        if (Date.now() - state.lastSaveTime > 3000) {
                            state.step = 'SAVE_REGISTRATION';
                        }
                    }
                    break;

                case 'CHECK_NEXT_THUA':
                    task.newThuaIndex++;
                    if (task.newThuaIndex < task.newThuaList.length) {
                        task.newThua = task.newThuaList[task.newThuaIndex];
                        writeLog(`🔁 Thử lại với Số thửa mới: ${task.newThua} (Thửa ${task.newThuaIndex + 1}/${task.newThuaList.length})...`);
                        state.step = 'EDIT_PARCEL';
                    } else {
                        writeLog(`⚠️ Đã thử hết ${task.newThuaList.length} số thửa nhưng đều bị TRÙNG. Bỏ đơn ra danh sách.`);
                        task.resultStatus = `Trùng thửa (đã thử ${task.newThuaList.length} số)`;
                        state.step = 'CLOSE_PARCEL_FORM_ERROR';
                    }
                    break;

                case 'CLOSE_PARCEL_FORM_ERROR':
                    // Đóng form sửa thửa đất sau khi báo lỗi
                    const btnCloseForm = document.querySelector('button.btn-blue[data-dismiss="modal"]');
                    if (btnCloseForm) {
                        writeLog("Bấm 'Đóng' form sửa thửa đất...");
                        if (jq) jq(btnCloseForm).click(); else btnCloseForm.click();
                    }
                    state.step = 'REMOVE_DOSSIER';
                    state.lastRemoveTime = Date.now();
                    break;

                case 'SAVE_REGISTRATION':
                    // Bước 6: Lưu thông tin đăng ký
                    const btnSaveDangKy = document.getElementById('btnLuuDangKyThongTinDangKy');
                    if (btnSaveDangKy) {
                        writeLog("Bước 6: Bấm 'Lưu thông tin đăng ký'...");
                        if (jq) jq(btnSaveDangKy).click(); else btnSaveDangKy.click();
                        state.step = 'WAIT_REGISTRATION_SAVE';
                        state.lastSaveRegTime = Date.now();
                    } else {
                        if (!state.lastSaveRegSearch) state.lastSaveRegSearch = Date.now();
                        if (Date.now() - state.lastSaveRegSearch > 3000) {
                            writeLog("⚠️ Không tìm thấy nút Lưu đăng ký, bỏ qua.");
                            state.step = 'REMOVE_DOSSIER';
                            state.lastRemoveTime = Date.now();
                            state.lastSaveRegSearch = 0;
                        }
                    }
                    break;

                case 'WAIT_REGISTRATION_SAVE':
                    // Đợi jconfirm thông báo lưu thông tin đăng ký thành công
                    const regConfirm = document.querySelector('.jconfirm-box');
                    if (regConfirm) {
                        const btnOk = regConfirm.querySelector('.btn-orange') || regConfirm.querySelector('.btn-blue');
                        if (btnOk) {
                            writeLog("Xác nhận 'Đồng ý' đã lưu thông tin đăng ký...");
                            if (jq) jq(btnOk).click(); else btnOk.click();
                        }
                        state.step = 'WAIT_DIALOG_CLOSE';
                        state.nextStepAfterDialog = 'REMOVE_DOSSIER';
                        state.lastDialogCloseTime = Date.now();
                    } else {
                        if (Date.now() - state.lastSaveRegTime > 3000) {
                            // Nếu sau 3s không thấy popup thì tự đi tiếp
                            state.step = 'REMOVE_DOSSIER';
                            state.lastRemoveTime = Date.now();
                        }
                    }
                    break;

                case 'REMOVE_DOSSIER':
                    // Bước 7: Bỏ đơn khỏi danh sách và xác nhận
                    const btnBoDon = document.getElementById('btnBoDonDangKy');
                    if (btnBoDon) {
                        writeLog("Bước 7: Bấm 'Bỏ đơn khỏi danh sách'...");
                        if (jq) jq(btnBoDon).click(); else btnBoDon.click();
                        state.step = 'CONFIRM_REMOVE';
                        state.lastRemoveTime = Date.now();
                    } else {
                        if (Date.now() - state.lastRemoveTime > 3000) {
                            writeLog("⚠️ Không tìm thấy nút Bỏ đơn. Tiếp tục sang đơn mới.");
                            state.step = 'NEXT_TASK';
                        }
                    }
                    break;

                case 'CONFIRM_REMOVE':
                    // Xác nhận bảng jConfirm
                    const confirmBox = document.querySelector('.jconfirm-box');
                    if (confirmBox) {
                        const btnAgree = confirmBox.querySelector('.btn-orange');
                        if (btnAgree) {
                            writeLog("Xác nhận 'Đồng ý' bỏ đơn...");
                            if (jq) jq(btnAgree).click(); else btnAgree.click();

                            state.step = 'WAIT_DIALOG_CLOSE';
                            state.nextStepAfterDialog = 'NEXT_TASK';
                            state.lastDialogCloseTime = Date.now();
                        }
                    } else {
                        // Nếu jconfirm chưa hiện hoặc đã tự mất
                        if (Date.now() - state.lastRemoveTime > 4000) {
                            state.step = 'NEXT_TASK';
                        }
                    }
                    break;

                case 'WAIT_DIALOG_CLOSE':
                    // Chờ VBDLIS làm mờ và xóa thẻ jconfirm-box khỏi màn hình
                    if (!document.querySelector('.jconfirm-box')) {
                        state.step = state.nextStepAfterDialog;
                    } else {
                        if (Date.now() - state.lastDialogCloseTime > 3000) {
                            state.step = state.nextStepAfterDialog;
                        }
                    }
                    break;

                case 'NEXT_TASK':
                    if (!task.resultStatus || task.resultStatus === 'Cập nhật thành công') {
                        if (task.isGroup) {
                            task.resultStatus = 'Ứng đại diện';
                            state.groupSuccess[task.groupKey] = true;
                        } else {
                            task.resultStatus = 'Cập nhật thành công';
                        }
                    }

                    writeLog(`✅ Dòng thứ ${state.currentIndex + 1}: ${task.resultStatus}`);
                    state.currentIndex++;
                    updateResultBox();
                    state.step = 'OPEN_SEARCH';
                    break;
            }
        }, 700);

        // Cập nhật bảng Kết quả (tab Kết quả)
        function updateResultBox() {
            const tbody = document.getElementById('result-table-body');
            if (!tbody) return;

            let done = 0, fail = 0, pending = 0;
            let html = '';

            state.excelData.forEach((d, i) => {
                let status, cssClass, rowClass;
                if (i < state.currentIndex) {
                    const raw = d.resultStatus || 'Cập nhật thành công';
                    const isOk = raw === 'Cập nhật thành công' || raw === 'Ứng đại diện' || raw === 'Đã ứng đại diện' || raw === 'Đã cập nhật trước đó';
                    if (isOk) {
                        status = raw === 'Cập nhật thành công' ? '✅ OK' : '✅ ' + raw;
                        cssClass = 'status-ok';
                        rowClass = 'row-success';
                        done++;
                    } else {
                        status = '❌ ' + raw;
                        cssClass = 'status-err';
                        rowClass = 'row-fail';
                        fail++;
                    }
                } else if (i === state.currentIndex && state.isRunning) {
                    status = '🔄';
                    cssClass = 'status-run';
                    rowClass = 'row-current';
                    pending++;
                } else {
                    status = '—';
                    cssClass = 'status-wait';
                    rowClass = '';
                    pending++;
                }
                html += `<tr class="${rowClass}">
                <td>${i + 1}</td>
                <td title="${escapeHtml(d.sph)}">${escapeHtml(d.sph)}</td>
                <td>${escapeHtml(d.oldThua)}(${escapeHtml(d.oldTo)}) → ${escapeHtml(d.newThua)}(${escapeHtml(d.newTo)})</td>
                <td class="${cssClass}" title="${escapeHtml(d.resultStatus || '')}">${escapeHtml(status)}</td>
            </tr>`;
            });

            tbody.innerHTML = html;

            // Cập nhật thống kê
            const elDone = document.getElementById('stat-current');
            const elFail = document.getElementById('result-fail');
            const elPending = document.getElementById('result-pending');
            if (elDone) elDone.textContent = `✅ ${done}`;
            if (elFail) elFail.textContent = `❌ ${fail}`;
            if (elPending) elPending.textContent = `⏳ ${pending}`;

            // Auto-scroll đến dòng đang xử lý
            const wrapper = document.querySelector('.result-table-wrapper');
            const currentRow = tbody.querySelector('.row-current');
            if (wrapper && currentRow) {
                currentRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }


        function init() {
            const btnParse = document.getElementById('btn-update-parse');
            if (btnParse) btnParse.addEventListener('click', parseExcelInput);

            const btnStart = document.getElementById('btn-update-start');
            if (btnStart) btnStart.addEventListener('click', () => {
                const dot = document.getElementById('update-dot');
                if (dot) {
                    dot.style.background = '#10b981';
                    dot.style.boxShadow = '0 0 8px #10b981';
                }
                startAuto();
            });

            const btnStop = document.getElementById('btn-update-stop');
            if (btnStop) btnStop.addEventListener('click', () => {
                const dot = document.getElementById('update-dot');
                if (dot) {
                    dot.style.background = '#ef4444';
                    dot.style.boxShadow = '0 0 8px #ef4444';
                }
                stopAuto();
            });

            const btnCopy = document.getElementById('btn-update-copy');
            if (btnCopy) btnCopy.addEventListener('click', () => {
                const lines = state.excelData.map(d => d.resultStatus || 'Chưa xử lý');
                const text = lines.join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    writeLog('📋 Đã copy Trạng Thái Gốc vào clipboard!');
                }).catch(() => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                    writeLog('📋 Đã copy (fallback)');
                });
            });
        }

        return { init };
    })();

export { UpdateParcelModule };
