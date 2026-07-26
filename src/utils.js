    function fallbackCopyTextToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (typeof GM_setClipboard !== 'undefined') {
                try {
                    GM_setClipboard(text, 'text');
                    resolve();
                } catch (e) {
                    doFallback(text, resolve, reject);
                }
            } else if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(resolve).catch(() => doFallback(text, resolve, reject));
            } else {
                doFallback(text, resolve, reject);
            }
        });

        function doFallback(text, resolve, reject) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                textArea.remove();
                if (successful) resolve();
                else reject(new Error("document.execCommand('copy') trả về false"));
            } catch (err) {
                reject(err);
            }
        }
    }

    // Hàm escape HTML dùng chung cho mọi chỗ render dữ liệu (Excel dán vào, dữ liệu quét từ DOM...)
    // vào innerHTML, để tránh trường hợp dữ liệu chứa ký tự HTML/script gây lỗi hiển thị hoặc XSS cục bộ.
    // KHÔNG ảnh hưởng tới logic tự động hóa, chỉ ảnh hưởng tới cách hiển thị dữ liệu ra bảng.
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Công tắc AN TOÀN cho việc tự động chấp nhận confirm()/alert() của trang.
    // Mặc định = BẬT (giữ đúng hành vi như bản cũ, không đổi gì nếu người dùng không tự tay tắt trong tab "Cài đặt").
    // Người dùng có thể tắt trong tab Cài đặt nếu muốn tự tay xác nhận các hộp thoại quan trọng.
    function isAutoConfirmEnabled() {
        try {
            const v = localStorage.getItem('mplis_auto_confirm_override');
            return v !== 'false'; // absent hoặc 'true' => bật (giống hành vi gốc)
        } catch (e) { return true; }
    }

    try {
        if (typeof unsafeWindow !== 'undefined' && isAutoConfirmEnabled()) {
            unsafeWindow.confirm = function (message) {
                console.log("[MPLIS Auto] Tự động chấp nhận confirm mặc định: " + message);
                return true;
            };
            unsafeWindow.alert = function (message) {
                console.log("[MPLIS Auto] Tự động bỏ qua alert: " + message);
                return true;
            };
        }
    } catch (e) { }

    const topWin = window.top || window;
    const WORKFLOW_NAMES = {
        'QT1': 'Cập nhật dữ liệu pháp lý',
        'QT2': 'Lưu kho hồ sơ',
        'QT3': 'Ký số sổ địa chính',
        'QT4': 'Kết ISO'
    };

    function clickElement(el) {
        if (!el) return;
        if (el.tagName === 'A' && (el.getAttribute('href') === 'javascripts:;' || el.getAttribute('href') === 'javascript:;')) {
            el.setAttribute('href', 'javascript:void(0);');
        }
        try {
            el.classList.add('mplis-highlight-target');
            const targetEl = el;
            setTimeout(() => { try { if (targetEl) targetEl.classList.remove('mplis-highlight-target'); } catch (e) { } }, 1200);

            const mouseEventOptions = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new MouseEvent('mousedown', mouseEventOptions));
            el.dispatchEvent(new MouseEvent('mouseup', mouseEventOptions));
            el.click();
            el.dispatchEvent(new MouseEvent('click', mouseEventOptions));
        } catch (e) {
            try { el.click(); } catch (err) { }
        }
    }

    function isSystemLoading() {
        try {
            const commonLoaders = Array.from(document.querySelectorAll('.loading, .loader, #loading, #loader, .k-loading-mask, .blockUI.blockOverlay, .blockUI.blockMsg, .dx-loadpanel'));
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

    function querySelectorAllCustom(selectorStr, parent = document) {
        if (!selectorStr) return [];
        const selectors = selectorStr.split(",").map(s => s.trim());
        const results = [];
        for (const selector of selectors) {
            if (selector.includes(":contains")) {
                const parts = selector.split(":contains");
                const baseSelector = parts[0] || "*";
                const textMatch = parts[1].replace(/['"()]/g, "").trim().toLowerCase();
                try {
                    const elements = Array.from(parent.querySelectorAll(baseSelector));
                    elements.forEach(el => {
                        const text = (el.textContent || el.value || "").toLowerCase();
                        if (text.includes(textMatch) && !results.includes(el)) results.push(el);
                    });
                } catch (e) { }
            } else {
                try {
                    const elements = Array.from(parent.querySelectorAll(selector));
                    elements.forEach(el => {
                        if (!results.includes(el)) results.push(el);
                    });
                } catch (e) { }
            }
        }
        return results;
    }

    // Dò Mã hồ sơ (VD: H15.50-260706-1377 -> "06-1377") đang hiển thị trên màn hình hiện tại.
    // Dùng chung bởi ExcelModule (quét cây QT3) và bien-dong-capture (bắt lúc QT1) để đảm bảo
    // 2 module luôn suy ra CÙNG 1 khóa mã hồ sơ cho cùng 1 hồ sơ.
    function findCurrentMaHS() {
        const allNodes = Array.from(document.querySelectorAll('b, span, .modal-title, h4'));
        const validNodes = [];

        for (let node of allNodes) {
            if (!node.textContent) continue;
            const m = node.textContent.match(/[A-Z0-9]{2,}\.[A-Z0-9]{2,}\-\d{6}\-\d{4,}/i);
            if (m) {
                const rect = node.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    validNodes.push({ node, text: m[0] });
                }
            }
        }
        if (validNodes.length === 0) return '';

        let targetNode = validNodes.find(item => item.node.closest('.modal-title'));
        if (!targetNode) {
            const notInTable = validNodes.filter(item => !item.node.closest('tr'));
            if (notInTable.length > 0) targetNode = notInTable[notInTable.length - 1];
        }
        if (!targetNode) targetNode = validNodes[validNodes.length - 1];

        const full = targetNode.text;
        let maHS = '';
        const parts = full.split('-');
        if (parts.length >= 3) {
            maHS = parts[1].slice(-2) + '-' + parts[2];
        } else {
            maHS = full.slice(-7);
        }
        return maHS.toUpperCase();
    }

export {
    fallbackCopyTextToClipboard,
    escapeHtml,
    isAutoConfirmEnabled,
    topWin,
    WORKFLOW_NAMES,
    clickElement,
    isSystemLoading,
    querySelectorAllCustom,
    findCurrentMaHS
};
