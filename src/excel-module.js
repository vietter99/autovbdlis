import { escapeHtml, fallbackCopyTextToClipboard, findCurrentMaHS } from './utils.js';

    const ExcelModule = (function () {
        // Mã loại biến động (bắt lúc QT1 bởi bien-dong-capture.js) -> tên gọi đầy đủ.
        // Bổ sung dần khi gặp mã mới; loại nào chưa có ở đây sẽ tạm hiện mã hoặc tiêu đề gốc,
        // không đoán bừa tên.
        const BIEN_DONG_CODE_MAP = {
            'CD': 'Cấp đổi',
            'TK': 'Thừa kế',
            'SN': 'Đính chính'
        };

        // 4 xã "của tôi" - mỗi xã 1 bảng riêng, lọc theo r.diaChi (đã chuẩn hóa hoa, bỏ tiền tố "Xã ")
        const MY_COMMUNES = [
            { key: 'krongnang', label: 'Krông Năng', match: 'KRÔNG NĂNG' },
            { key: 'phuxuan', label: 'Phú Xuân', match: 'PHÚ XUÂN' },
            { key: 'tamgiang', label: 'Tam Giang', match: 'TAM GIANG' },
            { key: 'dlieya', label: 'Dliê Ya', match: 'DLIÊ YA' }
        ];

        // rich = true -> dùng bộ cột đầy đủ (Tên TTHC, Biên Nhận, Họ tên...) theo đúng mẫu Excel thật.
        // rich = false -> giữ nguyên bộ cột đơn giản cũ (Mã HS, GCN, Thửa, Tờ...) cho Thế chấp/Xác nhận.
        // 'all' là bảng gộp xem toàn bộ hồ sơ đã quét, không phân biệt loại - dùng bộ cột đơn giản
        // vì đó là các cột chung mọi bản ghi đều có, bất kể thuộc bảng nào.
        const BUCKETS = [
            { key: 'all', label: 'Tất cả', rich: false },
            ...MY_COMMUNES.map(c => ({ key: c.key, label: c.label, rich: true })),
            { key: 'thechap', label: 'Thế chấp', rich: false },
            { key: 'xacnhan', label: 'Xác nhận', rich: false },
            { key: 'khac', label: 'Khác', rich: true }
        ];

        let state = {
            records: [],
            currentBucket: 'all'
        };

        // Đẩy tự động lên Google Sheet (Apps Script Web App) - chỉ áp dụng cho 5 bảng "của tôi".
        // Thế chấp/Xác nhận là sheet của đồng nghiệp, chưa có link riêng nên chưa đẩy.
        const SHEET_URL_KEY = 'mplis_excel_sheet_url_mine';
        const PUSHABLE_BUCKETS = MY_COMMUNES.map(c => c.key).concat(['khac']);

        function getBucket(r) {
            if (r.loaiHS === 'TC' || r.loaiHS === 'XTC') return 'thechap';
            if (r.loaiHS === 'XN') return 'xacnhan';
            const dc = (r.diaChi || '').toUpperCase();
            const commune = MY_COMMUNES.find(c => dc === c.match);
            return commune ? commune.key : 'khac';
        }

        function getBienDongCode(maHS) {
            if (!maHS) return '';
            try {
                const stored = JSON.parse(localStorage.getItem('mplis_bien_dong_codes') || '{}');
                return stored[maHS] || '';
            } catch (e) { return ''; }
        }

        function getSheetUrl() {
            try { return (localStorage.getItem(SHEET_URL_KEY) || '').trim(); } catch (e) { return ''; }
        }

        function setSheetStatus(text, ok) {
            const el = document.getElementById('excel-sheet-status');
            if (!el) return;
            el.textContent = text;
            el.style.color = ok ? '#22c55e' : '#f43f5e';
        }

        function pushRecordToSheet(r) {
            const bucket = getBucket(r);
            if (!PUSHABLE_BUCKETS.includes(bucket)) return; // Thế chấp/Xác nhận chưa có link riêng
            const url = getSheetUrl();
            if (!url) return;
            if (typeof GM_xmlhttpRequest === 'undefined') return;

            const payload = {
                bucket,
                tenTTHC: r.tenTTHCFull || '',
                maHS: r.maHS || '',
                hoTen: r.nguoiNop || '',
                xa: r.diaChi || '',
                gcn: r.gcn || '',
                thua: r.thua || '',
                to: r.to || '',
                dienTich: r.dt || '',
                datO: r.dtO || '',
                cln: r.dtCLN || '',
                lua: r.dtLUA || '',
                nts: r.dtTSN || '',
                hnk: r.dtHNK || ''
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                data: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                onload: function (res) {
                    try {
                        const body = JSON.parse(res.responseText);
                        if (body.ok) setSheetStatus('✅ đã đồng bộ', true);
                        else setSheetStatus('❌ ' + (body.error || 'lỗi'), false);
                    } catch (e) {
                        setSheetStatus('❌ phản hồi lạ', false);
                    }
                },
                onerror: function () {
                    setSheetStatus('❌ lỗi kết nối', false);
                }
            });
        }

        function init() {
            loadState();
            renderFilterTabs();
            renderTable();

            const sheetUrlInput = document.getElementById('cfg-excel-sheet-url');
            if (sheetUrlInput) {
                sheetUrlInput.value = getSheetUrl();
                sheetUrlInput.oninput = () => {
                    try { localStorage.setItem(SHEET_URL_KEY, sheetUrlInput.value.trim()); } catch (e) { }
                };
            }

            const btnToggleSheetCfg = document.getElementById('btn-toggle-sheet-cfg');
            const sheetCfgRow = document.getElementById('excel-sheet-cfg-row');
            if (btnToggleSheetCfg && sheetCfgRow) {
                btnToggleSheetCfg.onclick = () => {
                    sheetCfgRow.style.display = sheetCfgRow.style.display === 'none' ? 'flex' : 'none';
                };
            }

            // Bắt sự kiện ở tầng cao nhất (Window) để đánh bại hoàn toàn các lớp chặn click của VBDLIS
            window.addEventListener('mousedown', (e) => {
                const btnClear = e.target.closest('#btn-excel-clear');
                if (btnClear) {
                    e.preventDefault(); e.stopPropagation();
                    const bucketDef = BUCKETS.find(b => b.key === state.currentBucket);
                    if (unsafeWindow.confirm(`Xóa toàn bộ hồ sơ trong bảng "${bucketDef ? bucketDef.label : ''}" đang xem?`)) {
                        state.records = state.currentBucket === 'all'
                            ? []
                            : state.records.filter(r => getBucket(r) !== state.currentBucket);
                        saveState();
                        renderTable();
                    }
                    return;
                }

                const btnCopyAll = e.target.closest('#btn-excel-copy');
                if (btnCopyAll) {
                    e.preventDefault(); e.stopPropagation();
                    copyToExcel();
                    return;
                }

                const btnCopyRow = e.target.closest('.btn-copy-row');
                if (btnCopyRow) {
                    e.preventDefault(); e.stopPropagation();
                    const idx = parseInt(btnCopyRow.getAttribute('data-idx'));
                    copyRowToExcel(idx, btnCopyRow);
                    return;
                }

                const btnDeleteRow = e.target.closest('.btn-delete-row');
                if (btnDeleteRow) {
                    e.preventDefault(); e.stopPropagation();
                    const idx = parseInt(btnDeleteRow.getAttribute('data-idx'));
                    if (!isNaN(idx) && state.records[idx]) {
                        state.records.splice(idx, 1);
                        saveState();
                        renderTable();
                    }
                    return;
                }

                const filterTab = e.target.closest('.mplis-excel-filter');
                if (filterTab) {
                    e.preventDefault(); e.stopPropagation();
                    state.currentBucket = filterTab.getAttribute('data-excel-bucket');
                    renderFilterTabs();
                    renderTable();
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

        function renderFilterTabs() {
            const bar = document.getElementById('excel-filter-bar');
            if (!bar) return;
            bar.querySelectorAll('.mplis-excel-filter').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-excel-bucket') === state.currentBucket);
            });
        }

        function getVisibleRecords() {
            const all = state.records.map((r, idx) => ({ r, idx }));
            if (state.currentBucket === 'all') return all;
            return all.filter(({ r }) => getBucket(r) === state.currentBucket);
        }

        function renderTable() {
            const thead = document.getElementById('table-excel-cart-head');
            const tbody = document.querySelector('#table-excel-cart tbody');
            const count = document.getElementById('excel-count');
            if (!thead || !tbody || !count) return;

            const bucketDef = BUCKETS.find(b => b.key === state.currentBucket) || BUCKETS[0];
            const visible = getVisibleRecords();
            count.textContent = visible.length;

            if (bucketDef.rich) {
                thead.innerHTML = `
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">TTHC</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">B.NHẬN</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">HỌ TÊN</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">GCN</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">THỬA</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">TỜ</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);">D.TÍCH</th>
                    <th style="padding:6px 3px; border-bottom:1px solid var(--mplis-border);"><i class="fa fa-bolt"></i></th>
                `;
                tbody.innerHTML = visible.map(({ r, idx }) => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.tenTTHCFull || '---')}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.soBienNhan || '')}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.nguoiNop || '')}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05); color:#fde047; font-weight:bold;">${escapeHtml(r.gcn)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.thua)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.to)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.dt)}</td>
                        <td style="padding:2px; border:1px solid rgba(255,255,255,0.05); text-align:center; white-space:nowrap;">
                            <i class="fa fa-copy btn-copy-row" data-idx="${idx}" style="cursor:pointer; color:#0ea5e9; font-size:12px; padding:2px; pointer-events:auto; position:relative; z-index:9999;" title="Copy dòng này"></i>
                            <i class="fa fa-trash btn-delete-row" data-idx="${idx}" style="cursor:pointer; color:#f43f5e; font-size:12px; padding:2px; margin-left:6px; pointer-events:auto; position:relative; z-index:9999;" title="Xóa dòng này"></i>
                        </td>
                    </tr>
                `).join('');
            } else {
                thead.innerHTML = `
                    <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">MÃ HS</th>
                    <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">GCN</th>
                    <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">THỬA</th>
                    <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">TỜ</th>
                    <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">D.TÍCH</th>
                    <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);"><i class="fa fa-bolt"></i></th>
                `;
                tbody.innerHTML = visible.map(({ r, idx }) => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05); color:#fde047; font-weight:bold;">${escapeHtml(r.maHS || '---')}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.gcn)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.thua)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.to)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.dt)}</td>
                        <td style="padding:2px; border:1px solid rgba(255,255,255,0.05); text-align:center; white-space:nowrap;">
                            <i class="fa fa-copy btn-copy-row" data-idx="${idx}" style="cursor:pointer; color:#0ea5e9; font-size:12px; padding:2px; pointer-events:auto; position:relative; z-index:9999;" title="Copy dòng này"></i>
                            <i class="fa fa-trash btn-delete-row" data-idx="${idx}" style="cursor:pointer; color:#f43f5e; font-size:12px; padding:2px; margin-left:6px; pointer-events:auto; position:relative; z-index:9999;" title="Xóa dòng này"></i>
                        </td>
                    </tr>
                `).join('');
            }
        }

        function getRowText(r) {
            const bucketDef = BUCKETS.find(b => b.key === getBucket(r));
            if (bucketDef && bucketDef.rich) {
                return [
                    r.tenTTHCFull || '', r.soBienNhan || '', r.nguoiNop || '', r.diaChi || '',
                    r.gcn, r.thua, r.to, r.dt,
                    r.dtO || '', r.dtCLN || '', r.dtLUA || '', r.dtTSN || '', r.dtHNK || ''
                ].join('\t');
            }
            return [
                r.loaiHS || '', r.maHS || '', r.nguoiNop || '', r.diaChi || '',
                r.gcn, r.thua, r.to, r.dt,
                r.dtO || '', r.dtCLN || '', r.dtTSN || '',
                r.dtLUA || '', r.dtHNK || '', r.dtSKC || ''
            ].join('\t');
        }

        function copyRowToExcel(idx, btn) {
            const r = state.records[idx];
            if (!r) return;
            const text = getRowText(r);
            fallbackCopyTextToClipboard(text).then(() => {
                btn.className = 'fa fa-check btn-copy-row';
                btn.style.color = '#10b981';
                setTimeout(() => {
                    btn.className = 'fa fa-copy btn-copy-row';
                    btn.style.color = '#0ea5e9';
                }, 1500);
            });
        }

        function copyToExcel() {
            const visible = getVisibleRecords();
            if (visible.length === 0) {
                unsafeWindow.alert('Không có dữ liệu trong bảng đang xem!');
                return;
            }

            const text = visible.map(({ r }) => getRowText(r)).join('\n');
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

            const maHS = findCurrentMaHS();

            // Truy tìm thêm thông tin: Loại HS, Người Nộp, Địa chỉ, tiêu đề gốc từ bảng nền
            let loaiHS = '', nguoiNop = '', diaChi = '', rawTitle = '', titleStr = '';
            if (maHS) {
                const trs = Array.from(document.querySelectorAll('tr[role="row"]'));
                for (let tr of trs) {
                    if (tr.textContent.includes(maHS)) {
                        const col1 = tr.querySelector('.col-md-3:nth-child(1)');
                        if (col1) {
                            const titleDiv = col1.querySelector('div[title]');
                            rawTitle = titleDiv ? titleDiv.getAttribute('title') : col1.textContent.trim();
                            titleStr = rawTitle.toLowerCase();
                            if (titleStr.includes('xóa đăng ký thế chấp') || titleStr.includes('xóa đăng ký biện pháp bảo đảm')) loaiHS = 'XTC';
                            else if (titleStr.includes('đăng ký thế chấp') || titleStr.includes('đăng ký biện pháp bảo đảm')) loaiHS = 'TC';
                            else if (titleStr.includes('xác nhận')) loaiHS = 'XN';
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

            // Tên TTHC đầy đủ (dùng cho các bảng "của tôi"): ưu tiên Mã loại biến động bắt được lúc
            // QT1 (đáng tin hơn hẳn dò chữ tiêu đề - xem giải thích trong bien-dong-capture.js).
            // Hồ sơ CŨ (đã qua QT1 trước khi có tính năng này) sẽ không có mã -> fallback dò tiêu đề,
            // nhưng CHỈ với các mã thủ tục (CN.A.x.x) chuyên biệt cho đúng 1 loại (VD "CN.A.6.2...
            // cấp đổi...", "CN.A.8. Cấp lại..."), TUYỆT ĐỐI không dò với các mã gộp nhiều loại chung
            // 1 tiêu đề (VD "CN.A.21.1.1. Chuyển đổi, chuyển nhượng, thừa kế, tặng cho") vì không thể
            // biết chính xác là loại nào trong đó - những trường hợp gộp này phải chờ mã biến động,
            // chưa có thì tạm hiện tiêu đề gốc, không đoán bừa.
            const bienDongCode = getBienDongCode(maHS);
            let tenTTHCFull = '';
            if (bienDongCode && BIEN_DONG_CODE_MAP[bienDongCode]) tenTTHCFull = BIEN_DONG_CODE_MAP[bienDongCode];
            else if (bienDongCode) tenTTHCFull = bienDongCode;
            else if (titleStr.includes('cấp đổi')) tenTTHCFull = 'Cấp đổi';
            else if (titleStr.includes('cấp lại')) tenTTHCFull = 'Cấp lại';
            else tenTTHCFull = rawTitle;

            // Biên Nhận và Mã hồ sơ (rút gọn) là một - dùng lại đúng giá trị maHS đã tính ở trên.
            const soBienNhan = maHS;

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
                        const newRecord = {
                            maHS, loaiHS, tenTTHCFull, soBienNhan, nguoiNop, diaChi, gcn, thua, to, dt,
                            dtO: datO, dtCLN: datCLN, dtTSN: datTSN,
                            dtLUA: datLUA, dtHNK: datHNK, dtSKC: datSKC
                        };
                        state.records.push(newRecord);
                        saveState();
                        renderTable();
                        pushRecordToSheet(newRecord);

                        tree.style.boxShadow = '0 0 10px #10b981';
                        setTimeout(() => tree.style.boxShadow = 'none', 1000);
                    }
                });
            });
        }

        return { init };
    })();

export { ExcelModule };
