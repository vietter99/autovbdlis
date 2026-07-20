import { escapeHtml, fallbackCopyTextToClipboard } from './utils.js';

    const ExcelModule = (function () {
        let state = {
            records: []
        };

        function init() {
            loadState();
            renderTable();

            // Bắt sự kiện ở tầng cao nhất (Window) để đánh bại hoàn toàn các lớp chặn click của VBDLIS
            window.addEventListener('mousedown', (e) => {
                const btnClear = e.target.closest('#btn-excel-clear');
                if (btnClear) {
                    e.preventDefault(); e.stopPropagation();
                    if (unsafeWindow.confirm('Xóa toàn bộ hồ sơ đã lưu?')) {
                        state.records = [];
                        saveState();
                        renderTable();
                    }
                    return;
                }

                const btnCopyAll = e.target.closest('#btn-excel-copy');
                if (btnCopyAll) {
                    e.preventDefault(); e.stopPropagation();
                    copyToExcel(true);
                    return;
                }

                const btnCopyRow = e.target.closest('.btn-copy-row');
                if (btnCopyRow) {
                    e.preventDefault(); e.stopPropagation();
                    const idx = parseInt(btnCopyRow.getAttribute('data-idx'));
                    copyRowToExcel(idx, btnCopyRow, true);
                    return;
                }
            }, true);

            // Tự động quét tree mỗi 1 giây
            setInterval(scanTree, 1000);
        }

        function loadState() {
            try {
                const stored = localStorage.getItem('mplis_excel_cart');
                if (stored) state.records = JSON.parse(stored);
            } catch (e) { }
        }

        function saveState() {
            localStorage.setItem('mplis_excel_cart', JSON.stringify(state.records));
        }

        function renderTable() {
            const tbody = document.querySelector('#table-excel-cart tbody');
            const count = document.getElementById('excel-count');
            if (!tbody || !count) return;

            count.textContent = state.records.length;
            tbody.innerHTML = state.records.map((r, idx) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05); color:#fde047; font-weight:bold;">${escapeHtml(r.maHS || '---')}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.gcn)}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.thua)}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.to)}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.dt)}</td>
                    <td style="padding:2px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
                        <i class="fa fa-copy btn-copy-row" data-idx="${idx}" style="cursor:pointer; color:#0ea5e9; font-size:12px; padding:2px; pointer-events:auto; position:relative; z-index:9999;" title="Copy dòng này"></i>
                    </td>
                </tr>
            `).join('');
        }

        function getRowText(r, isFull = false) {
            if (isFull) {
                return [
                    r.loaiHS || '', r.maHS || '', r.nguoiNop || '', r.diaChi || '',
                    r.gcn, r.thua, r.to, r.dt,
                    r.dtO || '', r.dtCLN || '', r.dtTSN || '',
                    r.dtLUA || '', r.dtHNK || '', r.dtSKC || ''
                ].join('\t');
            } else {
                return [
                    r.gcn, r.thua, r.to, r.dt,
                    r.dtO || '', r.dtCLN || '', r.dtTSN || '',
                    r.dtLUA || '', r.dtHNK || '', r.dtSKC || ''
                ].join('\t');
            }
        }

        function copyRowToExcel(idx, btn, isFull = false) {
            const r = state.records[idx];
            if (!r) return;
            const text = getRowText(r, isFull);
            fallbackCopyTextToClipboard(text).then(() => {
                btn.className = 'fa fa-check btn-copy-row';
                btn.style.color = '#10b981';
                setTimeout(() => {
                    btn.className = 'fa fa-copy btn-copy-row';
                    btn.style.color = '#0ea5e9';
                }, 1500);
            });
        }

        function copyToExcel(isFull = false) {
            if (state.records.length === 0) {
                unsafeWindow.alert('Không có dữ liệu!');
                return;
            }

            let lines = [];
            state.records.forEach(r => {
                lines.push(getRowText(r, isFull));
            });

            const text = lines.join('\n');
            fallbackCopyTextToClipboard(text).then(() => {
                const btn = document.getElementById('btn-excel-copy');
                const oldText = btn.innerHTML;
                btn.innerHTML = 'ĐÃ COPY ✅';
                setTimeout(() => btn.innerHTML = oldText, 2000);
            });
        }

        function scanTree() {
            // Chỉ sử dụng cây của QT3 vì thông tin chính xác hơn
            const tree = document.getElementById('treeGiayChungNhan');
            if (!tree) return;

            let maHS = '';

            // 1. Tìm tất cả các thẻ <b> hoặc <span> có chứa định dạng Mã HS (vd: H15.50-260706-1377)
            const allNodes = Array.from(document.querySelectorAll('b, span, .modal-title, h4'));
            const validNodes = [];

            for (let node of allNodes) {
                if (!node.textContent) continue;
                const m = node.textContent.match(/[A-Z0-9]{2,}\.[A-Z0-9]{2,}\-\d{6}\-\d{4,}/i);
                if (m) {
                    // Bỏ qua các thẻ bị ẩn (display:none từ cha hoặc tự nó)
                    const rect = node.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        validNodes.push({ node, text: m[0] });
                    }
                }
            }

            if (validNodes.length > 0) {
                let targetNode = null;

                // Ưu tiên 1: Nằm trong modal-title (chuẩn nhất)
                targetNode = validNodes.find(item => item.node.closest('.modal-title'));

                // Ưu tiên 2: KHÔNG nằm trong bảng (loại trừ ngay cái background table)
                if (!targetNode) {
                    const notInTable = validNodes.filter(item => !item.node.closest('tr'));
                    if (notInTable.length > 0) {
                        // Lấy cái xuất hiện CUỐI CÙNG trên DOM (vì modal/chi tiết thường đè lên cuối cùng)
                        targetNode = notInTable[notInTable.length - 1];
                    }
                }

                // Fallback: Nếu vẫn không có, cứ lấy cái hiển thị cuối cùng
                if (!targetNode) {
                    targetNode = validNodes[validNodes.length - 1];
                }

                if (targetNode) {
                    const full = targetNode.text;
                    const parts = full.split('-');
                    if (parts.length >= 3) {
                        maHS = parts[1].slice(-2) + '-' + parts[2];
                    } else {
                        maHS = full.slice(-7);
                    }
                }
            }
            if (maHS) maHS = maHS.toUpperCase();

            // Truy tìm thêm thông tin: Loại HS, Người Nộp, Địa chỉ từ bảng nền
            let loaiHS = '', nguoiNop = '', diaChi = '';
            if (maHS) {
                const trs = Array.from(document.querySelectorAll('tr[role="row"]'));
                for (let tr of trs) {
                    if (tr.textContent.includes(maHS)) {
                        const col1 = tr.querySelector('.col-md-3:nth-child(1)');
                        if (col1) {
                            const titleDiv = col1.querySelector('div[title]');
                            const titleStr = titleDiv ? titleDiv.getAttribute('title').toLowerCase() : col1.textContent.toLowerCase();
                            if (titleStr.includes('xóa đăng ký thế chấp') || titleStr.includes('xóa đăng ký biện pháp bảo đảm')) loaiHS = 'XTC';
                            else if (titleStr.includes('đăng ký thế chấp') || titleStr.includes('đăng ký biện pháp bảo đảm')) loaiHS = 'TC';
                            else if (titleStr.includes('tách thửa')) loaiHS = 'TT';
                            else if (titleStr.includes('đăng ký biến động')) loaiHS = 'BĐ';

                            const mapMarker = col1.querySelector('.fa-map-marker');
                            if (mapMarker && mapMarker.parentNode) {
                                let fullAddr = mapMarker.parentNode.textContent.trim();
                                fullAddr = fullAddr.split('(')[0].trim();
                                fullAddr = fullAddr.replace(/xã |phường |thị trấn /gi, '').trim();
                                diaChi = fullAddr.toUpperCase();
                            }
                        }
                        const col4 = tr.querySelector('.col-md-3:nth-child(4)');
                        if (col4) {
                            const bElements = col4.querySelectorAll('b');
                            if (bElements.length > 0) nguoiNop = bElements[0].textContent.trim().toUpperCase();
                        }
                        break;
                    }
                }
            }

            // Quét từng Giấy chứng nhận (Hỗ trợ 1 đơn nhiều GCN)
            const gcnNodes = Array.from(tree.querySelectorAll('li.jstree-node')).filter(li => {
                const a = li.querySelector(':scope > a.jstree-anchor');
                return a && (a.textContent.includes('Giấy chứng nhận') || a.textContent.includes('Số phát hành:'));
            });

            gcnNodes.forEach(gcnLi => {
                let gcn = '';
                const gcnAnchor = gcnLi.querySelector(':scope > a.jstree-anchor');
                if (gcnAnchor) {
                    const text = gcnAnchor.textContent;
                    const m = text.match(/Số phát hành:\s*([A-Z0-9\s]+?)\s*-/i);
                    if (m && !m[1].includes('-/-')) {
                        gcn = m[1].trim();
                    } else {
                        // Fallback lấy mã nội bộ nếu chưa có số phát hành
                        const fb = text.match(/Giấy chứng nhận\s+([A-Z0-9_]+)/i);
                        if (fb) gcn = fb[1];
                    }
                }
                if (!gcn) gcn = 'CHƯA RÕ';

                // Tìm các Thửa đất nằm bên trong GCN này (Hỗ trợ 1 GCN nhiều Thửa)
                const thuaNodes = Array.from(gcnLi.querySelectorAll('li.jstree-node')).filter(li => {
                    const a = li.querySelector(':scope > a.jstree-anchor');
                    return a && a.textContent.includes('Thửa đất');
                });

                thuaNodes.forEach(thuaLi => {
                    let thua = '', to = '', dt = 0;
                    const thuaAnchor = thuaLi.querySelector(':scope > a.jstree-anchor');
                    if (thuaAnchor) {
                        // Dấu ngoặc tờ bản đồ (xx) có thể không có
                        const m = thuaAnchor.textContent.match(/Thửa đất.*?\s+(\d+)(?:\s*\((\d+)\))?\s*-\s*Diện tích:\s*([\d.]+)/i);
                        if (m) {
                            thua = m[1].trim();
                            to = m[2] ? m[2].trim() : '-';
                            dt = parseFloat(m[3]);
                        }
                    }
                    if (!thua) return;

                    let dienTichCacLoai = { ODT: 0, ONT: 0, CLN: 0, TSN: 0, LUC: 0, LUK: 0, BUN: 0, LUA: 0, HNK: 0, SKC: 0 };
                    // Lấy các mục đích sử dụng nằm bên trong Thửa đất này
                    const loaiDatNodes = Array.from(thuaLi.querySelectorAll('a.jstree-anchor')).filter(a => /^[A-Z]{3}:/.test(a.textContent.trim()));
                    loaiDatNodes.forEach(node => {
                        const text = node.textContent.trim();
                        const typeMatch = text.match(/^([A-Z]{3}):/);
                        const areaMatch = text.match(/Diện tích:\s*([\d.]+)/i);
                        if (typeMatch && areaMatch) {
                            dienTichCacLoai[typeMatch[1]] = parseFloat(areaMatch[1]);
                        }
                    });

                    const datO = (dienTichCacLoai.ODT || 0) + (dienTichCacLoai.ONT || 0);
                    const datCLN = dienTichCacLoai.CLN || 0;
                    const datTSN = dienTichCacLoai.TSN || 0;
                    const datLUA = (dienTichCacLoai.LUC || 0) + (dienTichCacLoai.LUK || 0) + (dienTichCacLoai.BUN || 0) + (dienTichCacLoai.LUA || 0);
                    const datHNK = dienTichCacLoai.HNK || 0;
                    const datSKC = dienTichCacLoai.SKC || 0;

                    const exists = state.records.some(r => r.gcn === gcn && r.thua === thua && r.to === to);
                    if (!exists) {
                        state.records.push({
                            maHS, loaiHS, nguoiNop, diaChi, gcn, thua, to, dt,
                            dtO: datO, dtCLN: datCLN, dtTSN: datTSN,
                            dtLUA: datLUA, dtHNK: datHNK, dtSKC: datSKC
                        });
                        saveState();
                        renderTable();

                        tree.style.boxShadow = '0 0 10px #10b981';
                        setTimeout(() => tree.style.boxShadow = 'none', 1000);
                    }
                });
            });
        }

        return { init };
    })();

export { ExcelModule };
