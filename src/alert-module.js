import { fallbackCopyTextToClipboard } from './utils.js';

    const AlertModule = (function () {
        let savedDetected = [];
        try { savedDetected = JSON.parse(sessionStorage.getItem('mplis_detected_dossiers')) || []; } catch (e) { }

        const state = {
            alertThresholdMinutes: 1440, // mặc định 1 ngày (1440 phút)
            detectedDossiers: savedDetected,
            allDossiers: [],
            currentTab: 'all',
            searchQuery: ''
        };

        function writeLog(msg) {
            const logContent = document.getElementById('vbdlis-m-logs');
            if (!logContent) return;
            const time = new Date().toLocaleTimeString();
            logContent.innerHTML += `[${time}] ${msg}\n`;
            logContent.scrollTop = logContent.scrollHeight;
        }

        function updateStatus(text, type) {
            const statusText = document.getElementById('stat-m-status');
            const statusDot = document.getElementById('stat-m-status-dot');
            if (statusText) statusText.textContent = text;
            if (statusDot) {
                statusDot.className = 'mplis-status-dot';
                if (type === 'active') statusDot.classList.add('active');
                if (type === 'waiting') statusDot.classList.add('waiting');
                if (type === 'idle') statusDot.classList.remove('active', 'waiting');
            }
        }

        function copyAllVisible() {
            let lines = [];
            state.allDossiers.forEach(dos => {
                if (dos.element.style.display !== 'none') {
                    lines.push(`${dos.loaiHoSo}\t${dos.maHoSoRutGon}\t${dos.nguoiNop}\t${dos.diaChi}`);
                }
            });

            if (lines.length === 0) {
                writeLog("ℹ️ Không có hồ sơ nào đang hiển thị để copy.");
                return;
            }

            const textToCopy = lines.join('\n');
            fallbackCopyTextToClipboard(textToCopy).then(() => {
                const btn = document.getElementById('btn-m-copy-all');
                const oldHtml = btn.innerHTML;
                btn.innerHTML = `<i class="fa fa-check"></i> ${lines.length}`;
                btn.style.background = '#059669';
                writeLog(`✅ Đã copy hàng loạt ${lines.length} hồ sơ.`);

                setTimeout(() => {
                    btn.innerHTML = oldHtml;
                    btn.style.background = '#10b981';
                }, 2500);
            }).catch(err => writeLog("⚠️ Lỗi copy: " + err));
        }

        function parseDateVn(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split(/[\:\/ ]+/);
            if (parts.length >= 5) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const hours = parseInt(parts[3], 10);
                const minutes = parseInt(parts[4], 10);
                return new Date(year, month, day, hours, minutes);
            }
            return null;
        }

        const TONGHOP_PROCS = [
            'tách thửa hoặc hợp thửa đất - trường hợp không thay đổi người sử dụng đất',
            'tách thửa hoặc hợp thửa đất - trường hợp có thay đổi người sử dụng đất',
            'trường hợp cấp đổi giấy chứng nhận đã cấp theo quy định tại điểm h mục 1 phần vii'
        ];

        function isTongHop(dos) {
            // Phải là bước 5. Lưu trữ hoặc 8. Lưu trữ
            const isLuuTru = /^5\./.test(dos.buocXl) || /^8\./.test(dos.buocXl);
            if (!isLuuTru) return false;
            // Phải khớp một trong các tên thủ tục Tổng hợp
            const rowText = (dos.element.textContent || '').toLowerCase();
            return TONGHOP_PROCS.some(p => rowText.includes(p));
        }

        function applyFilters() {
            let visibleCount = 0;
            state.allDossiers.forEach(dos => {
                let isMatch = true;

                if (state.currentTab === 'tonghop') {
                    isMatch = isTongHop(dos);
                } else {
                    if (state.currentTab !== 'iso' && dos.isKetIso) isMatch = false;

                    if (isMatch && state.currentTab !== 'all') {
                        if (state.currentTab === 'iso') {
                            if (!dos.isKetIso) isMatch = false;
                        } else {
                            const regex = new RegExp('(^|[^0-9])' + state.currentTab + '\\.');
                            if (!regex.test(dos.buocXl)) isMatch = false;
                        }
                    }
                }

                if (isMatch && state.searchQuery) {
                    const queryMatch = dos.maHoSo.toLowerCase().includes(state.searchQuery) ||
                        dos.nguoiNop.toLowerCase().includes(state.searchQuery);
                    if (!queryMatch) isMatch = false;
                }

                dos.element.style.display = isMatch ? '' : 'none';
                if (isMatch) visibleCount++;
            });

            const elTotal = document.getElementById('stat-m-total');
            const elVisible = document.getElementById('stat-m-visible');
            if (elTotal) elTotal.textContent = state.allDossiers.length;
            if (elVisible) elVisible.textContent = visibleCount;
        }

        function scanTable() {
            const btn = document.getElementById('btn-m-scan-now');
            if (btn) {
                btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                btn.style.background = '#64748b';
            }

            // Quét ngay lập tức dữ liệu hiện tại trên màn hình
            setTimeout(() => {
                doScan();
                if (btn) {
                    btn.innerHTML = '<i class="fa fa-magic"></i>';
                    btn.style.background = '#0ea5e9';
                }
            }, 100);
        }

        function doScan() {
            const trs = document.querySelectorAll('tr[role="row"]');
            state.allDossiers = [];
            let countWarning = 0;
            const now = new Date();
            state.alertThresholdMinutes = parseFloat(document.getElementById('cfg-alert-minutes').value) || 1440;
            const msPerMinute = 60 * 1000;

            trs.forEach(tr => {
                if (tr.querySelector('th')) return;

                const isKetIso = tr.textContent.toLowerCase().includes('kết iso');
                const playPauseIcon = tr.querySelector('.st-column i');
                const isPaused = playPauseIcon && playPauseIcon.classList.contains('fa-pause');

                const col1 = tr.querySelector('.col-md-3:nth-child(1)');
                const maHoSoEl = col1 ? col1.querySelector('b') : null;
                const maHoSoFull = maHoSoEl ? maHoSoEl.textContent.trim() : '';

                let maHoSoRutGon = maHoSoFull;
                if (maHoSoFull) {
                    const parts = maHoSoFull.split('-');
                    if (parts.length >= 3) {
                        const datePart = parts[1];
                        const seqPart = parts[2];
                        if (datePart.length >= 2) maHoSoRutGon = datePart.slice(-2) + '-' + seqPart;
                    }
                    maHoSoRutGon = maHoSoRutGon.toUpperCase();
                }

                let loaiHoSo = '';
                if (col1) {
                    const titleDiv = col1.querySelector('div[title]');
                    const titleStr = titleDiv ? titleDiv.getAttribute('title').toLowerCase() : col1.textContent.toLowerCase();
                    if (titleStr.includes('xóa đăng ký thế chấp') || titleStr.includes('xóa đăng ký biện pháp bảo đảm')) loaiHoSo = 'XTC';
                    else if (titleStr.includes('đăng ký thế chấp') || titleStr.includes('đăng ký biện pháp bảo đảm')) loaiHoSo = 'TC';
                }

                let diaChi = '';
                if (col1) {
                    const mapMarker = col1.querySelector('.fa-map-marker');
                    if (mapMarker && mapMarker.parentNode) {
                        let fullAddr = mapMarker.parentNode.textContent.trim();
                        fullAddr = fullAddr.split('(')[0].trim();
                        fullAddr = fullAddr.replace(/xã |phường |thị trấn /gi, '').trim();
                        diaChi = fullAddr.toUpperCase();
                    }
                }

                const col2 = tr.querySelector('.col-md-3:nth-child(2)');
                let henTraStr = '';
                let tiepNhanStr = '';
                if (col2) {
                    const badge = col2.querySelector('.badge-warning span, .badge-info span, .badge span');
                    if (badge) henTraStr = badge.textContent.trim();

                    const spanLabels = col2.querySelectorAll('span');
                    for (let i = 0; i < spanLabels.length; i++) {
                        if (spanLabels[i].textContent.includes('Tiếp nhận:')) {
                            const nextDiv = spanLabels[i].parentElement.nextElementSibling;
                            if (nextDiv) tiepNhanStr = nextDiv.textContent.trim();
                            break;
                        }
                    }
                }

                const col3 = tr.querySelector('.col-md-3:nth-child(3)');
                let buocXl = '';
                if (col3) {
                    const bElements = col3.querySelectorAll('b');
                    if (bElements.length > 0) buocXl = bElements[0].textContent.trim();
                }

                const col4 = tr.querySelector('.col-md-3:nth-child(4)');
                let nguoiNop = '';
                if (col4) {
                    const bElements = col4.querySelectorAll('b');
                    if (bElements.length > 0) nguoiNop = bElements[0].textContent.trim().toUpperCase();
                }

                if (maHoSoFull) {
                    if ((buocXl.includes('4.') || buocXl.includes('5.')) && col1 && !col1.querySelector('.mplis-btn-copy')) {
                        const copyBtn = document.createElement('a');
                        copyBtn.className = 'mplis-btn-copy';
                        copyBtn.innerHTML = '<span style="font-size:10px; font-weight:bold;">COPY</span>';
                        copyBtn.style.cssText = 'margin-left:8px; cursor:pointer; color:#0ea5e9; font-size:14px; transition: color 0.2s;';
                        copyBtn.title = 'Copy nhanh: Loại HS | Mã HS | Người Nộp | Địa Chỉ';
                        copyBtn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const textToCopy = `${loaiHoSo}\t${maHoSoRutGon}\t${nguoiNop}\t${diaChi}`;
                            fallbackCopyTextToClipboard(textToCopy).then(() => {
                                copyBtn.innerHTML = '<span style="color:#10b981; font-size:10px; font-weight:bold;">OK</span>';
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<span style="font-size:10px; font-weight:bold;">COPY</span>';
                                }, 2000);
                            });
                        };
                        if (maHoSoEl) maHoSoEl.parentNode.appendChild(copyBtn);
                    }

                    const dossier = { maHoSo: maHoSoFull, maHoSoRutGon, loaiHoSo, diaChi, tiepNhanStr, henTraStr, buocXl, nguoiNop, isPaused, isKetIso, element: tr };
                    state.allDossiers.push(dossier);

                    tr.style.backgroundColor = '';
                    tr.style.borderLeft = '';

                    if (isPaused) {
                        tr.style.backgroundColor = '#f1f5f9';
                        tr.style.borderLeft = '4px solid #94a3b8';
                    } else if (henTraStr && !isKetIso) {
                        const henTra = parseDateVn(henTraStr);
                        if (henTra) {
                            const diffMs = henTra - now;
                            const diffMinutes = diffMs / msPerMinute;

                            if (diffMinutes <= state.alertThresholdMinutes) {
                                countWarning++;
                                tr.style.backgroundColor = diffMinutes < 0 ? '#fee2e2' : '#fef3c7';
                                tr.style.borderLeft = diffMinutes < 0 ? '4px solid #ef4444' : '4px solid #f59e0b';
                                const status = diffMinutes < 0 ? "TRỄ HẠN" : "Sắp trễ";

                                if (!state.detectedDossiers.includes(maHoSoFull)) {
                                    state.detectedDossiers.push(maHoSoFull);
                                    sessionStorage.setItem('mplis_detected_dossiers', JSON.stringify(state.detectedDossiers));
                                    writeLog(`🚨 [${status}] ${maHoSoFull} | ${buocXl}`);
                                }
                            }
                        }
                    }
                }
            });

            document.getElementById('stat-m-count').textContent = countWarning;
            writeLog(`✅ Tìm thấy ${state.allDossiers.length} hồ sơ. Có ${countWarning} hồ sơ cần chú ý.`);

            // Sắp xếp theo Hạn trả tăng dần (gần nhất lên đầu), hồ sơ không có hạn xuống cuối
            state.allDossiers.sort((a, b) => {
                const da = parseDateVn(a.henTraStr);
                const db = parseDateVn(b.henTraStr);
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;
                return da - db;
            });

            // Sắp xếp lại DOM theo thứ tự đã sort
            if (state.allDossiers.length > 0) {
                const tbody = state.allDossiers[0].element.parentNode;
                if (tbody) state.allDossiers.forEach(dos => tbody.appendChild(dos.element));
            }

            applyFilters();
        }

        return {
            init: function () {
                document.getElementById('btn-m-scan-now').onclick = scanTable;

                const btnReload = document.getElementById('btn-m-reload-table');
                if (btnReload) {
                    btnReload.onclick = () => {
                        let btn = document.getElementById('btnTraCuuHoSoTiepNhan') || document.getElementById('btnTraCuu');
                        if (!btn) {
                            const searchIcon = document.querySelector('a i.fa-search, button i.fa-search');
                            if (searchIcon) btn = searchIcon.parentElement;
                        }

                        // Nếu vẫn không thấy, thử tìm trong các iframe (trường hợp VBDLIS dùng iframe)
                        if (!btn) {
                            for (let i = 0; i < window.frames.length; i++) {
                                try {
                                    let doc = window.frames[i].document;
                                    btn = doc.getElementById('btnTraCuuHoSoTiepNhan') || doc.getElementById('btnTraCuu');
                                    if (!btn) {
                                        const icon = doc.querySelector('a i.fa-search, button i.fa-search');
                                        if (icon) btn = icon.parentElement;
                                    }
                                    if (btn) break;
                                } catch (e) { }
                            }
                        }

                        if (btn) {
                            writeLog("🔄 Đang yêu cầu tải lại dữ liệu...");
                            btn.click();
                        } else {
                            writeLog("⚠️ Không tìm thấy nút tải lại trên trang (hoặc iframe)!");
                        }
                    };
                }

                const btnCopyAll = document.getElementById('btn-m-copy-all');
                if (btnCopyAll) btnCopyAll.onclick = copyAllVisible;

                document.querySelectorAll('#tab-alert .mplis-filter-tab').forEach(tab => {
                    tab.onclick = (e) => {
                        document.querySelectorAll('#tab-alert .mplis-filter-tab').forEach(t => {
                            t.style.background = 'transparent';
                            t.style.color = '#94a3b8';
                        });
                        e.target.style.background = 'rgba(14,165,233,0.3)';
                        e.target.style.color = '#fff';
                        state.currentTab = e.target.dataset.step;
                        applyFilters();
                    };
                });
            },
            getTopState: function () { return state; }
        };
    })();

export { AlertModule };
