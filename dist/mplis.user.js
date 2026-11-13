// ==UserScript==
// @name         MPLIS Auto Tool
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Tự động hoá xử lý hồ sơ trên MPLIS/VBDLIS: chạy quy trình QT0-QT5, nhắc hồ sơ trễ hạn, xuất dữ liệu sang Google Sheet và tự điền sẵn màn hình Cập nhật pháp lý.
// @author       Việt
// @match        *://*.mplis.gov.vn/*
// @match        *://dla.mplis.gov.vn/*
// @match        *://*.vbdlis.vn/*
// @match        *://vbdlis.vn/*
// @include      *mplis.gov.vn*
// @include      *vbdlis.vn*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      api.telegram.org
// @connect      bot-api.zaloplatforms.com
// @run-at       document-end
// @allFrames    true
// ==/UserScript==

(() => {
  // src/utils.js
  function fallbackCopyTextToClipboard(text) {
    return new Promise((resolve, reject) => {
      if (typeof GM_setClipboard !== "undefined") {
        try {
          GM_setClipboard(text, "text");
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
    function doFallback(text2, resolve, reject) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text2;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        textArea.remove();
        if (successful) resolve();
        else reject(new Error("document.execCommand('copy') trả về false"));
      } catch (err) {
        reject(err);
      }
    }
  }
  function escapeHtml(str) {
    if (str === null || str === void 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isAutoConfirmEnabled() {
    try {
      const v = localStorage.getItem("mplis_auto_confirm_override");
      return v !== "false";
    } catch (e) {
      return true;
    }
  }
  try {
    if (typeof unsafeWindow !== "undefined" && isAutoConfirmEnabled()) {
      const gocConfirm = unsafeWindow.confirm, gocAlert = unsafeWindow.alert;
      const autoDangChay2 = () => {
        try {
          return !!(topWin.MPLIS_AUTO_STATE && topWin.MPLIS_AUTO_STATE.isRunning);
        } catch (e) {
          return false;
        }
      };
      unsafeWindow.confirm = function(message) {
        if (!autoDangChay2()) return gocConfirm.call(unsafeWindow, message);
        console.log("[MPLIS Auto] Tự động chấp nhận confirm mặc định: " + message);
        return true;
      };
      unsafeWindow.alert = function(message) {
        if (!autoDangChay2()) return gocAlert.call(unsafeWindow, message);
        console.log("[MPLIS Auto] Tự động bỏ qua alert: " + message);
        return true;
      };
    }
  } catch (e) {
  }
  var topWin = window.top || window;
  var MPLIS_UI_SELECTOR = "#mplis-auto-panel, #mplis-run-toast";
  function isInsideMplisUI(el) {
    try {
      return !!(el && el.closest && el.closest(MPLIS_UI_SELECTOR));
    } catch (e) {
      return false;
    }
  }
  function clickElement(el) {
    if (!el) return;
    if (isInsideMplisUI(el)) {
      console.warn("[MPLIS Auto] Bỏ qua click vào bảng điều khiển của tool:", el);
      return;
    }
    if (el.tagName === "A" && (el.getAttribute("href") === "javascripts:;" || el.getAttribute("href") === "javascript:;")) {
      el.setAttribute("href", "javascript:void(0);");
    }
    try {
      el.classList.add("mplis-highlight-target");
      const targetEl = el;
      setTimeout(() => {
        try {
          if (targetEl) targetEl.classList.remove("mplis-highlight-target");
        } catch (e) {
        }
      }, 1200);
      const mouseEventOptions = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mousedown", mouseEventOptions));
      el.dispatchEvent(new MouseEvent("mouseup", mouseEventOptions));
      el.click();
      el.dispatchEvent(new MouseEvent("click", mouseEventOptions));
    } catch (e) {
      try {
        el.click();
      } catch (err) {
      }
    }
  }
  function isSystemLoading() {
    try {
      const commonLoaders = Array.from(document.querySelectorAll(".loading, .loader, #loading, #loader, .k-loading-mask, .blockUI.blockOverlay, .blockUI.blockMsg, .dx-loadpanel"));
      for (const loader of commonLoaders) {
        const style = window.getComputedStyle(loader);
        if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
          const rect = loader.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return true;
        }
      }
      const allElements = Array.from(document.querySelectorAll("div, span, p"));
      for (const el of allElements) {
        if (el.children.length <= 2) {
          const text = (el.textContent || "").trim().toLowerCase();
          if (text === "đang xử lý..." || text === "đang xử lý") {
            const style = window.getComputedStyle(el);
            if (style.display !== "none" && style.visibility !== "hidden") {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) return true;
            }
          }
        }
      }
    } catch (e) {
    }
    return false;
  }
  function querySelectorAllCustom(selectorStr, parent = document) {
    if (!selectorStr) return [];
    const selectors = selectorStr.split(",").map((s) => s.trim());
    const results = [];
    for (const selector of selectors) {
      if (selector.includes(":contains")) {
        const parts = selector.split(":contains");
        const baseSelector = parts[0] || "*";
        const textMatch = parts[1].replace(/['"()]/g, "").trim().toLowerCase();
        try {
          const elements = Array.from(parent.querySelectorAll(baseSelector));
          elements.forEach((el) => {
            if (isInsideMplisUI(el)) return;
            const text = (el.textContent || el.value || "").toLowerCase();
            if (text.includes(textMatch) && !results.includes(el)) results.push(el);
          });
        } catch (e) {
        }
      } else {
        try {
          const elements = Array.from(parent.querySelectorAll(selector));
          elements.forEach((el) => {
            if (isInsideMplisUI(el)) return;
            if (!results.includes(el)) results.push(el);
          });
        } catch (e) {
        }
      }
    }
    return results;
  }
  function findCurrentMaHS(root = document, dayDu = false) {
    const allNodes = Array.from(root.querySelectorAll("b, span, .modal-title, h4"));
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
    if (validNodes.length === 0) return "";
    let targetNode = validNodes.find((item) => item.node.closest(".modal-title"));
    if (!targetNode) {
      const notInTable = validNodes.filter((item) => !item.node.closest("tr"));
      if (notInTable.length > 0) targetNode = notInTable[notInTable.length - 1];
    }
    if (!targetNode) targetNode = validNodes[validNodes.length - 1];
    const full = targetNode.text;
    if (dayDu) return full.toUpperCase();
    let maHS = "";
    const parts = full.split("-");
    if (parts.length >= 3) {
      maHS = parts[1].slice(-2) + "-" + parts[2];
    } else {
      maHS = full.slice(-7);
    }
    return maHS.toUpperCase();
  }

  // src/panel-style.js
  var panelStyle = `
        :root {
            --mplis-bg: #070b16;
            --mplis-bg-soft: #0d1225;
            --mplis-surface: rgba(255,255,255,0.045);
            --mplis-surface-hover: rgba(255,255,255,0.085);
            --mplis-border: rgba(148,163,184,0.22);
            --mplis-border-strong: rgba(148,163,184,0.38);
            --mplis-text: #eef2f8;
            --mplis-text-dim: #8494b0;
            --mplis-accent: #6366f1;
            --mplis-accent-2: #22d3ee;
            --mplis-good: #22c55e;
            --mplis-warn: #f59e0b;
            --mplis-bad: #f43f5e;
        }

        /* Bề ngang cố định 460px sẽ tràn/che nội dung trên màn hẹp hoặc khi trình duyệt zoom to,
           nên kẹp lại theo bề ngang cửa sổ (chừa 32px cho lề 2 bên). */
        #mplis-auto-panel { position: fixed !important; bottom: 24px !important; right: 24px !important; width: min(var(--mplis-w, 392px), calc(100vw - 32px)) !important; max-height: 82vh !important; background: linear-gradient(160deg, #0e1428 0%, #070b16 60%) !important; border: 1px solid rgba(99,102,241,0.22) !important; border-radius: 18px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important; color: var(--mplis-text) !important; font-family: 'Segoe UI', 'Inter', sans-serif !important; z-index: 999999999 !important; user-select: none !important; box-sizing: border-box !important; display: flex; flex-direction: column; overflow: hidden; transform-origin: bottom right; }
        #mplis-auto-panel * { box-sizing: border-box; }
        #mplis-auto-panel.sized { height: var(--mplis-h) !important; max-height: calc(100vh - 32px) !important; }
        #mplis-auto-panel.sized .mplis-content { min-height: 0 !important; }
        #mplis-auto-panel .mplis-content { zoom: var(--mplis-zoom, 1); }
        .mplis-resize { position: absolute; top: 0; left: 0; width: 22px; height: 22px; cursor: nwse-resize; z-index: 5; touch-action: none; opacity: 0.55; background: linear-gradient(135deg, rgba(148,163,184,0.9) 0 2px, transparent 2px 5px, rgba(148,163,184,0.9) 5px 7px, transparent 7px); border-top-left-radius: 18px; }
        .mplis-resize:hover { opacity: 1; }
        #mplis-auto-panel.minimized .mplis-resize { display: none !important; }
        #mplis-auto-panel .mplis-hdr-actions { display: flex; align-items: center; gap: 2px; }
        #mplis-auto-panel .mplis-hdr-actions .mplis-btn-minimize { font: 700 11px 'Segoe UI', sans-serif; }
        #mplis-auto-panel.minimized { width: 58px !important; height: 58px !important; border-radius: 50% !important; background: linear-gradient(135deg, var(--mplis-accent), var(--mplis-accent-2)) !important; border: none !important; box-shadow: 0 10px 28px rgba(99,102,241,0.6), 0 0 0 2px rgba(99,102,241,0.2) !important; cursor: pointer; }
        #mplis-auto-panel.minimized:hover { filter: brightness(1.1); }
        #mplis-auto-panel.minimized .mplis-panel-header,
        #mplis-auto-panel.minimized .mplis-shell { display: none !important; }

        /* ---- Header ---- */
        #mplis-auto-panel .mplis-panel-header { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 10px 13px !important; border-bottom: 1px solid rgba(99,102,241,0.18) !important; flex-shrink: 0; background: rgba(99,102,241,0.05); }
        #mplis-auto-panel .mplis-panel-title { font-weight: 700 !important; font-size: 13px !important; letter-spacing: -0.02em; color: var(--mplis-text) !important; display: flex !important; align-items: center !important; gap: 9px !important; }
        #mplis-auto-panel .mplis-panel-title .mplis-logo { width: 26px; height: 26px; border-radius: 8px; background: linear-gradient(135deg, var(--mplis-accent), var(--mplis-accent-2)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 12px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2); }
        #mplis-auto-panel .mplis-btn-minimize { background: transparent !important; border: 1px solid transparent !important; border-radius: 8px !important; color: var(--mplis-text-dim) !important; cursor: pointer !important; width: 28px !important; height: 28px !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: background-color 0.12s, color 0.12s, border-color 0.12s !important; padding: 0; margin: 0; }
        #mplis-auto-panel .mplis-btn-minimize:hover { color: var(--mplis-text) !important; background: rgba(255,255,255,0.1) !important; border-color: var(--mplis-border) !important; }
        #mplis-auto-panel .mplis-minimized-trigger { display: none !important; width: 100% !important; height: 100% !important; align-items: center !important; justify-content: center !important; color: #fff !important; background: transparent !important; border: none !important; outline: none !important; padding: 0 !important; margin: 0 !important; cursor: pointer !important; }
        #mplis-auto-panel.minimized .mplis-minimized-trigger { display: flex !important; }
        @keyframes mplis-float { 0% { transform: translateY(0); } 50% { transform: translateY(-3px); } 100% { transform: translateY(0); } }

        /* ---- Shell: nav rail (trái) + nội dung (phải) ---- */
        .mplis-shell { display: flex; flex: 1; min-height: 0; }

        .mplis-tabs { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 48px; flex-shrink: 0; padding: 10px 0; background: rgba(0,0,0,0.25); border-right: 1px solid rgba(99,102,241,0.14); overflow-y: auto; overflow-x: visible; }
        .mplis-tab { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 10px; color: var(--mplis-text-dim); cursor: pointer; transition: background-color 0.12s, color 0.12s; position: relative; flex-shrink: 0; }
        /* Icon tab dùng SVG (không dùng emoji) - khóa cùng 1 cỡ để nhịp thị giác đều nhau. */
        .mplis-tab svg, .mplis-tab-toggle svg { width: 18px; height: 18px; display: block; }
        .mplis-tab:hover { color: var(--mplis-text); background: rgba(99,102,241,0.12); }
        .mplis-tab.active { color: #fff; background: linear-gradient(135deg, var(--mplis-accent), #4338ca); box-shadow: 0 4px 16px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15); }
        .mplis-tab[title]:hover::after { content: attr(title); position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 10px; background: #1a2035; color: #f1f5f9; font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 7px; white-space: nowrap; box-shadow: 0 6px 18px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07); pointer-events: none; z-index: 10; border: 1px solid var(--mplis-border); }

        .mplis-tab-toggle { width: 38px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-top: 1px dashed rgba(148,163,184,0.2); margin-top: 6px; color: var(--mplis-text-dim); cursor: pointer; transition: color 0.15s ease; }
        .mplis-tab-toggle:hover { color: var(--mplis-text); }
        .mplis-tab-toggle.expanded { color: var(--mplis-accent-2); }

        .mplis-content { flex: 1; min-width: 0; min-height: 240px; overflow-y: auto; padding: 10px; }
        .mplis-content::-webkit-scrollbar, .mplis-tabs::-webkit-scrollbar { width: 4px; }
        .mplis-content::-webkit-scrollbar-thumb, .mplis-tabs::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }
        .mplis-content::-webkit-scrollbar-thumb:hover, .mplis-tabs::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }

        .mplis-panel-body { display: none; }
        .mplis-panel-body.active { display: block; }
        @keyframes mplis-fade-in { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: translateY(0);} }

        .mplis-section-label { font-size: 10px; color: var(--mplis-text-dim); text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 6px; display: block; }
        .mplis-card { background: linear-gradient(145deg, rgba(255,255,255,0.048), rgba(255,255,255,0.022)); border: 1px solid var(--mplis-border); border-radius: 11px; padding: 9px; margin-bottom: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05); transition: box-shadow 0.18s ease, border-color 0.18s ease; }
        .mplis-card:hover { border-color: rgba(148,163,184,0.26); box-shadow: 0 4px 16px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.07); }
        .mplis-hint { font-size: 11.5px; color: var(--mplis-text-dim); line-height: 1.5; margin-bottom: 10px; }

        /* ---- Thẻ thu gọn/mở rộng ---- */
        /* Đóng lại vẫn phải biết tool đang chạy kiểu nào, nên trạng thái nằm luôn trên thanh tiêu đề
           (.mplis-collapse-state) thay vì giấu hết vào trong. */
        #mplis-auto-panel .mplis-collapse { padding: 0 !important; overflow: hidden; }
        #mplis-auto-panel .mplis-collapse-head { display: flex !important; align-items: center !important; gap: 10px !important; width: 100% !important; min-height: 38px !important; padding: 8px 10px !important; background: transparent !important; border: none !important; border-radius: 10px !important; color: var(--mplis-text) !important; cursor: pointer !important; text-align: left !important; font-family: inherit !important; transition: background 0.15s ease !important; }
        #mplis-auto-panel .mplis-collapse-head:hover { background: rgba(99,102,241,0.1) !important; }
        #mplis-auto-panel .mplis-collapse-head:focus-visible { outline: 2px solid var(--mplis-accent) !important; outline-offset: -2px !important; }
        #mplis-auto-panel .mplis-collapse-head .mplis-section-label { margin-bottom: 0 !important; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* Tên tài khoản chuyển tiếp có thể dài hơn chỗ trống - cắt bằng "..." để thanh tiêu đề không vỡ. */
        .mplis-collapse-state { margin-left: auto; min-width: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 600; color: var(--mplis-text-dim); background: rgba(255,255,255,0.06); border: 1px solid var(--mplis-border); border-radius: 20px; padding: 3px 9px; }
        .mplis-collapse-state.on { color: #021018; background: var(--mplis-accent-2); border-color: transparent; box-shadow: 0 2px 8px rgba(34,211,238,0.35); }
        .mplis-collapse-caret { flex-shrink: 0; color: var(--mplis-text-dim); }
        .mplis-collapse.open .mplis-collapse-caret { transform: rotate(180deg); }
        .mplis-collapse-body { display: none; padding: 0 10px; }
        .mplis-collapse.open .mplis-collapse-body { display: block; max-height: 420px; overflow-y: auto; padding-bottom: 10px; }
        @media (prefers-reduced-motion: reduce) {
            .mplis-collapse-body, .mplis-collapse-caret { transition: none; }
        }

        /* ---- Bảng nổi báo tiến độ (chỉ hiện khi panel thu nhỏ + auto đang chạy) ---- */
        /* Đặt ngay trên icon tia sét (icon cao 58px + 24px lề dưới + 10px khoảng hở). */
        #mplis-run-toast { position: fixed !important; bottom: 92px !important; right: 24px !important; width: min(300px, calc(100vw - 32px)); padding: 11px 13px; background: linear-gradient(160deg, #0e1428, #070b16); border: 1px solid rgba(99,102,241,0.22); border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06); color: var(--mplis-text); font-family: 'Segoe UI', 'Inter', sans-serif; z-index: 999999998; cursor: pointer; opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; }
        #mplis-run-toast.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
        #mplis-run-toast:hover { border-color: rgba(99,102,241,0.5); }
        #mplis-run-toast .mplis-toast-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        #mplis-run-toast .mplis-toast-step { font-size: 12px; font-weight: 700; color: var(--mplis-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #mplis-run-toast .mplis-toast-count { margin-left: auto; flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--mplis-accent-2); font-variant-numeric: tabular-nums; }
        #mplis-run-toast .mplis-toast-close { flex-shrink: 0; width: 20px; height: 20px; margin: -3px -3px -3px 2px; display: flex; align-items: center; justify-content: center; padding: 0; background: transparent; border: none; border-radius: 6px; color: var(--mplis-text-dim); cursor: pointer; transition: background-color 0.12s, color 0.12s, border-color 0.12s ease; }
        #mplis-run-toast .mplis-toast-close:hover { background: var(--mplis-surface-hover); color: var(--mplis-text); }
        #mplis-run-toast .mplis-toast-close:focus-visible { outline: 2px solid var(--mplis-accent-2); outline-offset: 1px; }
        #mplis-run-toast .mplis-toast-bar { height: 4px; border-radius: 3px; background: rgba(255,255,255,0.09); overflow: hidden; }
        #mplis-run-toast .mplis-toast-bar i { display: block; height: 100%; width: 0; border-radius: 3px; background: linear-gradient(90deg, var(--mplis-accent), var(--mplis-accent-2)); transition: width 0.3s ease; }
        #mplis-run-toast .mplis-toast-bar i.done { background: var(--mplis-good); }
        #mplis-run-toast .mplis-toast-bar i.error { background: var(--mplis-bad); }
        #mplis-run-toast .mplis-toast-log { margin-top: 8px; font-size: 11.5px; color: var(--mplis-text-dim); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        @media print { #mplis-run-toast { display: none !important; } }

        .mplis-checkbox-group { display: flex !important; flex-direction: column !important; gap: 4px !important; }
        /* 6 quy trình xếp dọc chiếm gần 200px; xếp 2 cột còn 3 hàng, tab Xử lý ngắn lại hẳn. */
        .mplis-checkbox-group.cols2 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 4px !important; }
        .mplis-checkbox-group label { display: flex !important; align-items: center !important; gap: 7px !important; min-height: 32px !important; font-size: 11.5px !important; color: #dde4f0 !important; cursor: pointer !important; padding: 5px 9px !important; background: rgba(255,255,255,0.04) !important; border-radius: 8px !important; border: 1px solid var(--mplis-border) !important; transition: background 0.15s, border-color 0.15s; }
        .mplis-checkbox-group label:hover { background: rgba(99,102,241,0.1) !important; border-color: rgba(99,102,241,0.3) !important; }
        .mplis-checkbox-group input, #mplis-auto-panel input[type="checkbox"] { accent-color: var(--mplis-accent); width: 14px; height: 14px; cursor: pointer; }

        .mplis-btn-primary { width: 100% !important; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%) !important; border: none !important; border-radius: 10px !important; padding: 9px 14px !important; color: #ffffff !important; font-weight: 700 !important; font-size: 12.5px !important; cursor: pointer !important; letter-spacing: 0.01em; transition: filter 0.12s ease !important; box-shadow: 0 2px 8px rgba(99,102,241,0.3); }
        .mplis-btn-primary:hover { filter: brightness(1.12); }
        .mplis-btn-primary:active { transform: translateY(0); filter: brightness(0.97); box-shadow: 0 2px 8px rgba(99,102,241,0.3) !important; }
        .mplis-btn-primary.running { background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%) !important; box-shadow: 0 4px 15px rgba(244,63,94,0.4), inset 0 1px 0 rgba(255,255,255,0.15) !important; }
        .mplis-btn-primary.running:hover { box-shadow: 0 7px 22px rgba(244,63,94,0.55), inset 0 1px 0 rgba(255,255,255,0.2) !important; }
        /* Chân bảng ghim đáy: nút Bắt đầu/Dừng + tóm tắt + trạng thái luôn thấy, không phải cuộn tìm. */
        #mplis-auto-panel .mplis-runbar { position: sticky; bottom: 0; z-index: 2; margin: 8px -10px -10px; padding: 8px 10px 10px; background: var(--mplis-bg); border-top: 1px solid var(--mplis-border); }
        #mplis-auto-panel .mplis-runbar .mplis-status-bar { margin-top: 8px !important; }
        #mplis-auto-panel #btn-toggle-process { padding: 12px 14px !important; font-size: 14px !important; }
        .mplis-run-summary { font-size: 12px; line-height: 1.5; color: var(--mplis-text-dim); margin-bottom: 8px; }
        .mplis-run-summary b { color: var(--mplis-text); font-weight: 600; }
        .mplis-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; filter: none; box-shadow: none !important; }

        /* Chọn hậu tố GT/PT - 2 nút kiểu segmented, nút đang chọn đổi màu + đậm để nhìn là biết. */
        .mplis-hauto-btn { padding: 7px 10px !important; font: 650 12.5px 'Segoe UI', sans-serif !important; color: var(--mplis-text-dim) !important; background: rgba(255,255,255,0.05) !important; border: 1px solid var(--mplis-border) !important; border-radius: 8px !important; cursor: pointer !important; transition: background-color 0.12s, color 0.12s, border-color 0.12s ease !important; }
        .mplis-hauto-btn:hover { background: rgba(99,102,241,0.12) !important; color: var(--mplis-text) !important; border-color: rgba(99,102,241,0.3) !important; }
        .mplis-hauto-btn.on { color: #fff !important; background: linear-gradient(135deg, #6366f1, #4338ca) !important; border-color: transparent !important; box-shadow: 0 3px 12px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15) !important; }

        /* Thanh kéo tốc độ: nền tối cho khớp panel, cao 4px, núm 14px đủ to để kéo. */
        #mplis-auto-panel input[type="range"] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 3px; background: rgba(255,255,255,0.12); outline: none; }
        #mplis-auto-panel input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: var(--mplis-accent-2); border: 2px solid #070b16; cursor: pointer; box-shadow: 0 0 0 2px rgba(34,211,238,0.3), 0 2px 8px rgba(34,211,238,0.4); }
        #mplis-auto-panel input[type="range"]::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; background: var(--mplis-accent-2); border: 2px solid #070b16; cursor: pointer; }

        .mplis-btn-ghost { background: rgba(255,255,255,0.05) !important; border: 1px solid var(--mplis-border) !important; color: var(--mplis-text) !important; border-radius: 9px !important; cursor: pointer !important; transition: background-color 0.12s, color 0.12s, border-color 0.12s ease !important; }
        .mplis-btn-ghost:hover { background: rgba(255,255,255,0.09) !important; border-color: var(--mplis-border-strong) !important; }

        .mplis-status-bar { margin-top: 8px !important; background: linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018)) !important; border-radius: 10px !important; padding: 7px 10px !important; border: 1px solid var(--mplis-border) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04); }
        .mplis-status-row { display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 12px !important; }
        .mplis-status-lbl { display: flex !important; align-items: center !important; gap: 7px !important; color: #c8d3e8 !important; }
        .mplis-status-dot { width: 8px !important; height: 8px !important; border-radius: 50% !important; background-color: #4a5568 !important; flex-shrink: 0; }
        .mplis-status-dot.active { background-color: var(--mplis-good) !important; box-shadow: 0 0 0 2px rgba(34,197,94,0.2), 0 0 10px rgba(34,197,94,0.6) !important; }
        .mplis-status-dot.error { background-color: var(--mplis-bad) !important; }
        .mplis-status-dot.waiting { background-color: var(--mplis-warn) !important; box-shadow: 0 0 0 2px rgba(245,158,11,0.2), 0 0 10px rgba(245,158,11,0.6) !important; }
        @keyframes mplis-pulse { 0% { opacity: 0.55; } 50% { opacity: 1; } 100% { opacity: 0.55; } }

        .mplis-log { margin-top: 8px !important; font-family: 'Consolas', 'Cascadia Code', monospace !important; font-size: 11.5px !important; color: var(--mplis-text-dim) !important; border-top: 1px solid rgba(148,163,184,0.1) !important; padding-top: 7px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }

        .mplis-highlight-target { outline: 2px solid var(--mplis-good) !important; box-shadow: 0 0 0 4px rgba(34,197,94,0.15), 0 0 18px rgba(34,197,94,0.6) !important; border-radius: 4px !important; }

        .mplis-filter-tab.active { background: rgba(99,102,241,0.28) !important; color: #fff !important; box-shadow: inset 0 0 0 1px rgba(99,102,241,0.4); }
        .mplis-excel-filter.active { background: rgba(99,102,241,0.28) !important; color: #fff !important; box-shadow: inset 0 0 0 1px rgba(99,102,241,0.4); }

        /* Input text, textarea, select trong panel — styled nhất quán */
        #mplis-auto-panel input[type="text"],
        #mplis-auto-panel input[type="number"],
        #mplis-auto-panel input[type="date"],
        #mplis-auto-panel textarea,
        #mplis-auto-panel select { background: rgba(0,0,0,0.35) !important; border: 1px solid var(--mplis-border) !important; border-radius: 8px !important; color: #f0f4fc !important; transition: border-color 0.15s, box-shadow 0.15s !important; }
        #mplis-auto-panel input[type="text"]:hover,
        #mplis-auto-panel input[type="number"]:hover,
        #mplis-auto-panel textarea:hover { border-color: var(--mplis-border-strong) !important; }
        #mplis-auto-panel input:focus, #mplis-auto-panel textarea:focus, #mplis-auto-panel select:focus { border-color: var(--mplis-accent-2) !important; box-shadow: 0 0 0 3px rgba(34,211,238,0.14) !important; outline: none !important; }

        /* Viền focus khi dùng bàn phím (Tab) - trước đây không có, gõ Tab không biết đang ở nút nào.
           Dùng :focus-visible nên chuột bấm vẫn KHÔNG hiện viền, không ảnh hưởng thao tác thường ngày. */
        #mplis-auto-panel button:focus-visible,
        #mplis-auto-panel input:focus-visible,
        #mplis-auto-panel textarea:focus-visible,
        #mplis-auto-panel select:focus-visible,
        #mplis-auto-panel [tabindex]:focus-visible { outline: 2px solid var(--mplis-accent-2) !important; outline-offset: 2px !important; border-radius: 8px; }

        /* Người dùng bật "giảm chuyển động" của hệ điều hành thì tắt hiệu ứng, tránh gây khó chịu. */
        @media (prefers-reduced-motion: reduce) {
            #mplis-auto-panel, #mplis-auto-panel * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }

        /* Toggle switch dạng pill — thay cho checkbox trong bypass card, gọn hơn nhiều */
        .mplis-toggle-sw { position: relative; display: inline-block; width: 34px; height: 18px; flex-shrink: 0; cursor: pointer; }
        .mplis-toggle-sw input { opacity: 0; width: 0; height: 0; position: absolute; }
        .mplis-toggle-sw .mplis-toggle-track { position: absolute; inset: 0; border-radius: 9px; background: rgba(255,255,255,0.1); border: 1px solid var(--mplis-border); transition: background 0.22s, border-color 0.22s, box-shadow 0.22s; }
        .mplis-toggle-sw .mplis-toggle-track::before { content: ''; position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #4a5568; top: 2px; left: 2px; transition: transform 0.22s cubic-bezier(0.34,1.5,0.64,1), background 0.2s; }
        .mplis-toggle-sw input:checked + .mplis-toggle-track { background: var(--mplis-accent-2); border-color: transparent; box-shadow: 0 0 10px rgba(34,211,238,0.35); }
        .mplis-toggle-sw input:checked + .mplis-toggle-track::before { transform: translateX(16px); background: #021018; }
        .mplis-toggle-sw:hover .mplis-toggle-track { border-color: rgba(34,211,238,0.45); }
        .mplis-toggle-sw input:focus-visible + .mplis-toggle-track { outline: 2px solid var(--mplis-accent-2); outline-offset: 2px; border-radius: 9px; }

        /* Hàng bypass: nhãn trái + toggle phải */
        .mplis-bypass-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 0; }
        .mplis-bypass-row + .mplis-bypass-row { border-top: 1px solid rgba(148,163,184,0.12); }
        .mplis-bypass-row-label { min-width: 0; }
        .mplis-bypass-row-label strong { display: block; font-size: 12px; color: #dde4f0; font-weight: 600; line-height: 1.3; }
        .mplis-bypass-row-label span { font-size: 11px; color: var(--mplis-text-dim); line-height: 1.3; }

        /* ---- Tab tra cứu hồ sơ ---- */
        .mplis-lk-bar { display: flex; gap: 6px; }
        .mplis-lk-bar input { flex: 1; min-width: 0; padding: 9px 10px; font-size: 13px; }
        .mplis-lk-bar .mplis-btn-primary { width: auto !important; padding: 9px 16px !important; flex-shrink: 0; }
        .mplis-lk-card { padding: 11px !important; user-select: text; }
        .mplis-lk-code { background: transparent; border: none; padding: 0; margin: 0; color: var(--mplis-accent-2); font: 700 14px Consolas, 'Cascadia Code', monospace; cursor: pointer; text-align: left; word-break: break-all; }
        .mplis-lk-code:hover { text-decoration: underline; }
        .mplis-lk-state { margin: 6px 0 4px; font-size: 13px; font-weight: 700; color: var(--mplis-text); }
        .mplis-lk-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
        .mplis-chip { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 20px; color: var(--mplis-text-dim); background: rgba(255,255,255,0.07); border: 1px solid var(--mplis-border); }
        .mplis-chip.good { color: #86efac; background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.35); }
        .mplis-chip.info { color: #67e8f9; background: rgba(34,211,238,0.12); border-color: rgba(34,211,238,0.3); }
        .mplis-chip.warn { color: #fcd34d; background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.35); }
        .mplis-lk-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 4px 0; border-top: 1px solid rgba(148,163,184,0.12); }
        .mplis-lk-row span { color: var(--mplis-text-dim); flex-shrink: 0; }
        .mplis-lk-row b { color: var(--mplis-text); text-align: right; font-weight: 600; }
        .mplis-lk-docs-title { margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(148,163,184,0.12); font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mplis-text-dim); }
        .mplis-lk-docs { margin: 4px 0 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: #dde4f0; word-break: break-all; }
        .mplis-lk-doc { color: var(--mplis-accent-2) !important; text-decoration: none !important; cursor: pointer; }
        .mplis-lk-doc:hover { text-decoration: underline !important; }
        .mplis-dim { color: var(--mplis-text-dim); list-style: none; margin-left: -16px; }

        @media print { #mplis-auto-panel { display: none !important; } }
    `;
  if (typeof GM_addStyle !== "undefined") GM_addStyle(panelStyle);
  else {
    const s = document.createElement("style");
    s.innerHTML = panelStyle;
    document.head.appendChild(s);
  }

  // src/log-friendly.js
  var HIDE = null;
  function viet(s) {
    let t = String(s || "").trim().toLowerCase();
    if (!t) return t;
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t.replace(/\biso\b/gi, "ISO").replace(/\bqt(\d)\b/gi, "QT$1");
  }
  var LOAI_FILE = {
    GCN: "file giấy chứng nhận",
    PT: "file phụ trang",
    GT: "file giấy tờ kèm"
  };
  var TEN_BUOC_API = [
    [/KiemTraCapNhatDuLieuPhapLy/i, "kiểm tra cập nhật dữ liệu pháp lý"],
    [/CapNhatDuLieuPhapLy/i, "lưu dữ liệu pháp lý"],
    [/ThucHienKetISO/i, "Kết ISO"],
    [/executeCommand/i, "chuyển tiếp hồ sơ"],
    [/UpdateHoSoQuet/i, "lưu kho hồ sơ quét"]
  ];
  function tenBuocTuApi(ep) {
    for (const [re, ten] of TEN_BUOC_API) if (re.test(ep)) return ten;
    return "xử lý";
  }
  function lyDoTuServer(raw) {
    const t = String(raw || "");
    const m = /"noiDungNganChan":"([^"]+)"/.exec(t) || /"message":"([^"]+)"/.exec(t);
    return m ? m[1].replace(/\\r|\\n/g, " ").replace(/\s+/g, " ").trim() : "";
  }
  function gonTen(s) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > 70 ? t.slice(0, 67) + "..." : t;
  }
  var RULES = [
    // ---- Bắt đầu / kết thúc ----
    [/^Đã dừng hoạt động\.?$/, "⏸ Đã dừng theo yêu cầu"],
    [/^🎉 ĐÃ CHUYỂN TIẾP VÀ HOÀN THÀNH!?$/, "🎉 Xong hồ sơ: đã xử lý và chuyển tiếp"],
    [/^🎉 ĐÃ HOÀN THÀNH TẤT CẢ QUY TRÌNH!?$/, "🎉 Xong hồ sơ: đã làm hết các bước đã chọn"],
    [/^Hoàn tất chuyển tiếp và các quy trình/, HIDE],
    [/^Tất cả quy trình yêu cầu đã hoàn thành/, HIDE],
    [/^Tìm thấy nút 'Xử lý hồ sơ' ở trang chính/, "Đang mở hồ sơ để xử lý..."],
    // ---- QT0: tệp đính kèm ----
    [/^Auto upload (GCN|GT|PT): (.+)$/i, (m) => "Đang tải lên " + (LOAI_FILE[m[1].toUpperCase()] || "file") + ": " + gonTen(m[2])],
    [/^Bấm 'Cập nhật' tệp đính kèm/, "Đang lưu các file đính kèm vào hồ sơ..."],
    [/^API đã lưu tệp đính kèm/, "✅ Đã lưu xong file đính kèm"],
    [/^Bấm 'Đóng' bảng tệp đính kèm/, HIDE],
    [/^Bấm 'Xử lý hồ sơ' chuyển bước/, "Chuyển sang bước xử lý các tác vụ"],
    [/^Bấm 'Xử lý tác vụ' cho: (.+?)\.{0,3}$/, (m) => "▶ Bắt đầu: " + viet(m[1])],
    // ---- QT1: pháp lý ----
    [/^API DangKyAjax\/GetInfoCapNhatDuLieuPhapLy/, HIDE],
    [/^Tìm thấy nút 'Thực hiện'/, HIDE],
    [/^Phát hiện hộp thoại xác nhận cập nhật pháp lý/, "Xác nhận cập nhật dữ liệu pháp lý..."],
    [/^API DangKyAjax\/KiemTraCapNhatDuLieuPhapLy/, (m, t) => /"success":true/.test(t) ? "✅ Hệ thống kiểm tra pháp lý: đạt" : HIDE],
    [/^API DangKyAjax\/CapNhatDuLieuPhapLy/, (m, t) => /"value":true/.test(t) ? "✅ Đã lưu dữ liệu pháp lý" : HIDE],
    [/^API \S+\/\S+ \(\d+\): /, HIDE],
    [/^API tác vụ đã xử lý:/, HIDE],
    // ---- QT2: lưu kho hồ sơ quét ----
    [/^Bấm 'Thêm mới' hồ sơ quét/, "Đang mở bảng lưu kho hồ sơ quét..."],
    [/^Đã ghi nhớ các số phát hành: (.+)$/, (m) => "Giấy chứng nhận của hồ sơ: " + m[1]],
    [/^Bấm 'Chọn tập tin' để mở bảng chọn/, HIDE],
    [/^Bấm 'Chọn tất cả'/, HIDE],
    [/^Đang chọn đúng file của đơn này/, "Đang chọn các file thuộc hồ sơ..."],
    [/^Đã tích hết bảng/, HIDE],
    [/^Chọn file: (.+)$/, (m) => "Chọn file: " + gonTen(m[1])],
    [/^Bỏ chọn file không thuộc đơn này: (.+)$/, (m) => "Bỏ chọn file không thuộc đơn này: " + gonTen(m[1])],
    [/^Bấm 'Chọn tập tin'\.{0,3}$/, HIDE],
    [/^Bấm 'Chỉnh sửa' file đính kèm(?: \(Gán: (.+?)\))?\.{0,3}$/, (m) => m[1] ? "Đang gắn file vào giấy chứng nhận " + m[1] + "..." : "Đang chỉnh thông tin file..."],
    [/^Đã đổi Loại giấy tờ/, HIDE],
    [/^Đã gán Giấy chứng nhận: (.+)$/, (m) => "Đã chọn đúng giấy chứng nhận " + m[1]],
    [/^Bấm 'Lưu' chi tiết file/, HIDE],
    [/^Bấm 'Cập nhật' lưu kho/, "Đang lưu kho hồ sơ quét..."],
    [/^API đã lưu hồ sơ quét/, "✅ Đã lưu kho hồ sơ quét"],
    [/^✅ Server xác nhận đủ (\d+) giấy chứng nhận đã gắn file: (.+)$/, (m) => "✅ Kiểm tra lại: " + m[1] + " giấy chứng nhận đã có file (" + m[2] + ")"],
    [/^Đã xử lý hết Đơn đăng ký/, HIDE],
    [/^Đang chọn đơn đăng ký thứ (\d+)/, (m) => "Đang chọn đơn đăng ký thứ " + m[1] + "..."],
    [/^Bỏ qua file không khớp giấy chứng nhận nào \((.+?)\): (.+)$/, (m) => "ℹ️ Bỏ qua file không thuộc giấy chứng nhận nào: " + gonTen(m[2])],
    // ---- QT3: sổ địa chính ----
    [/^Đang click chọn dòng thửa đất/, "Đang chọn thửa đất..."],
    [/^Đã chọn thửa, bấm 'Xem sổ địa chính'/, "Đang mở sổ địa chính..."],
    [/^Bấm 'Cập nhật' sổ địa chính/, "Đang cập nhật sổ địa chính..."],
    [/^API đã lưu sổ địa chính/, "✅ Đã lưu sổ địa chính"],
    [/^Cập nhật xong\. Đóng bảng chi tiết/, HIDE],
    [/^Đã xử lý hết các thửa đất/, "✅ Xong tất cả thửa đất"],
    [/^Mạng chậm, huỷ chờ bảng chi tiết/, "Mạng chậm, đang quét lại..."],
    // ---- QT4: Kết ISO ----
    [/^Phát hiện hộp thoại kết ISO/, "Xác nhận Kết ISO..."],
    // ---- QT5: chuyển tiếp ----
    [/^Các QT đã xong, đang bấm nút 'Chuyển tiếp'/, "Các bước đã xong, đang chuyển hồ sơ cho người tiếp theo..."],
    [/^Tìm thấy người nhận '(.+?)'/, (m) => "Chọn người nhận: " + m[1]],
    [/^Bấm 'Thực hiện' chuyển tiếp/, HIDE],
    [/^Phát hiện hộp thoại chuyển tiếp/, "Xác nhận chuyển tiếp..."],
    [/^API chuyển tiếp xong(?: → (.+?))?\.?$/, (m) => m[1] ? '✅ Đã chuyển hồ sơ sang bước "' + m[1] + '"' : "✅ Đã chuyển tiếp hồ sơ"],
    [/^Không thấy '(.+?)', tải lại danh sách/, (m) => 'Chưa thấy người nhận "' + m[1] + '", đang tải lại danh sách...'],
    // ---- Hộp thoại chung ----
    [/^Phát hiện popup xác nhận\. Tự động bấm 'Đồng ý'\.{0,3}(?: \[nội dung: (.+)\])?$/, (m) => m[1] ? 'Đồng ý hộp xác nhận: "' + gonTen(m[1]) + '"' : "Đồng ý hộp xác nhận của hệ thống"],
    [/^Phát hiện hộp thoại báo Thành công/, HIDE],
    // ---- Cảnh báo / lỗi (câu dễ hiểu, kèm hướng xử lý) ----
    [/^⚠️ Server từ chối (\S+): (.*?) — DỪNG AUTO\.?$/, (m) => {
      const ly = lyDoTuServer(m[2]);
      return '⛔ Hệ thống không cho phép bước "' + tenBuocTuApi(m[1]) + '"' + (ly ? ": " + ly : "") + ". Tool đã dừng, bạn xem hồ sơ trên màn hình.";
    }],
    [/^⚠️ Hộp thoại không mong đợi: '(.*?)' — (.*?)\. DỪNG AUTO\.?$/, (m) => "⛔ Có hộp thông báo lạ" + (m[1] ? " «" + m[1] + "»" : "") + ": " + m[2] + ". Tool đã dừng, bạn xem màn hình rồi bấm xử lý lại."],
    [/^⚠️ Phát hiện thông báo lỗi lạ\/sai hồ sơ: (.*?) — DỪNG AUTO!?$/, (m) => "⛔ Hệ thống báo lỗi: " + gonTen(m[1]) + ". Tool đã dừng, bạn xem màn hình."],
    [/^⚠️ Hộp 'Đồng ý' cập nhật pháp lý xuất hiện LẦN 2/, "⛔ Hệ thống hỏi xác nhận pháp lý lần thứ 2, có thể đang có cảnh báo. Tool đã dừng, bạn xem màn hình."],
    [/^⚠️ Không thấy đủ phản hồi lưu\/nạp lại tệp đính kèm sau (\d+)s/, (m) => "⚠️ Chờ " + m[1] + " giây mà chưa thấy hệ thống báo lưu xong file đính kèm nên tool tạm đóng bảng. Bạn kiểm tra lại file đính kèm của hồ sơ."],
    [/^⚠️ Server không lưu được tệp đính kèm: (.*?) — DỪNG AUTO\.?$/, () => "⛔ Hệ thống không lưu được file đính kèm. Tool đã dừng, bạn thử lưu lại bằng tay."],
    [/^⚠️ Upload (.+?) lỗi mạng, thử lại lần (\d)\/2/, (m) => "⚠️ Tải file " + gonTen(m[1]) + " bị lỗi mạng, đang thử lại (lần " + m[2] + "/2)..."],
    [/^⚠️ Upload (.+?) lỗi mạng (\d+) lần liên tiếp\. DỪNG AUTO\.?$/, (m) => "⛔ Tải file " + gonTen(m[1]) + " lỗi mạng nhiều lần. Tool đã dừng, bạn tải file này lên bằng tay."],
    [/^⚠️ Không tìm file (GCN|GT|PT)(?: \(suffix (.+?)\))?\. Dừng để upload tay\.?$/, (m) => "⚠️ Không tìm thấy " + (LOAI_FILE[m[1]] || "file") + " trong thư mục" + (m[2] ? " (đuôi " + m[2] + ")" : "") + ". Bạn tải file này lên bằng tay."],
    [/^⚠️ Chưa đọc được số phát hành của hồ sơ/, "⚠️ Chưa đọc được số phát hành của hồ sơ nên tool không biết chọn file giấy chứng nhận nào. Tool đã dừng, bạn tải file lên bằng tay."],
    [/^⚠️ Mã \.\.\.(\d+): có (\d+) file cùng khớp/, (m) => "⚠️ Có " + m[2] + " file cùng đuôi số " + m[1] + " trong thư mục, tool không biết chọn file nào. Bạn tải file lên bằng tay."],
    [/^⚠️ Không có thửa đất nào\./, "⛔ Hồ sơ không có thửa đất nào để ký sổ. Tool đã dừng."],
    [/^⚠️ LỖI: (SERVER TỪ CHỐI|SERVER KHÔNG LƯU)/, "⛔ Tool đã dừng vì hệ thống từ chối một bước (xem dòng ở trên)."],
    [/^⚠️ LỖI: (.+?)(?: — xem log)?!?$/, (m) => "⛔ Tool đã dừng: " + viet(m[1])]
  ];
  function thanThien(text) {
    const raw = String(text == null ? "" : text).trim();
    if (!raw) return raw;
    const canhBao = /⚠️|LỖI/.test(raw);
    for (const [re, ket] of RULES) {
      const m = re.exec(raw);
      if (!m) continue;
      const out = typeof ket === "function" ? ket(m, raw) : ket;
      if (out === HIDE && canhBao) return raw;
      return out;
    }
    return raw.replace(/\s*—?\s*DỪNG AUTO[.!]?/g, " Tool đã dừng.");
  }
  var boTuTool = (s) => String(s || "").replace('Tắt "chọn hết file" hoặc xử lý tay.', "Cần xử lý tay.").replace(/rồi chạy lại/g, "rồi làm lại").replace(/bấm chạy lại/g, "làm tiếp");
  function moTaLoiTelegram(loai, tieuDe, noiDung) {
    const nd = boTuTool(gonTen(noiDung || "")).slice(0, 300);
    const L = String(loai || "");
    let m;
    if (m = /^Server từ chối (\S+)/.exec(L)) {
      const ly = lyDoTuServer(noiDung);
      return {
        lyDo: 'Cổng MPLIS không cho làm bước "' + tenBuocTuApi(m[1]) + '"' + (ly ? ", lý do: " + ly : ""),
        huongXuLy: "Mở hồ sơ trên MPLIS, đọc thông báo của hệ thống và xử lý theo đó, xong thì làm tiếp."
      };
    }
    if (/^Hộp thoại lạ/.test(L)) {
      return {
        lyDo: "MPLIS hiện một hộp thông báo cần người xem" + (tieuDe && tieuDe.trim() ? " («" + tieuDe.trim() + "»)" : "") + (nd ? ": " + nd : ""),
        huongXuLy: "Mở hồ sơ, đọc hộp thông báo đó và xử lý, xong thì làm tiếp."
      };
    }
    if (/^Thông báo lỗi/.test(L)) return { lyDo: "MPLIS đang báo lỗi" + (nd ? ": " + nd : ""), huongXuLy: "Mở hồ sơ, đọc thông báo lỗi rồi xử lý." };
    if (/^Cập nhật pháp lý bị từ chối/.test(L)) {
      return { lyDo: "MPLIS không cho lưu thông tin pháp lý của hồ sơ" + (nd ? ": " + nd : ""), huongXuLy: "Mở hồ sơ, kiểm tra các thông tin đã điền (ngày vào sổ, số phát hành...) rồi làm lại." };
    }
    if (m = /^QT2 · (.+)$/.exec(L)) {
      return { lyDo: "Lỗi khi lưu file quét vào hồ sơ: " + m[1] + (nd ? " — " + nd : ""), huongXuLy: "Kiểm tra tên file và giấy chứng nhận của hồ sơ rồi làm lại." };
    }
    return { lyDo: L + (nd ? ": " + nd : ""), huongXuLy: "Mở hồ sơ xem chuyện gì xảy ra rồi xử lý tiếp." };
  }

  // src/module-runtime.js
  function createModuleRuntime({ globalStateKey, configStorageKey, defaultConfig, logPrefix, domSuffix }) {
    function loadConfig() {
      const saved = localStorage.getItem(configStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.activeWorkflow && !parsed.activeWorkflows) parsed.activeWorkflows = [parsed.activeWorkflow];
          return { ...defaultConfig, ...parsed };
        } catch (e) {
        }
      }
      return defaultConfig;
    }
    if (window === window.top) {
      if (!topWin[globalStateKey]) {
        topWin[globalStateKey] = {
          isRunning: false,
          successCount: 0,
          lastActionTime: 0,
          currentLockDuration: 1200,
          config: loadConfig(),
          logBuffer: [],
          writeLog: function(text) {
            console.log(logPrefix + text);
            const nice = thanThien(text);
            const el = document.getElementById("mplis-step-log-" + domSuffix);
            if (el && nice !== null) el.textContent = nice;
            try {
              if (localStorage.getItem("mplis_proc_log_enabled") === "false") return;
            } catch (e) {
            }
            const entry = { t: Date.now(), msg: text, nice };
            this.logBuffer.push(entry);
            if (this.logBuffer.length > 300) this.logBuffer.shift();
            const area = document.getElementById("mplis-log-area-" + domSuffix);
            if (area) {
              if (nice !== null) {
                const line = document.createElement("div");
                const hh = new Date(entry.t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                line.textContent = "[" + hh + "] " + nice;
                if (/⚠️|⛔|LỖI|lỗi|dừng|DỪNG/.test(nice)) line.style.color = "#f87171";
                else if (/✅|🎉|Hoàn thành|Thành công/.test(nice)) line.style.color = "#4ade80";
                area.appendChild(line);
                if (area.children.length > 300) area.removeChild(area.firstChild);
                area.scrollTop = area.scrollHeight;
              }
              const badge = document.getElementById("proc-log-count-" + domSuffix);
              if (badge) badge.textContent = this.logBuffer.filter((x) => x.nice !== null).length;
            }
          },
          updateStatus: function(text, type) {
            const statusText = document.getElementById("mplis-status-text-" + domSuffix);
            const statusDot = document.getElementById("mplis-status-dot-" + domSuffix);
            if (statusText) statusText.textContent = text;
            if (statusDot) {
              statusDot.className = "mplis-status-dot";
              if (type === "active") statusDot.classList.add("active");
              if (type === "waiting") statusDot.classList.add("waiting");
              if (type === "error") statusDot.classList.add("error");
            }
          },
          incrementSuccess: function() {
            this.successCount++;
            const el = document.getElementById("mplis-counter-val-" + domSuffix);
            if (el) el.textContent = this.successCount;
          }
        };
      }
    }
    function getTopState() {
      return topWin[globalStateKey];
    }
    function writeLog(text) {
      const s = getTopState();
      if (s) s.writeLog(text);
    }
    function updateStatus(text, type) {
      const s = getTopState();
      if (s) s.updateStatus(text, type);
    }
    function incrementSuccess() {
      const s = getTopState();
      if (s) s.incrementSuccess();
    }
    function setLastActionTime(time, lockDuration = 1200) {
      const s = getTopState();
      if (s) {
        s.lastActionTime = time;
        s.currentLockDuration = lockDuration;
      }
    }
    function saveConfig(cfg) {
      const s = getTopState();
      if (s) {
        s.config = { ...s.config, ...cfg };
        localStorage.setItem(configStorageKey, JSON.stringify(s.config));
      }
    }
    return { getTopState, writeLog, updateStatus, incrementSuccess, setLastActionTime, saveConfig };
  }

  // src/bg-ticker.js
  function setFastInterval(fn, ms) {
    try {
      const src = "setInterval(function(){postMessage(0)}," + Number(ms) + ");";
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      const w = new Worker(url);
      URL.revokeObjectURL(url);
      let fallback = null;
      w.onmessage = () => {
        try {
          fn();
        } catch (e) {
          console.error("[MPLIS ticker]", e);
        }
      };
      w.onerror = () => {
        try {
          w.terminate();
        } catch (e) {
        }
        if (!fallback) fallback = setInterval(fn, ms);
      };
      return;
    } catch (e) {
      console.log("[MPLIS] Không tạo được Worker hẹn giờ, dùng setInterval thường:", e);
    }
    setInterval(fn, ms);
  }

  // src/process-module.js
  var ProcessModule = function() {
    const defaultConfig = {
      activeWorkflows: ["QT0", "QT1", "QT2", "QT3"],
      isQT5: false,
      // QT2 - bảng chọn file hồ sơ quét.
      // true = tích hết mọi file trong bảng, không gỡ tích file nào; khi gắn giấy chứng nhận thì
      // chỉ gắn file có số phát hành trong tên khớp giấy của đơn. false (mặc định) = chỉ tích
      // file khớp Số phát hành của đơn + file gt/pt dùng chung.
      qt2SelectAllFiles: false,
      qt2SoChuSo: 3,
      forwardUser: "",
      delayOpen: 500,
      delayAction: 500,
      delayNext: 500,
      selectorMainProcess: "button:contains('Xử lý hồ sơ'), a:contains('Xử lý hồ sơ'), .btn-process",
      selectorExecute: "button:contains('Thực hiện'), button:contains('Cập nhật'), button:contains('Chấp nhận'), a:contains('Thực hiện')",
      selectorConfirm: "button:contains('Đồng ý'), button:contains('Xác nhận'), button:contains('OK'), button:contains('Có')"
    };
    const { getTopState, writeLog, updateStatus, incrementSuccess, setLastActionTime, saveConfig } = createModuleRuntime({
      globalStateKey: "MPLIS_AUTO_STATE",
      configStorageKey: "mplis_auto_config_v4_1",
      defaultConfig,
      logPrefix: "[MPLIS QT] ",
      domSuffix: "process"
    });
    window.addEventListener("mplis:api", ({ detail: e }) => {
      const topState = getTopState();
      if (!topState || !topState.isRunning) return;
      const ep = e.ep || "";
      const ok = !!(e.res && (e.res.success === true || e.res.Success === true));
      const mHoSo = typeof e.req === "string" && /hoSoTiepNhanId"?\s*[:=]\s*"?([0-9a-fA-F-]{36})/.exec(e.req);
      if (mHoSo && mHoSo[1] !== topState.hoSoIdHienTai) {
        topState.hoSoIdHienTai = mHoSo[1];
        topState.tacVuDaXuLy = null;
      }
      if (ep.includes("UploadGiayToDinhKem")) {
        const ten = topState._lastUploadName || "";
        topState._uploadRetry = topState._uploadRetry || {};
        if (e.err) {
          const n = (topState._uploadRetry[ten] || 0) + 1;
          topState._uploadRetry[ten] = n;
          if (n > 2) {
            writeLog(`⚠️ Upload ${ten || "file"} lỗi mạng ${n} lần liên tiếp. DỪNG AUTO.`);
            updateStatus("Upload lỗi - Dừng", "idle");
            if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function")
              topWin.MPLIS_AUTO_TOGGLE_FUNC(`⚠️ LỖI: UPLOAD ${ten || "FILE"} KHÔNG LÊN — upload tay rồi mới Kết ISO`);
            return;
          }
          writeLog(`⚠️ Upload ${ten || "file"} lỗi mạng, thử lại lần ${n}/2...`);
          document.querySelectorAll("[data-mplis-uploading]").forEach((el) => el.removeAttribute("data-mplis-uploading"));
          topState._uploadFailedAt = Date.now();
          topState.lastActionTime = 0;
        } else if (ten) {
          delete topState._uploadRetry[ten];
        }
      }
      const laLenhGhi = /KiemTraCapNhatDuLieuPhapLy|CapNhatDuLieuPhapLy|ThucHienKetISO|executeCommand|UpdateHoSoQuet/i.test(ep);
      if (laLenhGhi && !e.err) {
        let raw = "";
        try {
          raw = typeof e.res === "string" ? e.res : JSON.stringify(e.res);
        } catch (x) {
          raw = String(e.res);
        }
        raw = (raw || "").slice(0, 600);
        if (/PhapLy/i.test(ep)) writeLog("API " + ep + " (" + (e.status || "?") + "): " + raw);
        let thatBai = !!(e.res && typeof e.res === "object" && (e.res.success === false || e.res.Success === false));
        if (e.res && typeof e.res === "object" && e.res.success === true && e.res.value === false) thatBai = true;
        if (/KiemTraCapNhatDuLieuPhapLy/i.test(ep) && e.res && e.res.value && typeof e.res.value === "object") {
          const v = e.res.value;
          if (v.success === false || v.KiemTraNganChan && v.KiemTraNganChan.coNganChan === true || v.message && String(v.message).trim() || v.KiemTraGiayChungNhan) thatBai = true;
        }
        if (thatBai) {
          writeLog("⚠️ Server từ chối " + ep + ": " + raw + " — DỪNG AUTO.");
          baoLoiTelegram("Server từ chối " + ep, "", raw);
          updateStatus("Server báo lỗi - Dừng", "idle");
          if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: SERVER TỪ CHỐI " + ep + " — xem log");
          return;
        }
      }
      if (topState.qt0Phase === 1) {
        if (/CapNhatGiayToDinhKemHoSo/i.test(ep) && !e.err) {
          if (ok) {
            topState._qt0CapNhatOk = e.t || Date.now();
            topState._qt0ListReloaded = false;
            writeLog("API đã lưu tệp đính kèm: " + (e.res && e.res.message || "thành công"));
          } else {
            writeLog("⚠️ Server không lưu được tệp đính kèm: " + (typeof e.res === "string" ? e.res : JSON.stringify(e.res)).slice(0, 400) + " — DỪNG AUTO.");
            updateStatus("Lưu tệp đính kèm lỗi - Dừng", "idle");
            if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: SERVER KHÔNG LƯU ĐƯỢC TỆP ĐÍNH KÈM — xem log");
            return;
          }
        } else if (/GetDanhSachGiayToDinhKem/i.test(ep) && !e.err && topState._qt0CapNhatOk && (e.t || Date.now()) >= topState._qt0CapNhatOk) {
          topState._qt0ListReloaded = true;
        }
      }
      if (/UpdateTacVuDaXuLy/i.test(ep) && e.res && Array.isArray(e.res.value)) {
        topState.tacVuDaXuLy = e.res.value.slice();
        writeLog("API tác vụ đã xử lý: " + e.res.value.join(", "));
      }
      if (ep.includes("KiemTraCapNhatDuLieuPhapLy") && ok) topState.expectQT1Confirm = true;
      if (ep.includes("CapNhatDuLieuPhapLy") && !ep.includes("KiemTra") && ok) {
        topState.expectQT1Confirm = false;
        topState.qt1ConfirmStreak = 0;
      }
      if (ep.includes("ThucHienKetISO")) topState.expectQT4Confirm = false;
      if (/UpdateHoSoQuetExistFile/i.test(ep) && ok) {
        writeLog("API đã lưu hồ sơ quét (QT2).");
        try {
          const ds = (topState.qt2SoPhatHanhList || []).map(chuanSph).filter(Boolean);
          const dong = (((e.res || {}).Value || {}).ListFileHoSoQuet || {}).ListFileHoSoQuet;
          if (ds.length && Array.isArray(dong)) {
            const loi = [];
            for (const sph of ds) {
              const khop = dong.filter((f) => f && f.laGiayChungNhan && f.giayChungNhanId && chuanSph(f.moTa).includes(sph));
              if (khop.length === 0) loi.push("giấy " + sph + " CHƯA có file nào gắn");
              else if (khop.length > 1) loi.push("giấy " + sph + " bị gắn " + khop.length + " file");
            }
            if (!loi.length) writeLog("✅ Server xác nhận đủ " + ds.length + " giấy chứng nhận đã gắn file: " + ds.join(", "));
            else if (ds.length >= 2) {
              dungQT2("Gắn giấy chứng nhận lệch", "Sau khi lưu, hệ thống cho thấy: " + loi.join("; "));
              return;
            } else writeLog("⚠️ Đối chiếu server (1 giấy, không chặn): " + loi.join("; "));
          }
        } catch (x) {
          console.log("[MPLIS QT2] Lỗi đối chiếu phản hồi lưu kho:", x);
        }
      }
      if (/CapNhatSoDiaChinh/i.test(ep) && ok) writeLog("API đã lưu sổ địa chính (QT3).");
      if (ep.includes("executeCommand") && ok) {
        topState.expectQT5Confirm = false;
        const ns = e.res && e.res.newState;
        topState._qt5Done = ns && (ns.Title || ns.State) || true;
        writeLog("API chuyển tiếp xong" + (ns && ns.Title ? " → " + ns.Title : "") + ".");
      }
      setTimeout(scanAndExecute, 50);
    });
    function docSphTuTen(text) {
      const m = /-\s*([A-ZĐ]{1,2})\s*(\d{5,})/.exec(String(text || "").toUpperCase());
      return m ? m[1] + m[2] : "";
    }
    const chuanSph = (t) => String(t || "").replace(/\s+/g, "").toUpperCase();
    function dungQT2(trangThai, noiDung) {
      writeLog("⚠️ " + noiDung + " — DỪNG AUTO.");
      baoLoiTelegram("QT2 · " + trangThai, "", noiDung);
      updateStatus(trangThai + " - Dừng", "idle");
      if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: QT2 " + trangThai.toUpperCase() + " — xem log");
    }
    function baoLoiTelegram(loai, tieuDe, noiDung) {
      try {
        if (typeof topWin.MPLIS_TG_ALERT !== "function") return;
        const ma = findCurrentMaHS(document, true) || "";
        const { lyDo, huongXuLy } = moTaLoiTelegram(loai, tieuDe, noiDung);
        const d = /* @__PURE__ */ new Date();
        const p = (n) => String(n).padStart(2, "0");
        const gio = p(d.getHours()) + ":" + p(d.getMinutes()) + " " + p(d.getDate()) + "/" + p(d.getMonth() + 1);
        const cs = [
          "⛔ <b>HỒ SƠ BỊ VƯỚNG</b>",
          "━━━━━━━━━━━━━━",
          ma ? "📄 Hồ sơ: <b>" + escapeHtml(ma) + "</b>" : "",
          "❗ " + escapeHtml(lyDo),
          "👉 " + escapeHtml(huongXuLy),
          "🕒 " + gio
        ].filter(Boolean);
        topWin.MPLIS_TG_ALERT(cs.join("\n"), ma);
      } catch (e) {
      }
    }
    function getTaskText(tName) {
      if (tName === "QT1") return "cập nhật dữ liệu pháp lý";
      if (tName === "QT2") return "lưu kho hồ sơ quét";
      if (tName === "QT3") return "ký số sổ địa chính";
      if (tName === "QT4") return "kết iso";
      return tName.toLowerCase();
    }
    function findTaskProcessButton(taskNames) {
      if (!taskNames || taskNames.length === 0) return null;
      try {
        const rows = Array.from(document.querySelectorAll("tr"));
        for (const tCode of taskNames) {
          if (tCode === "QT0") continue;
          const tName = getTaskText(tCode);
          for (const row of rows) {
            const rowText = (row.textContent || "").toLowerCase();
            if (rowText.includes(tName)) {
              let isDone = false;
              const checkbox = row.querySelector('input[type="checkbox"]');
              if (checkbox && checkbox.checked) isDone = true;
              if (rowText.includes("đã xử lý") || rowText.includes("hoàn thành")) isDone = true;
              if (row.querySelector('.k-i-check, .fa-check, img[src*="check"], .dx-icon-check')) isDone = true;
              const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
              if (inputs.some((input) => (input.value || "").toLowerCase().includes("đã xử lý"))) isDone = true;
              if (row.getAttribute("data-mplis-processed") === "true") isDone = true;
              const maTacVuApi = { QT1: "CapNhatDuLieuPhapLy", QT4: "KetISO" }[tCode];
              const dsApi = (getTopState() || {}).tacVuDaXuLy;
              if (maTacVuApi && Array.isArray(dsApi) && dsApi.includes(maTacVuApi)) isDone = true;
              if (!isDone) {
                const interactives = Array.from(row.querySelectorAll('a, button, [role="button"]'));
                const targetBtn = interactives.find((el) => {
                  const btnText = (el.textContent || el.value || "").trim().toLowerCase();
                  return btnText.includes("xử lý") || btnText.includes("tác vụ");
                });
                if (targetBtn) {
                  return { button: targetBtn, taskName: tName, taskCode: tCode, isDone: false };
                }
              }
            }
          }
        }
        let foundAnyTask = false;
        for (const tCode of taskNames) {
          if (tCode === "QT0") continue;
          const tNameText = getTaskText(tCode);
          for (const row of rows) {
            if ((row.textContent || "").toLowerCase().includes(tNameText)) {
              foundAnyTask = true;
              break;
            }
          }
          if (foundAnyTask) break;
        }
        if (foundAnyTask) {
          return { button: null, taskName: "Tất cả quy trình", isDone: true };
        }
      } catch (e) {
      }
      return null;
    }
    let _dangQuetTu = 0;
    async function scanAndExecute() {
      if (_dangQuetTu && Date.now() - _dangQuetTu < 2e4) return;
      _dangQuetTu = Date.now();
      try {
        await scanVong();
      } finally {
        _dangQuetTu = 0;
      }
    }
    async function scanVong() {
      try {
        const topState = getTopState();
        if (!topState || !topState.isRunning) return;
        const now2 = Date.now();
        const lockDuration = topState.currentLockDuration || 1200;
        if (topState.lastActionTime && now2 - topState.lastActionTime < lockDuration) return;
        if (isSystemLoading()) {
          updateStatus("Hệ thống đang xử lý...", "waiting");
          return;
        }
        const jconfirmBox = document.querySelector(".jconfirm-box");
        if (jconfirmBox) {
          const jcRect = jconfirmBox.getBoundingClientRect();
          if (jcRect.width > 0 && jcRect.height > 0) {
            const jcMessage = (jconfirmBox.querySelector(".jconfirm-content, .jconfirm-message") || {}).textContent || "";
            const jcTitle = (jconfirmBox.querySelector(".jconfirm-title") || {}).textContent || "";
            const msgLower = jcMessage.toLowerCase();
            const titleLower = jcTitle.toLowerCase();
            const isQT1Confirm = topState.expectQT1Confirm === true || msgLower.includes("cập nhật dữ liệu pháp lý") || titleLower.includes("cập nhật dữ liệu pháp lý");
            const isQT4Confirm = topState.expectQT4Confirm === true || msgLower.includes("bạn có thật sự muốn kết iso hồ sơ này hay không");
            const isQT5Confirm = topState.expectQT5Confirm === true || msgLower.includes("chuyển bước") || msgLower.includes("chuyển tiếp") || msgLower.includes("chuyển tác vụ") || msgLower.includes("chuyển");
            if (isQT1Confirm || isQT4Confirm || isQT5Confirm) {
              if (isQT1Confirm && (topState.qt1ConfirmStreak || 0) >= 1) {
                writeLog("⚠️ Hộp 'Đồng ý' cập nhật pháp lý xuất hiện LẦN 2 liên tiếp (tiêu đề: '" + jcTitle.trim() + "'). Có thể là cảnh báo. DỪNG AUTO để kiểm tra.");
                baoLoiTelegram("Cập nhật pháp lý bị từ chối", jcTitle, (jcMessage || "").replace(/\s+/g, " ").trim().slice(0, 400));
                updateStatus("Nghi cảnh báo - Dừng", "idle");
                if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: HỘP XÁC NHẬN CẬP NHẬT PHÁP LÝ LẶP LẠI LẦN 2!");
                return;
              }
              const agreeBtn = jconfirmBox.querySelector(".jconfirm-buttons .btn-orange, .jconfirm-buttons button:first-child");
              if (agreeBtn && !agreeBtn.hasAttribute("data-mplis-clicked")) {
                setLastActionTime(now2, topState.config.delayNext);
                if (isQT4Confirm) writeLog("Phát hiện hộp thoại kết ISO. Bấm 'Đồng ý'...");
                else if (isQT5Confirm) writeLog("Phát hiện hộp thoại chuyển tiếp. Bấm 'Đồng ý'...");
                else writeLog("Phát hiện hộp thoại xác nhận cập nhật pháp lý. Bấm 'Đồng ý'...");
                agreeBtn.setAttribute("data-mplis-clicked", "true");
                setTimeout(() => {
                  try {
                    agreeBtn.removeAttribute("data-mplis-clicked");
                  } catch (e) {
                  }
                }, 3e3);
                try {
                  agreeBtn.click();
                } catch (e) {
                }
                if (isQT1Confirm) topState.qt1ConfirmStreak = (topState.qt1ConfirmStreak || 0) + 1;
                incrementSuccess();
                updateStatus("Chờ xử lý...", "waiting");
                return;
              }
            } else {
              if (msgLower.includes("thành công") || titleLower.includes("thành công")) {
                const okBtn = jconfirmBox.querySelector(".jconfirm-buttons button:first-child");
                if (okBtn && !okBtn.hasAttribute("data-mplis-clicked")) {
                  writeLog("Phát hiện hộp thoại báo Thành công. Đóng hộp thoại...");
                  okBtn.setAttribute("data-mplis-clicked", "true");
                  setTimeout(() => {
                    try {
                      okBtn.removeAttribute("data-mplis-clicked");
                    } catch (e) {
                    }
                  }, 3e3);
                  try {
                    okBtn.click();
                  } catch (e) {
                  }
                  setLastActionTime(now2, 500);
                  return;
                }
              }
              const jcNoiDung = (jcMessage || "").replace(/\s+/g, " ").trim().slice(0, 400);
              writeLog("⚠️ Hộp thoại không mong đợi: '" + jcTitle.trim() + "' — " + (jcNoiDung || "(không có nội dung)") + ". DỪNG AUTO.");
              baoLoiTelegram("Hộp thoại lạ", jcTitle, jcNoiDung);
              updateStatus("Hộp thoại lạ - Dừng", "idle");
              if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: PHÁT HIỆN HỘP THOẠI LẠ!");
              return;
            }
          }
        }
        const laNutXacNhanThat = (el) => {
          try {
            if (el.disabled || el.closest("#mplis-tenfile-toolbar")) return false;
            const t = (el.textContent || el.value || "").replace(/\s+/g, " ").trim().toLowerCase();
            return t.length <= 20 && /^(đồng ý|xác nhận|ok|có)\s*([,.!]|$)/.test(t);
          } catch (e) {
            return false;
          }
        };
        const confirmBtns = querySelectorAllCustom(topState.config.selectorConfirm).filter(laNutXacNhanThat);
        const visibleConfirmBtns = confirmBtns.filter((el) => {
          try {
            return el.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        });
        let hasErrorWarning = false;
        let errorText = "";
        const activeModals = Array.from(document.querySelectorAll(".modal.in, .modal.show, .dx-popup-content, .k-window"));
        for (const m of activeModals) {
          const text = (m.textContent || "").toLowerCase();
          if (text.includes("sai hồ sơ") || text.includes("có lỗi xảy ra") || text.includes("không hợp lệ") || text.includes("cảnh báo")) {
            hasErrorWarning = true;
            errorText = text;
            break;
          }
        }
        if (hasErrorWarning && visibleConfirmBtns.length > 0) {
          writeLog("⚠️ Phát hiện thông báo lỗi lạ/sai hồ sơ: " + errorText.replace(/\s+/g, " ").trim().slice(0, 300) + " — DỪNG AUTO!");
          baoLoiTelegram("Thông báo lỗi", "", errorText.replace(/\s+/g, " ").trim().slice(0, 400));
          updateStatus("Lỗi - Dừng Auto", "idle");
          if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: PHÁT HIỆN THÔNG BÁO LẠ!");
          return;
        }
        if (visibleConfirmBtns.length > 0) {
          const confirmBtn = visibleConfirmBtns[visibleConfirmBtns.length - 1];
          if (!confirmBtn.hasAttribute("data-mplis-clicked")) {
            setLastActionTime(now2, topState.config.delayNext);
            let noiDungPopup = "";
            try {
              const khung = confirmBtn.closest(".modal, .jconfirm-box, .k-window, .ui-dialog, .dx-popup-content");
              noiDungPopup = (khung && khung.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);
            } catch (e) {
            }
            writeLog("Phát hiện popup xác nhận. Tự động bấm 'Đồng ý'..." + (noiDungPopup ? " [nội dung: " + noiDungPopup + "]" : ""));
            confirmBtn.setAttribute("data-mplis-clicked", "true");
            setTimeout(() => {
              try {
                confirmBtn.removeAttribute("data-mplis-clicked");
              } catch (e) {
              }
            }, 3e3);
            try {
              confirmBtn.click();
            } catch (e) {
            }
            incrementSuccess();
            updateStatus("Chờ lưu...", "waiting");
            return;
          }
        }
        if (topState.uploadDirHandle && typeof topState.refreshUploadFolder === "function" && now2 - (topState._dirRefreshAt || 0) > 1500 && document.querySelector('#btnUploadFile.btn-success, a[type="upload"].btn-success')) {
          topState._dirRefreshAt = now2;
          try {
            await topState.refreshUploadFolder();
          } catch (e) {
            console.log("[MPLIS Upload] Không đọc lại được thư mục (mất quyền truy cập?):", e);
          }
        }
        if (topState.uploadFolderFiles && topState.uploadFolderFiles.length > 0) {
          const uploadBtns = Array.from(document.querySelectorAll('#btnUploadFile.btn-success, a[type="upload"].btn-success')).filter((el) => {
            try {
              return el.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          });
          const btnUpload = uploadBtns.find((el) => !el.hasAttribute("data-mplis-uploading"));
          if (!btnUpload && topState._uploadFailedAt) {
            if (now2 - topState._uploadFailedAt < 6e3) {
              updateStatus("Đợi thử lại upload...", "waiting");
              return;
            }
            const ten = topState._lastUploadName || "file";
            topState._uploadFailedAt = 0;
            writeLog(`⚠️ Upload ${ten} lỗi mạng và không thấy nút upload để thử lại. DỪNG AUTO.`);
            updateStatus("Upload lỗi - Dừng", "idle");
            if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function")
              topWin.MPLIS_AUTO_TOGGLE_FUNC(`⚠️ LỖI: UPLOAD ${ten} KHÔNG LÊN — upload tay rồi mới Kết ISO`);
            return;
          }
          if (btnUpload) {
            const row = btnUpload.closest("tr");
            const rowText = (row && row.textContent || "").toUpperCase();
            let fileType = "GCN";
            if (/\bGT\b/.test(rowText) || rowText.includes("GIẤY TỜ KÈM")) fileType = "GT";
            else if (/\bPT\b/.test(rowText) || rowText.includes("PHỤ TRANG")) fileType = "PT";
            const soChuSo = topState.config.qt2SoChuSo || 3;
            let sphList = (topState.qt2SoPhatHanhList || []).slice();
            if (sphList.length === 0) {
              const SPH_RE2 = /^([A-ZĐ]{1,2}\s*\d{5,})$/;
              document.querySelectorAll("button, a, span").forEach((el) => {
                const txt = (el.textContent || "").trim().replace(/^\+\s*/, "").replace(/\s+/g, "").toUpperCase();
                if (SPH_RE2.test(txt) && !sphList.includes(txt)) sphList.push(txt);
              });
            }
            if (sphList.length === 0) {
              const activeTree = Array.from(document.querySelectorAll("#treeThongTinDangKy, #treeGiayChungNhan")).find((el) => {
                try {
                  return el.getBoundingClientRect().width > 0;
                } catch (e) {
                  return false;
                }
              });
              if (activeTree) {
                for (const node of activeTree.querySelectorAll("a")) {
                  const m = (node.textContent || "").match(/Số phát hành:\s*([A-Za-z0-9\s]+)\s*-/i);
                  if (m) {
                    const sph = m[1].trim().replace(/\s+/g, "").toUpperCase();
                    if (!sphList.includes(sph)) sphList.push(sph);
                  }
                }
              }
            }
            const rowSphM = rowText.match(/\b([A-ZĐ]{1,2}\s*\d{5,})\b/);
            const sphSrc = rowSphM ? rowSphM[1] : sphList[0] || "";
            const sphNum = sphSrc.replace(/[^0-9]/g, "");
            const suffix = sphNum.slice(-soChuSo);
            const files = topState.uploadFolderFiles;
            if (!suffix && fileType === "GCN") {
              if (!topState._chuaCoSphTu) topState._chuaCoSphTu = now2;
              if (now2 - topState._chuaCoSphTu < 15e3) {
                updateStatus("Đợi đọc số phát hành của hồ sơ...", "waiting");
                return;
              }
              topState._chuaCoSphTu = 0;
              writeLog("⚠️ Chưa đọc được số phát hành của hồ sơ nên không biết chọn file giấy chứng nhận nào. Dừng — upload thủ công.");
              updateStatus("Không đọc được số phát hành - Dừng", "idle");
              if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function")
                topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ Chưa đọc được số phát hành — upload file giấy chứng nhận bằng tay");
              return;
            }
            if (suffix) topState._chuaCoSphTu = 0;
            const _sameCodeFiles = !suffix ? [] : files.filter((f) => {
              const n = f.name.toUpperCase();
              if (/(GT|PT)\.PDF$/.test(n)) return false;
              return n.endsWith(suffix + ".PDF") || n.endsWith(suffix + "+.PDF");
            });
            if (_sameCodeFiles.length > 1) {
              writeLog(`⚠️ Mã ...${suffix}: có ${_sameCodeFiles.length} file cùng khớp. Dừng — upload thủ công.`);
              updateStatus("2 file cùng mã - Dừng", "idle");
              if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function")
                topWin.MPLIS_AUTO_TOGGLE_FUNC(`⚠️ Mã ...${suffix} có ${_sameCodeFiles.length} file — upload thủ công`);
              return;
            }
            const _findGcnBySuffix = (sfx) => {
              if (!sfx) return null;
              const _match = (f) => {
                const n = f.name.toUpperCase();
                if (/(GT|PT)\.PDF$/.test(n)) return false;
                if (n.endsWith(sfx + ".PDF") || n.endsWith(sfx + "+.PDF")) return true;
                return n.replace(/\.PDF$/, "").split("+").some((p) => p && p.endsWith(sfx));
              };
              const longFmt = files.find((f) => f.name.includes("-") && _match(f));
              if (longFmt) return longFmt;
              return files.find((f) => _match(f));
            };
            let gcnFile = _findGcnBySuffix(suffix);
            if (!gcnFile && sphList.length > 0) {
              for (const sph of sphList) {
                const sfx2 = sph.replace(/[^0-9]/g, "").slice(-soChuSo);
                if (sfx2 === suffix) continue;
                gcnFile = _findGcnBySuffix(sfx2);
                if (gcnFile) break;
              }
            }
            const gcnDir = gcnFile && gcnFile.webkitRelativePath ? gcnFile.webkitRelativePath.replace(/\/[^/]+$/, "") : null;
            const gcnBase = gcnFile && gcnFile.name.includes("-") ? gcnFile.name.replace(/-[^-]+\.pdf$/i, "").toUpperCase() : null;
            const _findByMaHS = (sfx) => {
              if (!sfx) return null;
              return files.find((f) => {
                const n = f.name.toUpperCase().replace(/\.PDF$/, "");
                if (!n.includes("+")) return false;
                return n.split("+").map((s) => s.trim()).includes(sfx);
              }) || null;
            };
            let matchedFile = null;
            let warnSuffix = suffix;
            if (fileType === "GT") {
              const gtSfxM = rowText.match(/\b(\d{3,}\+?)-GT(?:\.PDF)?(?![A-Z])/i);
              const gtSfxFull = gtSfxM ? gtSfxM[1] : null;
              const gtSfx = gtSfxFull ? gtSfxFull.replace(/\+$/, "").slice(-soChuSo) : null;
              warnSuffix = gtSfxFull || gtSfx || suffix;
              if (gtSfxFull) matchedFile = files.find((f) => f.name.toUpperCase().endsWith(gtSfxFull.toUpperCase() + "-GT.PDF"));
              if (!matchedFile && soChuSo === 4) matchedFile = _findByMaHS(gtSfx);
              if (!matchedFile && gcnBase) matchedFile = files.find((f) => f.name.toUpperCase() === gcnBase + "-GT.PDF" || f.name.toUpperCase() === gcnBase + "+-GT.PDF");
              if (!matchedFile && gcnDir) matchedFile = files.find((f) => /GT\.PDF$/i.test(f.name) && (f.webkitRelativePath || "").startsWith(gcnDir + "/"));
              if (!matchedFile && soChuSo !== 4) {
                for (const sph of sphList) {
                  const sfx = sph.replace(/[^0-9]/g, "").slice(-soChuSo);
                  if (gtSfx && sfx === gtSfx) continue;
                  const found = files.find((f) => f.name.toUpperCase().endsWith(sfx + "-GT.PDF") || f.name.toUpperCase().endsWith(sfx + "+-GT.PDF"));
                  if (found) {
                    matchedFile = found;
                    break;
                  }
                }
              }
              if (!matchedFile) matchedFile = files.find((f) => /-GT\.PDF$/i.test(f.name)) || null;
              if (!matchedFile && gtSfx && !(gcnFile && gcnFile.name.includes("+"))) {
                const s = gtSfx.toUpperCase();
                matchedFile = files.find((f) => {
                  const n = f.name.toUpperCase();
                  if (/(GT|PT)\.PDF$/.test(n)) return false;
                  return n.includes(s + "+") && f.name.split("+").length >= 3;
                }) || null;
              }
              if (!matchedFile && gcnFile && gcnFile.name.includes("+")) matchedFile = gcnFile;
            } else if (fileType === "PT") {
              const ptSfxM = rowText.match(/\b(\d{3,}\+?)-PT(?:\.PDF)?(?![A-Z])/i);
              const ptSfxFull = ptSfxM ? ptSfxM[1] : null;
              const ptSfx = ptSfxFull ? ptSfxFull.replace(/\+$/, "").slice(-soChuSo) : null;
              warnSuffix = ptSfxFull || ptSfx || suffix;
              if (ptSfxFull) matchedFile = files.find((f) => f.name.toUpperCase().endsWith(ptSfxFull.toUpperCase() + "-PT.PDF"));
              if (!matchedFile && soChuSo === 4) matchedFile = _findByMaHS(ptSfx);
              if (!matchedFile && gcnBase) matchedFile = files.find((f) => f.name.toUpperCase() === gcnBase + "-PT.PDF" || f.name.toUpperCase() === gcnBase + "+-PT.PDF");
              if (!matchedFile && gcnDir) matchedFile = files.find((f) => /PT\.PDF$/i.test(f.name) && (f.webkitRelativePath || "").startsWith(gcnDir + "/"));
              if (!matchedFile && soChuSo !== 4) {
                for (const sph of sphList) {
                  const sfx = sph.replace(/[^0-9]/g, "").slice(-soChuSo);
                  if (ptSfx && sfx === ptSfx) continue;
                  const found = files.find((f) => f.name.toUpperCase().endsWith(sfx + "-PT.PDF") || f.name.toUpperCase().endsWith(sfx + "+-PT.PDF"));
                  if (found) {
                    matchedFile = found;
                    break;
                  }
                }
              }
              if (!matchedFile) matchedFile = files.find((f) => /-PT\.PDF$/i.test(f.name)) || null;
              if (!matchedFile && ptSfx && !(gcnFile && gcnFile.name.includes("+"))) {
                const s = ptSfx.toUpperCase();
                matchedFile = files.find((f) => {
                  const n = f.name.toUpperCase();
                  if (/(GT|PT)\.PDF$/.test(n)) return false;
                  return n.includes(s + "+") && f.name.split("+").length >= 3;
                }) || null;
              }
              if (!matchedFile && gcnFile && gcnFile.name.includes("+")) matchedFile = gcnFile;
            } else if (suffix) {
              matchedFile = gcnFile || null;
            }
            if (matchedFile) {
              writeLog(`Auto upload ${fileType}: ${matchedFile.name}`);
              btnUpload.setAttribute("data-mplis-uploading", "true");
              topState._pendingUploadFile = matchedFile;
              topState._lastUploadName = matchedFile.name;
              topState._uploadFailedAt = 0;
              const jqU = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
              if (jqU) jqU(btnUpload).click();
              else clickElement(btnUpload);
              setLastActionTime(now2, topState.config.delayAction);
              setTimeout(() => {
                try {
                  btnUpload.removeAttribute("data-mplis-uploading");
                } catch (e2) {
                }
              }, 8e3);
              return;
            } else {
              writeLog(`⚠️ Không tìm file ${fileType}${warnSuffix ? " (suffix " + warnSuffix + ")" : ""}. Dừng để upload tay.`);
              updateStatus("Cần upload tay", "idle");
              if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function")
                topWin.MPLIS_AUTO_TOGGLE_FUNC(`⚠️ Không tìm file ${fileType} — upload tay rồi bấm lại`);
            }
          }
        }
        if (topState.config.activeWorkflows.includes("QT0")) {
          const btnUpdateAttactFile = document.querySelector("#btnUpdateAttactFile");
          const tbGiayToDinhKem = document.querySelector("#tbGiayToDinhKem");
          const isAttachModalOpen = btnUpdateAttactFile && tbGiayToDinhKem && (() => {
            try {
              return btnUpdateAttactFile.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          })();
          if (isAttachModalOpen) {
            topState.currentTaskCode = "QT0";
            if (!topState.qt0Phase || topState.qt0Phase === 0) {
              if (!btnUpdateAttactFile.hasAttribute("data-mplis-clicked")) {
                writeLog("Bấm 'Cập nhật' tệp đính kèm...");
                btnUpdateAttactFile.setAttribute("data-mplis-clicked", "true");
                topState._qt0ClickAt = now2;
                topState._qt0CapNhatOk = 0;
                topState._qt0ListReloaded = false;
                clickElement(btnUpdateAttactFile);
                topState.qt0Phase = 1;
                setLastActionTime(now2, 1e3);
                return;
              }
            } else if (topState.qt0Phase === 1) {
              const rows = Array.from(tbGiayToDinhKem.querySelectorAll("tbody tr"));
              const hasLoadedFiles = rows.some((tr) => {
                const text = tr.textContent.toUpperCase();
                return text.includes("NHẬP THÔNG TIN");
              });
              const sauClick = now2 - (topState._qt0ClickAt || now2);
              const daLuu = topState._qt0CapNhatOk > 0, daNapLai = topState._qt0ListReloaded === true;
              const sanSangDong = daLuu && daNapLai || !daLuu && sauClick > 1e4 || daLuu && sauClick > 3e4;
              if (hasLoadedFiles && !sanSangDong) {
                updateStatus(daLuu ? "Đợi bảng nạp lại sau khi lưu..." : "Đợi server lưu tệp đính kèm...", "waiting");
                return;
              }
              if (hasLoadedFiles && !(daLuu && daNapLai)) writeLog("⚠️ Không thấy đủ phản hồi lưu/nạp lại tệp đính kèm sau " + Math.round(sauClick / 1e3) + "s, đóng bảng theo cách dự phòng.");
              if (hasLoadedFiles) {
                const btnDongList = Array.from(document.querySelectorAll(".modal-footer button, .panel-footer button")).filter((b) => {
                  try {
                    if (b.getBoundingClientRect().width === 0) return false;
                    const t = (b.textContent || "").toLowerCase();
                    return t.includes("đóng") || b.hasAttribute("data-dismiss");
                  } catch (e) {
                    return false;
                  }
                });
                if (btnDongList.length > 0) {
                  const btnDongModal = btnDongList[btnDongList.length - 1];
                  if (!btnDongModal.hasAttribute("data-mplis-clicked")) {
                    writeLog("Bấm 'Đóng' bảng tệp đính kèm...");
                    btnDongModal.setAttribute("data-mplis-clicked", "true");
                    clickElement(btnDongModal);
                    topState.qt0Phase = 2;
                    setLastActionTime(now2, 1e3);
                    return;
                  }
                }
              } else {
                updateStatus("Đợi file có 'Nhập thông tin'...", "waiting");
                return;
              }
            } else if (topState.qt0Phase === 2) {
              updateStatus("Chờ bảng đính kèm đóng...", "waiting");
            }
            return;
          } else if (topState.qt0Phase === 2) {
            const btnXulyList = Array.from(document.querySelectorAll("button, a")).filter((b) => {
              const t = (b.textContent || b.innerText || "").trim().toLowerCase();
              return b.id === "btnXuly" || t === "xử lý hồ sơ";
            });
            const btnXuly = btnXulyList.find((b) => {
              try {
                return b.getBoundingClientRect().width > 0;
              } catch (e) {
                return false;
              }
            });
            if (btnXuly) {
              if (!btnXuly.hasAttribute("data-mplis-clicked")) {
                writeLog("Bấm 'Xử lý hồ sơ' chuyển bước...");
                btnXuly.setAttribute("data-mplis-clicked", "true");
                clickElement(btnXuly);
                topState.qt0Phase = 0;
                setLastActionTime(now2, topState.config.delayAction);
                return;
              }
            } else {
              updateStatus("Đợi nút Xử lý hồ sơ...", "waiting");
              return;
            }
          }
        }
        const fwdTable = document.getElementById("frmChuyenTiepHoSo_tbUsers");
        if (fwdTable && topState.config.isQT5 && topState.config.forwardUser) {
          const isTableVisible = (() => {
            try {
              return fwdTable.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          })();
          if (isTableVisible) {
            const searchKey = topState.config.forwardUser.toLowerCase();
            const rows = Array.from(fwdTable.querySelectorAll("tbody tr"));
            let matchedRow = null;
            for (const row of rows) {
              if ((row.textContent || "").toLowerCase().includes(searchKey)) {
                matchedRow = row;
                break;
              }
            }
            if (matchedRow) {
              const checkBtn = matchedRow.querySelector(".chkSelect, .fa-check-circle");
              if (checkBtn && !checkBtn.hasAttribute("data-mplis-clicked")) {
                writeLog(`Tìm thấy người nhận '${topState.config.forwardUser}'. Đang chọn...`);
                checkBtn.setAttribute("data-mplis-clicked", "true");
                clickElement(checkBtn);
                setLastActionTime(now2, topState.config.delayAction);
                return;
              }
              const modal = fwdTable.closest(".modal, .k-window, .ui-dialog") || document.body;
              const submitBtns = Array.from(modal.querySelectorAll("button")).filter((b) => {
                const t = (b.textContent || "").trim().toLowerCase();
                return t === "thực thi" || b.id === "btnExecuteCommand" || t === "thực hiện" || t === "chấp nhận" || t === "chuyển tiếp" || t === "lưu";
              });
              if (submitBtns.length > 0) {
                const sBtn = submitBtns[submitBtns.length - 1];
                if (!sBtn.hasAttribute("data-mplis-clicked")) {
                  writeLog("Bấm 'Thực hiện' chuyển tiếp...");
                  topState._qt5ClickAt = now2;
                  topState._qt5Done = false;
                  sBtn.setAttribute("data-mplis-clicked", "true");
                  clickElement(sBtn);
                  setTimeout(() => {
                    try {
                      sBtn.removeAttribute("data-mplis-clicked");
                    } catch (e) {
                    }
                  }, 5e3);
                  setLastActionTime(now2, topState.config.delayNext);
                  return;
                } else {
                  updateStatus("Đợi hoàn tất chuyển tiếp...", "waiting");
                  return;
                }
              }
            } else {
              const reloadBtn = document.getElementById("btnReloadUser");
              if (reloadBtn && !reloadBtn.hasAttribute("data-mplis-clicked")) {
                writeLog(`Không thấy '${topState.config.forwardUser}', tải lại danh sách...`);
                reloadBtn.setAttribute("data-mplis-clicked", "true");
                clickElement(reloadBtn);
                setLastActionTime(now2, 2e3);
                return;
              } else if (reloadBtn && reloadBtn.hasAttribute("data-mplis-clicked")) {
                writeLog(`⚠️ Không thấy người nhận '${topState.config.forwardUser}'. DỪNG AUTO.`);
                updateStatus("Lỗi người nhận", "idle");
                if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: KHÔNG TÌM THẤY NGƯỜI NHẬN!");
                return;
              }
            }
          }
        }
        if (topState.isWaitingForQT3Modal) {
          const isUpdateBtnVisible = Array.from(document.querySelectorAll(".modal.in .modal-body button, .modal.in .modal-body a, .modal.show .modal-body button, .k-window button, .k-window a, .ui-dialog button, .ui-dialog a, .dx-popup-content button")).some((el) => {
            if ((el.textContent || el.innerText || "").trim().toLowerCase() !== "cập nhật") return false;
            try {
              return el.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          }) || Array.from(document.querySelectorAll("button, a")).some((el) => {
            if ((el.textContent || el.innerText || "").trim().toLowerCase() !== "cập nhật") return false;
            try {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0) return false;
              const qt2Panel = el.closest('[id="wpDonDangKy"], [id="lstDonDangKy"]');
              if (qt2Panel) return false;
              return true;
            } catch (e) {
              return false;
            }
          });
          if (isUpdateBtnVisible) {
            topState.isWaitingForQT3Modal = false;
          } else if (now2 - topState.lastActionTime > 15e3) {
            topState.isWaitingForQT3Modal = false;
            writeLog("Mạng chậm, huỷ chờ bảng chi tiết để quét lại...");
          } else {
            updateStatus("Chờ tải bảng...", "waiting");
            return;
          }
        }
        const isInsideQT3 = Array.from(document.querySelectorAll("button, a")).some((el) => {
          if ((el.textContent || el.innerText || "").trim().toLowerCase() !== "xem sổ địa chính") return false;
          try {
            return el.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        }) || topState.qt3ModalContext === true && Array.from(document.querySelectorAll("button, a")).some((el) => {
          if ((el.textContent || el.innerText || "").trim().toLowerCase() !== "cập nhật") return false;
          try {
            if (el.getBoundingClientRect().width === 0) return false;
            if (el.closest("#wpDonDangKy, #lstDonDangKy")) return false;
            return true;
          } catch (e) {
            return false;
          }
        });
        const isInsideQT2 = function() {
          const qt2Heading = Array.from(document.querySelectorAll(".panel-heading, .modal-header")).find(
            (el) => (el.textContent || "").toLowerCase().includes("lưu kho hồ sơ")
          );
          if (qt2Heading) {
            try {
              if (qt2Heading.getBoundingClientRect().width > 0) return true;
            } catch (e) {
            }
          }
          const chkAll = document.querySelector("#chkSelectAll");
          if (chkAll) {
            try {
              if (chkAll.getBoundingClientRect().width > 0) return true;
            } catch (e) {
            }
          }
          const btnOpenFile = document.querySelector("#btnOpenFormChonFileHoSoQuet");
          if (btnOpenFile) {
            try {
              if (btnOpenFile.getBoundingClientRect().width > 0) return true;
            } catch (e) {
            }
          }
          const btnLuu = document.querySelector("#btnLuuHoSoQuet");
          if (btnLuu) {
            try {
              if (btnLuu.getBoundingClientRect().width > 0) return true;
            } catch (e) {
            }
          }
          return false;
        }();
        if (isInsideQT3) {
          const updateBtns = Array.from(document.querySelectorAll("button, a")).filter((el) => {
            const text = (el.textContent || el.innerText || "").trim().toLowerCase();
            return text === "cập nhật";
          });
          const visibleUpdateBtns = updateBtns.filter((el) => {
            try {
              return el.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          });
          if (visibleUpdateBtns.length > 0) {
            const updateBtn = visibleUpdateBtns[visibleUpdateBtns.length - 1];
            if (!updateBtn.hasAttribute("data-mplis-clicked")) {
              updateBtn.setAttribute("data-mplis-clicked", "true");
              setLastActionTime(now2, topState.config.delayAction);
              writeLog("Bấm 'Cập nhật' sổ địa chính...");
              clickElement(updateBtn);
              updateStatus("Chờ cập nhật...", "waiting");
              return;
            } else {
              const closeBtns = Array.from(document.querySelectorAll("button.close, .modal-header .close"));
              const visibleCloseBtns = closeBtns.filter((el) => {
                try {
                  return el.getBoundingClientRect().width > 0;
                } catch (e) {
                  return false;
                }
              });
              if (visibleCloseBtns.length > 0) {
                const closeBtn = visibleCloseBtns[visibleCloseBtns.length - 1];
                setLastActionTime(now2, topState.config.delayNext);
                writeLog("Cập nhật xong. Đóng bảng chi tiết (X)...");
                clickElement(closeBtn);
                incrementSuccess();
                topState.qt3ModalContext = false;
                updateStatus("Chờ lưu...", "waiting");
                updateBtn.removeAttribute("data-mplis-clicked");
                return;
              }
            }
          }
        }
        const viewBtns = Array.from(document.querySelectorAll("button, a")).filter((el) => {
          const text = (el.textContent || el.innerText || "").trim().toLowerCase();
          return text === "xem sổ địa chính";
        });
        const visibleViewBtns = viewBtns.filter((el) => {
          try {
            return el.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        });
        if (visibleViewBtns.length > 0) {
          const viewBtn = visibleViewBtns[visibleViewBtns.length - 1];
          const modal = viewBtn.closest(".modal, .modal-dialog, .k-window, .ui-dialog, .dx-popup-content") || document.body;
          const emptyCell = modal.querySelector(".dataTables_empty, td.dataTables_empty");
          if (emptyCell && emptyCell.textContent.trim().toLowerCase().includes("không có thửa đất")) {
            writeLog("⚠️ Không có thửa đất nào. DỪNG AUTO.");
            updateStatus("Không có thửa đất", "idle");
            if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC();
            return;
          }
          const rows = Array.from(modal.querySelectorAll("tbody tr")).filter((row) => {
            if (row.classList.contains("k-grouping-row") || row.classList.contains("k-detail-row") || row.querySelector("th")) return false;
            try {
              if (row.getBoundingClientRect().width === 0) return false;
            } catch (e) {
            }
            return row.innerText.trim().length > 0;
          });
          const selectedRow = rows.find((r) => r.getAttribute("data-mplis-selected") === "true" && r.getAttribute("data-mplis-processed") !== "true");
          if (selectedRow) {
            selectedRow.setAttribute("data-mplis-processed", "true");
            selectedRow.removeAttribute("data-mplis-selected");
            if (!topState.processedParcelIndexes) topState.processedParcelIndexes = /* @__PURE__ */ new Set();
            const idx = parseInt(selectedRow.getAttribute("data-mplis-index"));
            if (!isNaN(idx)) topState.processedParcelIndexes.add(idx);
            setLastActionTime(now2, topState.config.delayOpen);
            topState.isWaitingForQT3Modal = true;
            topState.qt3ModalContext = true;
            writeLog("Đã chọn thửa, bấm 'Xem sổ địa chính'...");
            clickElement(viewBtn);
            updateStatus("Chờ mở sổ...", "waiting");
            return;
          }
          let unprocessedRow = null;
          let rowIndex = -1;
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.getAttribute("data-mplis-processed") === "true") continue;
            if (topState.processedParcelIndexes && topState.processedParcelIndexes.has(i)) continue;
            const text = row.textContent.toLowerCase();
            if (text.includes("đã ký") || text.includes("hoàn thành")) continue;
            unprocessedRow = row;
            rowIndex = i;
            break;
          }
          if (unprocessedRow) {
            unprocessedRow.setAttribute("data-mplis-selected", "true");
            unprocessedRow.setAttribute("data-mplis-index", rowIndex.toString());
            const firstTd = unprocessedRow.querySelector("td");
            if (firstTd) clickElement(firstTd);
            clickElement(unprocessedRow);
            try {
              const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
              if (win.$) {
                const $row = win.$(unprocessedRow);
                $row.click();
                const $grid = $row.closest(".k-grid");
                if ($grid.length > 0 && $grid.data("kendoGrid")) {
                  $grid.data("kendoGrid").select(unprocessedRow);
                }
              }
            } catch (e) {
            }
            const input = unprocessedRow.querySelector('input[type="radio"], input[type="checkbox"]');
            if (input) {
              input.checked = true;
              try {
                input.dispatchEvent(new Event("change", { bubbles: true }));
              } catch (e) {
              }
              clickElement(input);
              if (input.id) {
                const lbl = document.querySelector(`label[for="${input.id}"]`);
                if (lbl) clickElement(lbl);
              }
            }
            setLastActionTime(now2, 800);
            writeLog("Đang click chọn dòng thửa đất...");
            updateStatus("Chọn thửa...", "waiting");
            return;
          } else if (rows.length > 0) {
            const btnCloseAll = Array.from(document.querySelectorAll("button, a")).filter((el) => {
              const text = (el.textContent || el.innerText || "").trim().toLowerCase();
              return text === "đóng";
            });
            const visibleCloseAll = btnCloseAll.filter((el) => {
              try {
                return el.getBoundingClientRect().width > 0;
              } catch (e) {
                return false;
              }
            });
            if (visibleCloseAll.length > 0) {
              const closeAll = visibleCloseAll[visibleCloseAll.length - 1];
              if (!closeAll.hasAttribute("data-mplis-clicked")) {
                closeAll.setAttribute("data-mplis-clicked", "true");
                setLastActionTime(now2, topState.config.delayNext);
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
        if (isInsideQT2) {
          if (!topState._qt2DebugLast || now2 - topState._qt2DebugLast > 5e3) {
            topState._qt2DebugLast = now2;
            const _chk = document.querySelector("#chkSelectAll");
            const _btnChon = document.querySelector("#btnChonFileHoSoQuet");
            const _btnOpen = document.querySelector("#btnOpenFormChonFileHoSoQuet");
            const _btnAdd = document.querySelector("#btnAddHoSoQuet");
            const _btnAddFile = document.querySelector("#btnAddFileHoSoQuet");
            const _donList = document.querySelectorAll("#lstDonDangKy ul.dondangky-item");
            const _selectedDon = document.querySelector("#lstDonDangKy ul.dondangky-item.selected, #lstDonDangKy ul.dondangky-item.active");
            const _w = (el) => {
              try {
                return el ? el.getBoundingClientRect().width : -1;
              } catch (e) {
                return -2;
              }
            };
            console.log(
              `%c[QT2 DEBUG] isInsideQT2=${isInsideQT2} | chkSelectAll: exists=${!!_chk}, w=${_w(_chk)}, checked=${_chk?.checked} | btnChonFile: exists=${!!_btnChon}, w=${_w(_btnChon)} | btnOpenForm: exists=${!!_btnOpen}, w=${_w(_btnOpen)} | btnAddHoSo: exists=${!!_btnAdd}, w=${_w(_btnAdd)} | btnAddFile: exists=${!!_btnAddFile}, w=${_w(_btnAddFile)} | donList: count=${_donList.length}, selectedDon=${_selectedDon ? _selectedDon.className : "null"} | qt2FileSelected=${topState.qt2FileSelected} | processedDonIndexes=${topState.processedDonIndexes ? JSON.stringify([...topState.processedDonIndexes]) : "null"}`,
              "color: #f59e0b; font-size: 11px;"
            );
          }
          const chkSelectAll = document.querySelector("#chkSelectAll");
          const btnChonFile = document.querySelector("#btnChonFileHoSoQuet");
          const isFilePopupOpen = chkSelectAll && (() => {
            try {
              return chkSelectAll.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          })();
          if (isFilePopupOpen) {
            const lanBamAll = parseInt(chkSelectAll.getAttribute("data-mplis-selectall") || "0", 10);
            const conDongChuaTich = Array.from(document.querySelectorAll('#tbDanhSachGiayToDinhKem tbody tr input[type="checkbox"]')).some((c) => !c.checked);
            if (topState.config.qt2SelectAllFiles && lanBamAll < 3 && (!chkSelectAll.checked || conDongChuaTich) && !chkSelectAll.hasAttribute("data-mplis-clicked")) {
              writeLog("Bấm 'Chọn tất cả' để tích hết bảng trước khi lọc (lần " + (lanBamAll + 1) + ")...");
              chkSelectAll.setAttribute("data-mplis-selectall", String(lanBamAll + 1));
              const jqAll = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
              if (jqAll) jqAll(chkSelectAll).click();
              else chkSelectAll.click();
              setLastActionTime(now2, 600);
              return;
            }
            if (!chkSelectAll.hasAttribute("data-mplis-clicked")) {
              writeLog("Đang chọn đúng file của đơn này (SPH/gt/pt)...");
              chkSelectAll.setAttribute("data-mplis-clicked", "true");
              const jq2 = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
              const totalDons = document.querySelectorAll("#lstDonDangKy ul.dondangky-item").length;
              if (topState.config.qt2SelectAllFiles) writeLog("Đã tích hết bảng, giữ nguyên toàn bộ file (giấy chứng nhận sẽ gán đúng theo Số phát hành ở bước sau)...");
              const fileRows = Array.from(document.querySelectorAll("#tbDanhSachGiayToDinhKem tbody tr"));
              for (const row of fileRows) {
                const cb = row.querySelector('input[type="checkbox"]');
                if (!cb) continue;
                const fileName = (row.textContent || "").toUpperCase();
                const isGtPt = /(GT|PT)\.PDF/.test(fileName) || /[\d+]-(GT|PT)(?![A-Z])/.test(fileName);
                const coTenFile = fileName.includes(".PDF") || isGtPt || /\d{3,}\+?-[A-ZĐ]{1,2}\s*\d{5,}/.test(fileName);
                if (!coTenFile && !topState.config.qt2SelectAllFiles) continue;
                let shouldKeep;
                if (totalDons <= 1 || topState.config.qt2SelectAllFiles) {
                  shouldKeep = true;
                } else {
                  if (isGtPt) {
                    shouldKeep = true;
                  } else {
                    shouldKeep = false;
                    const matchSPH = fileName.match(/[A-ZĐ]{1,2}\s*\d{5,}/);
                    if (matchSPH) {
                      const sphFile = matchSPH[0].replace(/\s+/g, "").toUpperCase();
                      shouldKeep = !!(topState.qt2SoPhatHanhList && topState.qt2SoPhatHanhList.includes(sphFile));
                    }
                  }
                }
                if (shouldKeep && !cb.checked) {
                  if (jq2) jq2(cb).click();
                  else cb.click();
                  writeLog("Chọn file: " + fileName);
                } else if (!shouldKeep && cb.checked) {
                  if (jq2) jq2(cb).click();
                  else cb.click();
                  writeLog("Bỏ chọn file không thuộc đơn này: " + fileName);
                }
              }
              setLastActionTime(now2, 1200);
              return;
            } else {
              let chonBtn = btnChonFile;
              if (!chonBtn || (() => {
                try {
                  return chonBtn.getBoundingClientRect().width === 0;
                } catch (e) {
                  return true;
                }
              })()) {
                chonBtn = Array.from(document.querySelectorAll('button, a, input[type="button"]')).find((el) => {
                  const text = (el.textContent || el.innerText || el.value || "").trim().toLowerCase();
                  if (text !== "chọn" && text !== "chọn tập tin") return false;
                  try {
                    return el.getBoundingClientRect().width > 0;
                  } catch (e) {
                    return false;
                  }
                });
              }
              if (chonBtn) {
                writeLog("Bấm 'Chọn tập tin'...");
                clickElement(chonBtn);
                setLastActionTime(now2, topState.config.delayOpen);
                topState.qt2Phase = 1;
                chkSelectAll.removeAttribute("data-mplis-clicked");
                chkSelectAll.removeAttribute("data-mplis-selectall");
                return;
              } else {
                writeLog("Chờ nút 'Chọn tập tin' hiện ra...");
                updateStatus("Đợi nút Chọn", "waiting");
                return;
              }
            }
          }
          const btnOpenFormChonFile = document.querySelector("#btnOpenFormChonFileHoSoQuet");
          const btnLuuHoSoQuetCheck = document.querySelector("#btnLuuHoSoQuet");
          const isFormThemMoMở = btnOpenFormChonFile && (() => {
            try {
              return btnOpenFormChonFile.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          })() || btnLuuHoSoQuetCheck && (() => {
            try {
              return btnLuuHoSoQuetCheck.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          })();
          if (isFormThemMoMở) {
            if (!topState.qt2Phase || topState.qt2Phase === 0) {
              if (!btnOpenFormChonFile.hasAttribute("data-mplis-clicked")) {
                writeLog("Bấm 'Chọn tập tin' để mở bảng chọn...");
                btnOpenFormChonFile.setAttribute("data-mplis-clicked", "true");
                clickElement(btnOpenFormChonFile);
                topState.qt2Phase = 0;
                setLastActionTime(now2, topState.config.delayOpen);
                return;
              }
            } else if (topState.qt2Phase === 1) {
              const rows = Array.from(document.querySelectorAll("#tbDanhSachFile tbody tr"));
              if (rows.length === 0 || rows.some((tr) => tr.textContent.includes("Không có dữ liệu") || tr.textContent.includes("đang tải"))) {
                updateStatus("Đợi file tải lên...", "waiting");
                return;
              }
              const khoaDong = (tr) => (tr.textContent || "").replace(/\s+/g, " ").trim();
              let targetRow = rows.find((tr) => {
                const t = tr.textContent.toUpperCase();
                const isGtPt = /(?:GT|PT)\.PDF/.test(t) || /[\d+]-(?:GT|PT)(?![A-Z])/.test(t);
                const coTenFile = t.includes(".PDF") || /\d{3,}\+?-[A-ZĐ]{1,2}\s*\d{5,}/.test(t);
                if (topState.qt2BoQua && topState.qt2BoQua.has(khoaDong(tr))) return false;
                return coTenFile && t.includes("GIẤY TỜ HỒ SƠ") && !isGtPt;
              });
              if (targetRow) {
                const editBtn = targetRow.querySelector("#btnEditHoSoQuet");
                if (editBtn && !editBtn.hasAttribute("data-mplis-clicked")) {
                  topState.qt2SphIndex = topState.qt2SphIndex || 0;
                  const dsSph = topState.qt2SoPhatHanhList || [];
                  const sphTuTen = docSphTuTen(targetRow.textContent);
                  let assignedSph = null;
                  if (topState.config.qt2SelectAllFiles && dsSph.length === 0) {
                    dungQT2("Không đọc được số phát hành", 'Đơn này không đọc được số phát hành của giấy chứng nhận nên không biết file nào thuộc giấy nào. Tắt "chọn hết file" hoặc xử lý tay.');
                    return;
                  }
                  const gan_theo_ten = dsSph.length >= 2 || topState.config.qt2SelectAllFiles && dsSph.length === 1;
                  if (gan_theo_ten) {
                    if (sphTuTen && dsSph.includes(sphTuTen)) {
                      if ((topState.qt2DaGan || []).includes(sphTuTen)) {
                        dungQT2("Hai file cùng số phát hành", "Có từ 2 file cùng mang số phát hành " + sphTuTen + ", không biết file nào đúng. Xử lý tay.");
                        return;
                      }
                      assignedSph = sphTuTen;
                    } else {
                      if (!topState.qt2BoQua) topState.qt2BoQua = /* @__PURE__ */ new Set();
                      topState.qt2BoQua.add(khoaDong(targetRow));
                      writeLog("Bỏ qua file không khớp giấy chứng nhận nào (" + (sphTuTen || "không đọc được số phát hành") + "): " + khoaDong(targetRow).slice(0, 120));
                      setLastActionTime(now2, 200);
                      return;
                    }
                  } else {
                    if (topState.qt2SphIndex < dsSph.length) assignedSph = dsSph[topState.qt2SphIndex];
                    if (assignedSph && sphTuTen && sphTuTen !== assignedSph) {
                      writeLog("⚠️ Tên file mang số " + sphTuTen + " nhưng đơn chỉ có giấy " + assignedSph + "; vẫn gán " + assignedSph + ".");
                    }
                  }
                  writeLog(`Bấm 'Chỉnh sửa' file đính kèm${assignedSph ? " (Gán: " + assignedSph + ")" : ""}...`);
                  editBtn.setAttribute("data-mplis-clicked", "true");
                  clickElement(editBtn);
                  const oldBtnLuu = document.querySelector("#btnLuuHoSoQuet");
                  if (oldBtnLuu) oldBtnLuu.removeAttribute("data-mplis-clicked");
                  topState.qt2Phase = 2;
                  topState.qt2EditingSph = assignedSph;
                  topState._qt2P2Start = now2;
                  setLastActionTime(now2, 500);
                  return;
                }
              } else {
                const dsCan = topState.qt2SoPhatHanhList || [];
                if (dsCan.length >= 2 || topState.config.qt2SelectAllFiles && dsCan.length === 1) {
                  const chuaCo = dsCan.filter((x) => !(topState.qt2DaGan || []).includes(x));
                  if (chuaCo.length) {
                    dungQT2("Thiếu file giấy chứng nhận", "Giấy chứng nhận " + chuaCo.join(", ") + " không có file nào khớp số phát hành trong bảng. Kiểm tra tên file rồi chạy lại.");
                    return;
                  }
                }
                topState.qt2Phase = 3;
                return;
              }
            } else if (topState.qt2Phase === 2) {
              const jq2 = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
              const selects = Array.from(document.querySelectorAll('select[name="loaiHoSoQuet"]')).filter((el) => {
                try {
                  return el.getBoundingClientRect().width > 0;
                } catch (e) {
                  return false;
                }
              });
              if (selects.length > 0) {
                const selLoaiGiayTo = selects[selects.length - 1];
                if (selLoaiGiayTo.value !== "1") {
                  selLoaiGiayTo.value = "1";
                  if (jq2) jq2(selLoaiGiayTo).val("1").trigger("change");
                  selLoaiGiayTo.dispatchEvent(new Event("change", { bubbles: true }));
                  writeLog("Đã đổi Loại giấy tờ thành 'Giấy chứng nhận'");
                  setLastActionTime(now2, 500);
                  return;
                }
              }
              if (topState.qt2EditingSph) {
                const selMoTaList = Array.from(document.querySelectorAll('select[name="giayChungNhanId"]')).filter((el) => {
                  try {
                    return el.getBoundingClientRect().width > 0;
                  } catch (e) {
                    return false;
                  }
                });
                let daChonDung = false;
                if (selMoTaList.length > 0) {
                  const selMoTa = selMoTaList[selMoTaList.length - 1];
                  const options = Array.from(selMoTa.options);
                  const targetOpt = options.find((opt) => opt.textContent.replace(/\s+/g, "").toUpperCase().includes(topState.qt2EditingSph));
                  if (targetOpt) {
                    if (selMoTa.value !== targetOpt.value) {
                      selMoTa.value = targetOpt.value;
                      if (jq2) jq2(selMoTa).val(targetOpt.value).trigger("change");
                      selMoTa.dispatchEvent(new Event("change", { bubbles: true }));
                      writeLog(`Đã gán Giấy chứng nhận: ${topState.qt2EditingSph}`);
                      setLastActionTime(now2, 200);
                      return;
                    }
                    daChonDung = true;
                  }
                }
                if (!daChonDung && (topState.qt2SoPhatHanhList || []).length >= 2) {
                  if (now2 - (topState._qt2P2Start || now2) > 8e3) {
                    dungQT2("Không chọn được giấy chứng nhận", "Không thấy giấy " + topState.qt2EditingSph + " trong danh sách giấy chứng nhận của hồ sơ.");
                  } else {
                    updateStatus("Đợi ô chọn giấy chứng nhận...", "waiting");
                  }
                  return;
                }
              }
              const btnLuuSub = document.querySelector("#btnLuuHoSoQuet");
              if (btnLuuSub && !btnLuuSub.hasAttribute("data-mplis-clicked")) {
                writeLog("Bấm 'Lưu' chi tiết file...");
                btnLuuSub.setAttribute("data-mplis-clicked", "true");
                clickElement(btnLuuSub);
                if (topState.qt2EditingSph) {
                  topState.qt2SphIndex = (topState.qt2SphIndex || 0) + 1;
                  if (!topState.qt2DaGan) topState.qt2DaGan = [];
                  if (!topState.qt2DaGan.includes(topState.qt2EditingSph)) topState.qt2DaGan.push(topState.qt2EditingSph);
                }
                topState.qt2Phase = 1;
                setLastActionTime(now2, topState.config.delayAction);
                return;
              } else {
                updateStatus("Đợi nút Lưu file...", "waiting");
                return;
              }
            } else if (topState.qt2Phase === 3) {
              const updateBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')).filter((el) => {
                if (el.id === "btnLuuHoSoQuet") return false;
                const text = (el.textContent || el.innerText || el.value || "").trim().toLowerCase();
                return text === "cập nhật" || text === "lưu";
              }).filter((el) => {
                try {
                  return el.getBoundingClientRect().width > 0;
                } catch (e) {
                  return false;
                }
              });
              if (updateBtns.length > 0) {
                const updateBtn = updateBtns[updateBtns.length - 1];
                if (!updateBtn.hasAttribute("data-mplis-clicked")) {
                  writeLog("Bấm 'Cập nhật' lưu kho...");
                  updateBtn.setAttribute("data-mplis-clicked", "true");
                  clickElement(updateBtn);
                  topState.qt2Phase = 0;
                  if (topState.currentDonIndex !== void 0) {
                    if (!topState.processedDonIndexes) topState.processedDonIndexes = /* @__PURE__ */ new Set();
                    topState.processedDonIndexes.add(topState.currentDonIndex);
                  }
                  setLastActionTime(now2, topState.config.delayAction);
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
          const donDangKyList = Array.from(document.querySelectorAll("#lstDonDangKy ul.dondangky-item"));
          let unprocessedDon = null;
          let donIndex = -1;
          for (let i = 0; i < donDangKyList.length; i++) {
            const don = donDangKyList[i];
            if (don.getAttribute("data-mplis-processed") === "true") continue;
            if (topState.processedDonIndexes && topState.processedDonIndexes.has(i)) continue;
            const text = don.textContent.toLowerCase();
            if (text.includes("đã xử lý") || text.includes("hoàn thành")) continue;
            unprocessedDon = don;
            donIndex = i;
            break;
          }
          if (unprocessedDon) {
            const isSelected = unprocessedDon.classList.contains("active") || unprocessedDon.classList.contains("selected") || unprocessedDon.getAttribute("data-mplis-selected") === "true";
            if (!isSelected) {
              writeLog("Đang chọn đơn đăng ký thứ " + (donIndex + 1) + "...");
              unprocessedDon.setAttribute("data-mplis-selected", "true");
              unprocessedDon.setAttribute("data-mplis-index", donIndex.toString());
              document.querySelectorAll('*[data-mplis-clicked="true"]').forEach((el) => el.removeAttribute("data-mplis-clicked"));
              const titleLi = unprocessedDon.querySelector("li.title, li.list-group-item.title, li:first-child");
              if (titleLi) {
                clickElement(titleLi);
              } else {
                clickElement(unprocessedDon);
              }
              try {
                const jq2 = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
                if (jq2) {
                  jq2(unprocessedDon).click();
                  jq2(unprocessedDon).trigger("click");
                }
              } catch (e) {
              }
              setLastActionTime(now2, 1500);
              return;
            } else {
              const btnAdd = document.querySelector("#btnAddHoSoQuet") || document.querySelector("#btnAddFileHoSoQuet");
              const isBtnAddVisible = btnAdd && (() => {
                try {
                  return btnAdd.getBoundingClientRect().width > 0;
                } catch (e) {
                  return false;
                }
              })();
              if (isBtnAddVisible) {
                if (!btnAdd.hasAttribute("data-mplis-clicked")) {
                  writeLog("Bấm 'Thêm mới' hồ sơ quét...");
                  btnAdd.setAttribute("data-mplis-clicked", "true");
                  topState.currentDonIndex = donIndex;
                  topState.qt2Phase = 0;
                  topState.qt2SphIndex = 0;
                  topState.qt2DaGan = [];
                  topState.qt2BoQua = /* @__PURE__ */ new Set();
                  topState.qt2SoPhatHanhList = [];
                  const activeTreeContainer = Array.from(document.querySelectorAll("#treeThongTinDangKy, #treeGiayChungNhan")).find((el) => {
                    try {
                      return el.getBoundingClientRect().width > 0;
                    } catch (e) {
                      return false;
                    }
                  });
                  if (activeTreeContainer) {
                    const treeNodes = activeTreeContainer.querySelectorAll("a");
                    for (const node of treeNodes) {
                      const match = (node.textContent || "").match(/Số phát hành:\s*([A-Za-z0-9\s]+)\s*-/i);
                      if (match) {
                        const sph = match[1].trim().replace(/\s+/g, "").toUpperCase();
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
                  setLastActionTime(now2, topState.config.delayOpen);
                  return;
                } else {
                  updateStatus("Chờ mở form...", "waiting");
                  return;
                }
              } else {
                updateStatus("Đợi nút Thêm mới tải...", "waiting");
                return;
              }
            }
          } else if (donDangKyList.length > 0) {
            const qt2Headers = Array.from(document.querySelectorAll(".panel-heading")).filter((el) => el.textContent.toLowerCase().includes("lưu kho hồ sơ"));
            let btnCloseAll = [];
            if (qt2Headers.length > 0) {
              btnCloseAll = Array.from(qt2Headers[qt2Headers.length - 1].querySelectorAll('.close, button[data-dismiss="modal"]'));
            } else {
              const lstDonDangKy = document.querySelector("#lstDonDangKy");
              const qt2Container = lstDonDangKy ? lstDonDangKy.closest(".modal, .panel, .k-window, .dx-popup-content") || document.body : document.body;
              btnCloseAll = Array.from(qt2Container.querySelectorAll('.modal-header .close, .panel-heading .close, button[data-dismiss="modal"]'));
            }
            btnCloseAll = btnCloseAll.filter((el) => {
              try {
                return el.getBoundingClientRect().width > 0;
              } catch (e) {
                return false;
              }
            });
            if (btnCloseAll.length > 0) {
              const closeAll = btnCloseAll[btnCloseAll.length - 1];
              if (!closeAll.hasAttribute("data-mplis-clicked")) {
                closeAll.setAttribute("data-mplis-clicked", "true");
                setLastActionTime(now2, topState.config.delayNext);
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
            return;
          }
        }
        const execBtns = querySelectorAllCustom(topState.config.selectorExecute);
        const visibleExecBtns = execBtns.filter((el) => {
          try {
            return el.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        });
        if (visibleExecBtns.length > 0) {
          const isInsideFwd = visibleExecBtns[0].closest("#frmChuyenTiepHoSo_tbUsers, .modal-chuyentiep");
          if (!isInsideFwd) {
            const execBtn = visibleExecBtns[0];
            if (execBtn.hasAttribute("data-mplis-clicked")) return;
            setLastActionTime(now2, topState.config.delayAction);
            writeLog("Tìm thấy nút 'Thực hiện'. Đang click...");
            if (topState.currentTaskCode === "QT4") topState.expectQT4Confirm = true;
            else if (topState.currentTaskCode && topState.currentTaskCode !== "QT1") topState.expectQT5Confirm = true;
            execBtn.setAttribute("data-mplis-clicked", "true");
            setTimeout(() => {
              try {
                execBtn.removeAttribute("data-mplis-clicked");
              } catch (e) {
              }
            }, 5e3);
            try {
              execBtn.classList.add("mplis-highlight-target");
              setTimeout(() => {
                try {
                  execBtn.classList.remove("mplis-highlight-target");
                } catch (e) {
                }
              }, 1200);
              execBtn.click();
            } catch (e) {
            }
            updateStatus("Chờ xác nhận...", "waiting");
            return;
          }
        }
        const isAnyFormOpen = isInsideQT3 || isInsideQT2 || visibleExecBtns.length > 0 || visibleConfirmBtns.length > 0;
        if (!isAnyFormOpen) {
          const targetRowData = findTaskProcessButton(topState.config.activeWorkflows);
          if (targetRowData) {
            if (targetRowData.isDone) {
              if (topState.config.isQT5 && topState.config.forwardUser) {
                const btnChuyenTiep = Array.from(document.querySelectorAll("button.btnWorkflowCommand")).find((b) => {
                  const cn = (b.getAttribute("commandname") || "").toLowerCase();
                  return cn === "chuyển tiếp";
                });
                const isBtnFwdVisible = btnChuyenTiep && (() => {
                  try {
                    return btnChuyenTiep.getBoundingClientRect().width > 0;
                  } catch (e) {
                    return false;
                  }
                })();
                if (isBtnFwdVisible && !btnChuyenTiep.hasAttribute("data-mplis-clicked")) {
                  writeLog("Các QT đã xong, đang bấm nút 'Chuyển tiếp'...");
                  btnChuyenTiep.setAttribute("data-mplis-clicked", "true");
                  clickElement(btnChuyenTiep);
                  setLastActionTime(now2, topState.config.delayOpen);
                  return;
                } else if (fwdTable && (() => {
                  try {
                    return fwdTable.getBoundingClientRect().width > 0;
                  } catch (e) {
                    return false;
                  }
                })()) {
                } else if (btnChuyenTiep && btnChuyenTiep.hasAttribute("data-mplis-clicked")) {
                  const choQT5 = now2 - (topState._qt5ClickAt || now2);
                  if (!topState._qt5Done && choQT5 < 2e4) {
                    updateStatus("Đợi server xác nhận chuyển tiếp...", "waiting");
                    return;
                  }
                  if (!topState._qt5Done) writeLog("⚠️ Không thấy phản hồi chuyển tiếp từ server sau 20s, kết thúc theo cách dự phòng - kiểm tra lại hồ sơ.");
                  writeLog("Hoàn tất chuyển tiếp và các quy trình. DỪNG AUTO.");
                  if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("🎉 ĐÃ CHUYỂN TIẾP VÀ HOÀN THÀNH!");
                  return;
                }
              } else {
                writeLog("Tất cả quy trình yêu cầu đã hoàn thành. DỪNG AUTO.");
                if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("🎉 ĐÃ HOÀN THÀNH TẤT CẢ QUY TRÌNH!");
                return;
              }
            }
            if (targetRowData.button) {
              try {
                const rect = targetRowData.button.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  setLastActionTime(now2, topState.config.delayOpen);
                  if (targetRowData.taskName.toLowerCase().includes("địa chính")) {
                    topState.processedParcelIndexes = /* @__PURE__ */ new Set();
                  }
                  if (targetRowData.taskName.toLowerCase().includes("lưu kho") || targetRowData.taskName.toLowerCase().includes("hồ sơ quét")) {
                    topState.processedDonIndexes = /* @__PURE__ */ new Set();
                    topState.qt2FileSelected = false;
                  }
                  topState.currentTaskCode = targetRowData.taskCode || "";
                  writeLog(`Bấm 'Xử lý tác vụ' cho: ${targetRowData.taskName}...`);
                  const tr = targetRowData.button.closest("tr");
                  if (tr) tr.setAttribute("data-mplis-processed", "true");
                  clickElement(targetRowData.button);
                  updateStatus("Chờ mở bảng...", "waiting");
                  return;
                }
              } catch (e) {
              }
            }
          }
        }
        const isTaskModalOpen = querySelectorAllCustom("a:contains('Xử lý tác vụ'), button:contains('Xử lý tác vụ')").length > 0;
        if (!isTaskModalOpen) {
          const mainProcessBtns = querySelectorAllCustom(topState.config.selectorMainProcess);
          const visibleMainBtns = mainProcessBtns.filter((el) => {
            try {
              return el.getBoundingClientRect().width > 0;
            } catch (e) {
              return false;
            }
          });
          if (visibleMainBtns.length > 0) {
            const mainBtn = visibleMainBtns[0];
            setLastActionTime(now2, topState.config.delayOpen);
            topState.processedParcelIndexes = /* @__PURE__ */ new Set();
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
    (function() {
      const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
      if (win.HTMLInputElement.prototype.__mplisUpload) return;
      const orig = win.HTMLInputElement.prototype.click;
      win.HTMLInputElement.prototype.click = function() {
        if (this.type === "file") {
          const ts = getTopState();
          if (ts && ts._pendingUploadFile) {
            const f = ts._pendingUploadFile;
            ts._pendingUploadFile = null;
            try {
              const dt = new DataTransfer();
              dt.items.add(f);
              this.files = dt.files;
              this.dispatchEvent(new Event("change", { bubbles: true }));
              this.dispatchEvent(new Event("input", { bubbles: true }));
            } catch (e) {
              console.error("[MPLIS Upload]", e);
            }
            return;
          }
        }
        return orig.apply(this, arguments);
      };
      win.HTMLInputElement.prototype.__mplisUpload = true;
    })();
    setFastInterval(scanAndExecute, 400);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scanAndExecute();
    });
    return {
      getTopState,
      saveConfig
    };
  }();

  // src/mplis-logger.js
  var MAX = 400;
  var _buf = [];
  var LOG_ENABLED_KEY = "mplis_log_enabled";
  function now() {
    return Date.now();
  }
  function isLogEnabled() {
    try {
      return localStorage.getItem(LOG_ENABLED_KEY) !== "false";
    } catch {
      return true;
    }
  }
  function setLogEnabled(on) {
    try {
      localStorage.setItem(LOG_ENABLED_KEY, on ? "true" : "false");
    } catch {
    }
  }
  function push(entry) {
    if (isLogEnabled()) {
      _buf.push(entry);
      if (_buf.length > MAX) _buf.shift();
    }
    window.dispatchEvent(new CustomEvent("mplis:api", { detail: entry }));
  }
  function epTag(url) {
    try {
      const path = new URL(url).pathname;
      const parts = path.split("/").filter(Boolean);
      return parts.slice(-2).join("/").slice(0, 70);
    } catch {
      return String(url).slice(-70);
    }
  }
  function clearLog() {
    _buf.length = 0;
  }
  function getLogCount() {
    return _buf.length;
  }
  function getLogJson() {
    return JSON.stringify(_buf, null, 2);
  }
  function installFetchLogger() {
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (!win.fetch || win.fetch.__mplisLogged) return;
    const orig = win.fetch;
    win.fetch = async function mplisLoggedFetch(input, init) {
      const url = typeof input === "string" ? input : input?.url ?? "";
      const method = (init?.method || "GET").toUpperCase();
      const entry = { t: now(), type: "fetch", ep: epTag(url), method };
      const body = init?.body;
      if (body && typeof body.entries === "function") {
        const keys = [];
        try {
          for (const [k] of body.entries()) keys.push(k);
        } catch {
        }
        entry.reqKeys = keys;
      } else if (typeof body === "string") {
        entry.req = body.slice(0, 2e3);
      }
      let res;
      try {
        res = await orig.call(this, input, init);
      } catch (err) {
        entry.err = String(err);
        push(entry);
        throw err;
      }
      entry.status = res.status;
      try {
        const txt = await res.clone().text();
        try {
          entry.res = JSON.parse(txt);
        } catch {
          entry.res = txt.slice(0, 3e3);
        }
      } catch {
      }
      push(entry);
      return res;
    };
    win.fetch.__mplisLogged = true;
  }
  function installErrorLogger() {
    window.addEventListener("error", (e) => {
      push({
        t: now(),
        type: "jsError",
        msg: e.message,
        at: `${(e.filename || "").split("/").pop()}:${e.lineno}`
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      push({ t: now(), type: "rejection", msg: String(e.reason) });
    });
  }
  function gmxhr(opts) {
    const entry = { t: now(), type: "gmxhr", ep: epTag(opts.url || ""), method: (opts.method || "GET").toUpperCase() };
    if (opts.data) {
      try {
        entry.req = JSON.parse(opts.data);
      } catch {
        entry.req = String(opts.data).slice(0, 300);
      }
    }
    const origOnload = opts.onload;
    const origOnerror = opts.onerror;
    GM_xmlhttpRequest({
      ...opts,
      onload(res) {
        entry.status = res.status;
        try {
          entry.res = JSON.parse(res.responseText);
        } catch {
          entry.res = (res.responseText || "").slice(0, 500);
        }
        push(entry);
        if (origOnload) origOnload(res);
      },
      onerror(err) {
        entry.err = String(err);
        push(entry);
        if (origOnerror) origOnerror(err);
      }
    });
  }
  function installXhrLogger() {
    if (XMLHttpRequest.prototype.__mplisLogged) return;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._mplisMethod = String(method || "GET").toUpperCase();
      this._mplisUrl = String(url || "");
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const entry = { t: now(), type: "xhr", ep: epTag(this._mplisUrl || ""), method: this._mplisMethod || "GET" };
      if (body && typeof body === "string") {
        entry.req = body.slice(0, 2e3);
        try {
          const top = window.top;
          top.__mplisLastReq = top.__mplisLastReq || {};
          top.__mplisLastReq[entry.ep] = body;
        } catch (e) {
        }
      }
      entry.url = String(this._mplisUrl || "").slice(0, 300);
      this.addEventListener("load", function() {
        entry.status = this.status;
        if (this.responseType === "" || this.responseType === "text") {
          try {
            entry.res = JSON.parse(this.responseText);
          } catch {
            entry.res = (this.responseText || "").slice(0, 3e3);
          }
        } else {
          entry.res = "(" + this.responseType + " " + (this.getResponseHeader("content-type") || "") + ")";
        }
        push(entry);
      });
      this.addEventListener("error", function() {
        entry.err = "network error";
        push(entry);
      });
      return origSend.apply(this, arguments);
    };
    XMLHttpRequest.prototype.__mplisLogged = true;
  }
  function installOpenLogger() {
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (!win.open || win.open.__mplisLogged) return;
    const orig = win.open;
    win.open = function(url) {
      push({ t: now(), type: "windowOpen", url: String(url || "").slice(0, 300) });
      return orig.apply(this, arguments);
    };
    win.open.__mplisLogged = true;
  }
  function installResourceLogger() {
    if (typeof PerformanceObserver === "undefined") return;
    const SKIP = /^(script|link|css|img|image|font|beacon|xmlhttprequest|fetch)$/;
    try {
      new PerformanceObserver((list) => {
        for (const r of list.getEntries()) {
          if (SKIP.test(r.initiatorType || "")) continue;
          if (/\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico)(\?|$)/i.test(r.name)) continue;
          push({ t: now(), type: "resource", via: r.initiatorType, url: String(r.name).slice(0, 400) });
        }
      }).observe({ type: "resource", buffered: false });
    } catch {
    }
  }
  installErrorLogger();
  installFetchLogger();
  installXhrLogger();
  installOpenLogger();
  installResourceLogger();

  // src/excel-module.js
  var ExcelModule = function() {
    const BIEN_DONG_CODE_MAP = {
      "CD": "CẤP ĐỔI",
      "TK": "THỪA KẾ",
      "SN": "ĐÍNH CHÍNH",
      "TN": "TÁCH/HỢP THỬA",
      "CN": "CHUYỂN NHƯỢNG",
      "TA": "CHUYỂN NHƯỢNG",
      "TQ": "CHUYỂN NHƯỢNG"
    };
    const MY_COMMUNES = [
      { key: "krongnang", label: "Krông Năng", match: "KRÔNG NĂNG" },
      { key: "phuxuan", label: "Phú Xuân", match: "PHÚ XUÂN" },
      { key: "tamgiang", label: "Tam Giang", match: "TAM GIANG" },
      { key: "dlieya", label: "Dliê Ya", match: "DLIÊ YA" }
    ];
    const BUCKETS = [
      { key: "all", label: "Tất cả", rich: false },
      ...MY_COMMUNES.map((c) => ({ key: c.key, label: c.label, rich: true })),
      { key: "thechap", label: "Thế chấp", rich: false },
      { key: "xacnhan", label: "Xác nhận", rich: false },
      { key: "khac", label: "Khác", rich: true }
    ];
    let state = {
      records: [],
      currentBucket: "all"
    };
    const SHEET_URL_KEY = "mplis_excel_sheet_url_mine";
    const PUSHABLE_BUCKETS = MY_COMMUNES.map((c) => c.key).concat(["khac", "thechap", "xacnhan"]);
    function deriveNgayFromMaHS(maHS) {
      if (!maHS) return "";
      const m = maHS.match(/^(\d{1,2})-/);
      if (!m) return "";
      const day = parseInt(m[1], 10);
      if (!day || day < 1 || day > 31) return "";
      const now2 = /* @__PURE__ */ new Date();
      const dd = String(day).padStart(2, "0");
      const mm = String(now2.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${now2.getFullYear()}`;
    }
    function getBucket(r) {
      if (r.loaiHS === "TC" || r.loaiHS === "XTC") return "thechap";
      if (r.loaiHS === "XN") return "xacnhan";
      const dc = (r.diaChi || "").toUpperCase();
      const commune = MY_COMMUNES.find((c) => dc === c.match);
      return commune ? commune.key : "khac";
    }
    const LOAI_GIAY_KEY2 = "mplis_tenfile_loai_giay";
    function getLoaiGiay(maHS, gcn) {
      if (!maHS || !gcn) return "";
      try {
        const stored = JSON.parse(localStorage.getItem(LOAI_GIAY_KEY2) || "{}");
        const cuaHoSo = stored[maHS] || {};
        return cuaHoSo[gcn.replace(/\s+/g, "").toUpperCase()] || "";
      } catch (e) {
        return "";
      }
    }
    function getBienDongCode(maHS) {
      if (!maHS) return "";
      try {
        const stored = JSON.parse(localStorage.getItem("mplis_bien_dong_codes") || "{}");
        return stored[maHS] || "";
      } catch (e) {
        return "";
      }
    }
    function getSheetUrl() {
      try {
        return (localStorage.getItem(SHEET_URL_KEY) || "").trim();
      } catch (e) {
        return "";
      }
    }
    function setSheetStatus(text, ok) {
      const el = document.getElementById("excel-sheet-status");
      if (!el) return;
      el.textContent = text;
      el.style.color = ok ? "#22c55e" : "#f43f5e";
    }
    const _dangGui = /* @__PURE__ */ new Set();
    function pushRecordToSheet(r) {
      const bucket = getBucket(r);
      if (!PUSHABLE_BUCKETS.includes(bucket)) {
        console.log('[Excel] Bỏ qua đẩy - bucket "' + bucket + '" không nằm trong danh sách đồng bộ:', r.maHS);
        return;
      }
      const url = getSheetUrl();
      if (!url) {
        console.log("[Excel] Bỏ qua đẩy - chưa cấu hình link Sheet (ô 🔗 ở tab Excel):", r.maHS);
        setSheetStatus("❌ chưa cấu hình link Sheet", false);
        return;
      }
      if (typeof GM_xmlhttpRequest === "undefined") {
        console.log("[Excel] Bỏ qua đẩy - GM_xmlhttpRequest không khả dụng (kiểm tra @grant trong userscript header):", r.maHS);
        setSheetStatus("❌ GM_xmlhttpRequest không khả dụng", false);
        return;
      }
      console.log("[Excel] Đang đẩy lên Sheet:", bucket, r.maHS, r.gcn, r.thua);
      const isTheChapSheet = bucket === "thechap" || bucket === "xacnhan";
      const payload = isTheChapSheet ? {
        bucket: "thechap",
        loaiHS: r.loaiHS || "",
        maHS: r.maHS || "",
        hoTen: r.nguoiNop || "",
        diaChi: r.diaChi || "",
        gcn: r.gcn || "",
        thua: r.thua || "",
        to: r.to || "",
        dienTich: r.dt || "",
        datO: r.dtO || "",
        cln: r.dtCLN || "",
        tsn: r.dtTSN || "",
        lua: r.dtLUA || "",
        hnk: r.dtHNK || "",
        skc: r.dtSKC || "",
        ngay: deriveNgayFromMaHS(r.maHS),
        gioHenTra: ""
      } : {
        bucket,
        tenTTHC: r.tenTTHCFull || "",
        maHS: r.maHS || "",
        hoTen: r.nguoiNop || "",
        xa: r.diaChi || "",
        gcn: r.gcn || "",
        thua: r.thua || "",
        to: r.to || "",
        dienTich: r.dt || "",
        datO: r.dtO || "",
        cln: r.dtCLN || "",
        lua: r.dtLUA || "",
        nts: r.dtTSN || "",
        hnk: r.dtHNK || ""
      };
      if (_dangGui.has(r)) return;
      _dangGui.add(r);
      gmxhr({
        method: "POST",
        url,
        data: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        onload: function(res) {
          _dangGui.delete(r);
          console.log("[Excel] Phản hồi từ Sheet:", res.status, res.responseText);
          try {
            const body = JSON.parse(res.responseText);
            if (body.ok) {
              r.daDay = true;
              saveState();
              setSheetStatus("✅ đã đồng bộ", true);
            } else setSheetStatus("❌ " + (body.error || "lỗi"), false);
          } catch (e) {
            console.log("[Excel] Không parse được phản hồi JSON:", e);
            setSheetStatus("❌ phản hồi lạ", false);
          }
        },
        timeout: 2e4,
        ontimeout: function() {
          _dangGui.delete(r);
          setSheetStatus("❌ hết giờ chờ (20s), sẽ thử lại", false);
        },
        onerror: function(err) {
          _dangGui.delete(r);
          console.log("[Excel] Lỗi kết nối khi đẩy lên Sheet:", err);
          setSheetStatus("❌ lỗi kết nối", false);
        }
      });
    }
    function guiLaiChuaDay() {
      if (!getSheetUrl()) return;
      const cho = state.records.filter((r) => r.daDay === false && (r.soLanThu || 0) < 5 && !_dangGui.has(r)).slice(0, 3);
      if (!cho.length) return;
      cho.forEach((r) => {
        r.soLanThu = (r.soLanThu || 0) + 1;
        pushRecordToSheet(r);
      });
      saveState();
    }
    function init() {
      loadState();
      renderFilterTabs();
      renderTable();
      const sheetUrlInput = document.getElementById("cfg-excel-sheet-url");
      if (sheetUrlInput) {
        sheetUrlInput.value = getSheetUrl();
        sheetUrlInput.oninput = () => {
          try {
            localStorage.setItem(SHEET_URL_KEY, sheetUrlInput.value.trim());
          } catch (e) {
          }
        };
      }
      const btnToggleSheetCfg = document.getElementById("btn-toggle-sheet-cfg");
      const sheetCfgRow = document.getElementById("excel-sheet-cfg-row");
      if (btnToggleSheetCfg && sheetCfgRow) {
        btnToggleSheetCfg.onclick = () => {
          sheetCfgRow.style.display = sheetCfgRow.style.display === "none" ? "flex" : "none";
        };
      }
      const btnTestSheetLink = document.getElementById("btn-test-sheet-link");
      if (btnTestSheetLink) {
        btnTestSheetLink.onclick = () => {
          const url = getSheetUrl();
          if (!url) {
            setSheetStatus("❌ chưa cấu hình link", false);
            return;
          }
          if (typeof GM_xmlhttpRequest === "undefined") {
            setSheetStatus("❌ GM_xmlhttpRequest không khả dụng", false);
            return;
          }
          setSheetStatus("⏳ đang kiểm tra...", true);
          btnTestSheetLink.disabled = true;
          gmxhr({
            method: "GET",
            url: url + (url.includes("?") ? "&" : "?") + "ping=1",
            onload: function(res) {
              btnTestSheetLink.disabled = false;
              try {
                const body = JSON.parse(res.responseText);
                if (body.ok) setSheetStatus("✅ link hoạt động", true);
                else setSheetStatus("❌ " + (body.error || "lỗi từ Script"), false);
              } catch (e) {
                if (res.status >= 200 && res.status < 300) setSheetStatus("✅ link phản hồi", true);
                else setSheetStatus("❌ lỗi HTTP " + res.status, false);
              }
            },
            timeout: 2e4,
            ontimeout: function() {
              btnTestSheetLink.disabled = false;
              setSheetStatus("❌ hết giờ chờ (20s): trình duyệt này chưa kết nối được Google", false);
            },
            onerror: function() {
              btnTestSheetLink.disabled = false;
              setSheetStatus("❌ lỗi kết nối", false);
            }
          });
        };
      }
      window.addEventListener("mousedown", (e) => {
        const btnClear = e.target.closest("#btn-excel-clear");
        if (btnClear) {
          e.preventDefault();
          e.stopPropagation();
          const bucketDef = BUCKETS.find((b) => b.key === state.currentBucket);
          if (unsafeWindow.confirm(`Xóa toàn bộ hồ sơ trong bảng "${bucketDef ? bucketDef.label : ""}" đang xem?`)) {
            state.records = state.currentBucket === "all" ? [] : state.records.filter((r) => getBucket(r) !== state.currentBucket);
            saveState();
            renderTable();
          }
          return;
        }
        const btnCopyAll = e.target.closest("#btn-excel-copy");
        if (btnCopyAll) {
          e.preventDefault();
          e.stopPropagation();
          copyToExcel();
          return;
        }
        const btnCopyRow = e.target.closest(".btn-copy-row");
        if (btnCopyRow) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btnCopyRow.getAttribute("data-idx"));
          copyRowToExcel(idx, btnCopyRow);
          return;
        }
        const btnDeleteRow = e.target.closest(".btn-delete-row");
        if (btnDeleteRow) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btnDeleteRow.getAttribute("data-idx"));
          if (!isNaN(idx) && state.records[idx]) {
            state.records.splice(idx, 1);
            saveState();
            renderTable();
          }
          return;
        }
        const filterTab = e.target.closest(".mplis-excel-filter");
        if (filterTab) {
          e.preventDefault();
          e.stopPropagation();
          state.currentBucket = filterTab.getAttribute("data-excel-bucket");
          renderFilterTabs();
          renderTable();
          return;
        }
      }, true);
      setInterval(scanTree, 1e3);
      setInterval(guiLaiChuaDay, 6e4);
    }
    function loadState() {
      try {
        const stored = localStorage.getItem("mplis_excel_cart");
        if (stored) state.records = JSON.parse(stored);
      } catch (e) {
      }
    }
    function saveState() {
      if (state.records.length > 1500) state.records.splice(0, state.records.length - 1500);
      try {
        localStorage.setItem("mplis_excel_cart", JSON.stringify(state.records));
      } catch (e) {
        console.log("[Excel] Lỗi khi lưu giỏ hàng vào localStorage (có thể đầy dung lượng):", e);
      }
    }
    function renderFilterTabs() {
      const bar = document.getElementById("excel-filter-bar");
      if (!bar) return;
      bar.querySelectorAll(".mplis-excel-filter").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-excel-bucket") === state.currentBucket);
      });
    }
    function getVisibleRecords() {
      const all = state.records.map((r, idx) => ({ r, idx }));
      if (state.currentBucket === "all") return all;
      return all.filter(({ r }) => getBucket(r) === state.currentBucket);
    }
    function renderTable() {
      const thead = document.getElementById("table-excel-cart-head");
      const tbody = document.querySelector("#table-excel-cart tbody");
      const count = document.getElementById("excel-count");
      if (!thead || !tbody || !count) return;
      const bucketDef = BUCKETS.find((b) => b.key === state.currentBucket) || BUCKETS[0];
      const visible = getVisibleRecords();
      count.textContent = visible.length;
      if (bucketDef.rich) {
        thead.innerHTML = `
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">TTHC</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">B.NHẬN</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">HỌ TÊN</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">GCN</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">THỬA</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">TỜ</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);">D.TÍCH</th>
                    <th style="padding:8px 5px; border-bottom:1px solid var(--mplis-border);"><i class="fa fa-bolt"></i></th>
                `;
        tbody.innerHTML = visible.map(({ r, idx }) => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.tenTTHCFull || "---")}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.soBienNhan || "")}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.nguoiNop || "")}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05); color:#fde047; font-weight:bold;">${escapeHtml(r.gcn)}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.thua)}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.to)}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.dt)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05); text-align:center; white-space:nowrap;">
                            <i class="fa fa-copy btn-copy-row" data-idx="${idx}" style="cursor:pointer; color:#0ea5e9; font-size:14px; padding:6px; pointer-events:auto; position:relative; z-index:9999;" title="Copy dòng này"></i>
                            <i class="fa fa-trash btn-delete-row" data-idx="${idx}" style="cursor:pointer; color:#f43f5e; font-size:14px; padding:6px; margin-left:4px; pointer-events:auto; position:relative; z-index:9999;" title="Xóa dòng này"></i>
                        </td>
                    </tr>
                `).join("");
      } else {
        thead.innerHTML = `
                    <th style="padding:8px 6px; border-bottom:1px solid var(--mplis-border);">MÃ HS</th>
                    <th style="padding:8px 6px; border-bottom:1px solid var(--mplis-border);">GCN</th>
                    <th style="padding:8px 6px; border-bottom:1px solid var(--mplis-border);">THỬA</th>
                    <th style="padding:8px 6px; border-bottom:1px solid var(--mplis-border);">TỜ</th>
                    <th style="padding:8px 6px; border-bottom:1px solid var(--mplis-border);">D.TÍCH</th>
                    <th style="padding:8px 6px; border-bottom:1px solid var(--mplis-border);"><i class="fa fa-bolt"></i></th>
                `;
        tbody.innerHTML = visible.map(({ r, idx }) => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05); color:#fde047; font-weight:bold;">${escapeHtml(r.maHS || "---")}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.gcn)}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.thua)}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.to)}</td>
                        <td style="padding:7px 6px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.dt)}</td>
                        <td style="padding:4px; border:1px solid rgba(255,255,255,0.05); text-align:center; white-space:nowrap;">
                            <i class="fa fa-copy btn-copy-row" data-idx="${idx}" style="cursor:pointer; color:#0ea5e9; font-size:14px; padding:6px; pointer-events:auto; position:relative; z-index:9999;" title="Copy dòng này"></i>
                            <i class="fa fa-trash btn-delete-row" data-idx="${idx}" style="cursor:pointer; color:#f43f5e; font-size:14px; padding:6px; margin-left:4px; pointer-events:auto; position:relative; z-index:9999;" title="Xóa dòng này"></i>
                        </td>
                    </tr>
                `).join("");
      }
    }
    function getRowText(r) {
      const bucketDef = BUCKETS.find((b) => b.key === getBucket(r));
      if (bucketDef && bucketDef.rich) {
        return [
          r.tenTTHCFull || "",
          r.soBienNhan || "",
          r.nguoiNop || "",
          r.diaChi || "",
          r.gcn,
          r.thua,
          r.to,
          r.dt,
          r.dtO || "",
          r.dtCLN || "",
          r.dtLUA || "",
          r.dtTSN || "",
          r.dtHNK || ""
        ].join("	");
      }
      return [
        r.loaiHS || "",
        r.maHS || "",
        r.nguoiNop || "",
        r.diaChi || "",
        r.gcn,
        r.thua,
        r.to,
        r.dt,
        r.dtO || "",
        r.dtCLN || "",
        r.dtTSN || "",
        r.dtLUA || "",
        r.dtHNK || "",
        r.dtSKC || ""
      ].join("	");
    }
    function copyRowToExcel(idx, btn) {
      const r = state.records[idx];
      if (!r) return;
      const text = getRowText(r);
      fallbackCopyTextToClipboard(text).then(() => {
        btn.className = "fa fa-check btn-copy-row";
        btn.style.color = "#10b981";
        setTimeout(() => {
          btn.className = "fa fa-copy btn-copy-row";
          btn.style.color = "#0ea5e9";
        }, 1500);
      });
    }
    function copyToExcel() {
      const visible = getVisibleRecords();
      if (visible.length === 0) {
        unsafeWindow.alert("Không có dữ liệu trong bảng đang xem!");
        return;
      }
      const text = visible.map(({ r }) => getRowText(r)).join("\n");
      fallbackCopyTextToClipboard(text).then(() => {
        const btn = document.getElementById("btn-excel-copy");
        const oldText = btn.innerHTML;
        btn.innerHTML = "ĐÃ COPY ✅";
        setTimeout(() => btn.innerHTML = oldText, 2e3);
      });
    }
    const TREE_IDS = ["treeThongTinDangKy", "treeGiayChungNhan"];
    function findTree(root) {
      for (const id of TREE_IDS) {
        const el = root.getElementById(id);
        if (el) return el;
      }
      return null;
    }
    function findTreeDoc() {
      if (findTree(document)) return document;
      try {
        for (let i = 0; i < window.frames.length; i++) {
          try {
            const frameDoc = window.frames[i].document;
            if (frameDoc && findTree(frameDoc)) return frameDoc;
          } catch (e) {
          }
        }
      } catch (e) {
      }
      return null;
    }
    let _scanTreeMissLogged = false;
    function scanTree() {
      const doc = findTreeDoc();
      if (!doc) {
        if (!_scanTreeMissLogged) {
          console.log("[Excel] Không tìm thấy cây GCN/Thửa (đã thử id: " + TREE_IDS.join(", ") + " - cả document chính lẫn iframe con cùng-origin). Nếu vẫn thấy cây trên màn hình, VBDLIS có thể đã đổi id lần nữa - báo lại id thật (F12 > Elements > bấm chọn phần tử cây).");
          _scanTreeMissLogged = true;
        }
        return;
      }
      if (_scanTreeMissLogged) {
        console.log("[Excel] Đã tìm thấy cây trở lại.");
        _scanTreeMissLogged = false;
      }
      const tree = findTree(doc);
      const maHS = findCurrentMaHS(doc) || (doc !== document ? findCurrentMaHS(document) : "");
      let loaiHS = "", nguoiNop2 = "", diaChi = "", rawTitle = "", titleStr = "";
      if (maHS) {
        const trs = Array.from(doc.querySelectorAll('tr[role="row"]')).concat(doc !== document ? Array.from(document.querySelectorAll('tr[role="row"]')) : []);
        for (let tr of trs) {
          if (tr.textContent.includes(maHS)) {
            const col1 = tr.querySelector(".col-md-3:nth-child(1)");
            if (col1) {
              const titleDiv = col1.querySelector("div[title]");
              rawTitle = titleDiv ? titleDiv.getAttribute("title") : col1.textContent.trim();
              titleStr = rawTitle.toLowerCase();
              if (titleStr.includes("xóa đăng ký thế chấp") || titleStr.includes("xóa đăng ký biện pháp bảo đảm")) loaiHS = "XTC";
              else if (titleStr.includes("đăng ký thế chấp") || titleStr.includes("đăng ký biện pháp bảo đảm")) loaiHS = "TC";
              else if (titleStr.includes("xác nhận")) loaiHS = "XN";
              else if (titleStr.includes("tách thửa")) loaiHS = "TÁCH/HỢP THỬA";
              else if (titleStr.includes("đăng ký biến động")) loaiHS = "BĐ";
              const mapMarker = col1.querySelector(".fa-map-marker");
              if (mapMarker && mapMarker.parentNode) {
                let fullAddr = mapMarker.parentNode.textContent.trim();
                fullAddr = fullAddr.split("(")[0].trim();
                fullAddr = fullAddr.replace(/xã |phường |thị trấn /gi, "").trim();
                diaChi = fullAddr.toUpperCase();
              }
            }
            const col4 = tr.querySelector(".col-md-3:nth-child(4)");
            if (col4) {
              const bElements = col4.querySelectorAll("b");
              if (bElements.length > 0) nguoiNop2 = bElements[0].textContent.trim().toUpperCase();
            }
            break;
          }
        }
      }
      const bienDongCode = getBienDongCode(maHS);
      let tenTTHCFull = "";
      if (bienDongCode && BIEN_DONG_CODE_MAP[bienDongCode]) tenTTHCFull = BIEN_DONG_CODE_MAP[bienDongCode];
      else if (bienDongCode) tenTTHCFull = bienDongCode;
      else if (titleStr.includes("cấp đổi")) tenTTHCFull = "CẤP ĐỔI";
      else if (titleStr.includes("cấp lại")) tenTTHCFull = "CẤP LẠI";
      else if (titleStr.includes("tách thửa")) tenTTHCFull = "TÁCH/HỢP THỬA";
      else tenTTHCFull = rawTitle.toUpperCase();
      const soBienNhan = maHS;
      const gcnNodes = Array.from(tree.querySelectorAll("li.jstree-node")).filter((li) => {
        const a = li.querySelector(":scope > a.jstree-anchor");
        return a && (a.textContent.includes("Giấy chứng nhận") || a.textContent.includes("Số phát hành:"));
      });
      if (gcnNodes.length === 0) {
        console.log('[Excel] Tìm thấy #treeGiayChungNhan nhưng 0 node Giấy chứng nhận (li.jstree-node chứa "Giấy chứng nhận" hoặc "Số phát hành:") - cấu trúc cây có thể đã đổi. maHS:', maHS);
      }
      gcnNodes.forEach((gcnLi) => {
        let gcn = "";
        const gcnAnchor = gcnLi.querySelector(":scope > a.jstree-anchor");
        if (gcnAnchor) {
          const text = gcnAnchor.textContent;
          const m = text.match(/Số phát hành:\s*([A-Z0-9\s]+?)\s*-/i);
          if (m && !m[1].includes("-/-")) {
            gcn = m[1].trim();
          } else {
            const fb = text.match(/Giấy chứng nhận\s+([A-Z0-9_]+)/i);
            if (fb) gcn = fb[1];
          }
        }
        if (!gcn) gcn = "CHƯA RÕ";
        const thuaNodes = Array.from(gcnLi.querySelectorAll("li.jstree-node")).filter((li) => {
          const a = li.querySelector(":scope > a.jstree-anchor");
          return a && a.textContent.includes("Thửa đất");
        });
        if (thuaNodes.length === 0) {
          console.log('[Excel] GCN "' + gcn + '" có 0 node Thửa đất bên trong.');
        }
        thuaNodes.forEach((thuaLi) => {
          let thua = "", to = "", dt = 0;
          const thuaAnchor = thuaLi.querySelector(":scope > a.jstree-anchor");
          if (thuaAnchor) {
            const m = thuaAnchor.textContent.match(/Thửa đất.*?\s+(\d+)(?:\s*\((\d+)\))?\s*-\s*Diện tích:\s*([\d.]+)/i);
            if (m) {
              thua = m[1].trim();
              to = m[2] ? m[2].trim() : "-";
              dt = parseFloat(m[3]);
            }
          }
          if (!thua) {
            console.log("[Excel] Không parse được Thửa/Tờ từ text node (regex không khớp):", thuaAnchor ? thuaAnchor.textContent : "(không có anchor)");
            return;
          }
          let dienTichCacLoai = { ODT: 0, ONT: 0, CLN: 0, TSN: 0, LUC: 0, LUK: 0, BUN: 0, LUA: 0, HNK: 0, SKC: 0 };
          const loaiDatNodes = Array.from(thuaLi.querySelectorAll("a.jstree-anchor")).filter((a) => /^[A-Z]{3}:/.test(a.textContent.trim()));
          loaiDatNodes.forEach((node) => {
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
          const loaiGiay = getLoaiGiay(maHS, gcn);
          const tenTTHCDong = loaiGiay === "THU HỒI" ? "THU HỒI" : tenTTHCFull;
          const exists = state.records.some((r) => r.maHS === maHS && r.gcn === gcn && r.thua === thua && r.to === to);
          if (exists) {
            console.log("[Excel] Hồ sơ " + maHS + ' GCN "' + gcn + '" Thửa ' + thua + " Tờ " + to + " đã có trong giỏ - bỏ qua, KHÔNG đẩy lại (kể cả nếu lần trước lỗi). Xóa dòng này ở tab Excel để thử đẩy lại.");
            return;
          }
          {
            const newRecord = {
              maHS,
              loaiHS,
              tenTTHCFull: tenTTHCDong,
              soBienNhan,
              nguoiNop: nguoiNop2,
              diaChi,
              gcn,
              thua,
              to,
              dt,
              dtO: datO,
              dtCLN: datCLN,
              dtTSN: datTSN,
              dtLUA: datLUA,
              dtHNK: datHNK,
              dtSKC: datSKC,
              daDay: false,
              // true khi Sheet đã nhận; false thì tự gửi lại
              soLanThu: 1
            };
            state.records.push(newRecord);
            saveState();
            renderTable();
            pushRecordToSheet(newRecord);
            tree.style.boxShadow = "0 0 10px #10b981";
            setTimeout(() => tree.style.boxShadow = "none", 1e3);
          }
        });
      });
    }
    return { init };
  }();

  // src/alert-module.js
  var AlertModule = function() {
    let savedDetected = [];
    try {
      savedDetected = JSON.parse(sessionStorage.getItem("mplis_detected_dossiers")) || [];
    } catch (e) {
    }
    const state = {
      alertThresholdMinutes: 1440,
      // mặc định 1 ngày (1440 phút)
      detectedDossiers: savedDetected,
      allDossiers: [],
      currentTab: "all",
      searchQuery: ""
    };
    function writeLog(msg) {
      const logContent = document.getElementById("vbdlis-m-logs");
      if (!logContent) return;
      const time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      logContent.innerHTML += `[${time}] ${msg}
`;
      logContent.scrollTop = logContent.scrollHeight;
    }
    function updateStatus(text, type) {
      const statusText = document.getElementById("stat-m-status");
      const statusDot = document.getElementById("stat-m-status-dot");
      if (statusText) statusText.textContent = text;
      if (statusDot) {
        statusDot.className = "mplis-status-dot";
        if (type === "active") statusDot.classList.add("active");
        if (type === "waiting") statusDot.classList.add("waiting");
        if (type === "idle") statusDot.classList.remove("active", "waiting");
      }
    }
    function copyAllVisible() {
      let lines = [];
      state.allDossiers.forEach((dos) => {
        if (dos.element.style.display !== "none") {
          lines.push(`${dos.loaiHoSo}	${dos.maHoSoRutGon}	${dos.nguoiNop}	${dos.diaChi}`);
        }
      });
      if (lines.length === 0) {
        writeLog("ℹ️ Không có hồ sơ nào đang hiển thị để copy.");
        return;
      }
      const textToCopy = lines.join("\n");
      fallbackCopyTextToClipboard(textToCopy).then(() => {
        const btn = document.getElementById("btn-m-copy-all");
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa fa-check"></i> ${lines.length}`;
        btn.style.background = "#059669";
        writeLog(`✅ Đã copy hàng loạt ${lines.length} hồ sơ.`);
        setTimeout(() => {
          btn.innerHTML = oldHtml;
          btn.style.background = "#10b981";
        }, 2500);
      }).catch((err) => writeLog("⚠️ Lỗi copy: " + err));
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
    function applyFilters() {
      let visibleCount = 0;
      state.allDossiers.forEach((dos) => {
        let isMatch = true;
        if (state.currentTab !== "iso" && dos.isKetIso) isMatch = false;
        if (isMatch && state.currentTab === "iso" && !dos.isKetIso) isMatch = false;
        if (isMatch && state.currentTab === "luutru" && !dos.buocXl.includes("Lưu trữ hồ sơ")) isMatch = false;
        if (isMatch && state.searchQuery) {
          const queryMatch = dos.maHoSo.toLowerCase().includes(state.searchQuery) || dos.nguoiNop.toLowerCase().includes(state.searchQuery);
          if (!queryMatch) isMatch = false;
        }
        dos.element.style.display = isMatch ? "" : "none";
        if (isMatch) visibleCount++;
      });
      const elTotal = document.getElementById("stat-m-total");
      const elVisible = document.getElementById("stat-m-visible");
      if (elTotal) elTotal.textContent = state.allDossiers.length;
      if (elVisible) elVisible.textContent = visibleCount;
    }
    function scanTable() {
      const btn = document.getElementById("btn-m-scan-now");
      if (btn) {
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
        btn.style.background = "#64748b";
      }
      setTimeout(() => {
        doScan();
        if (btn) {
          btn.innerHTML = '<i class="fa fa-magic"></i>';
          btn.style.background = "#0ea5e9";
        }
      }, 100);
    }
    function doScan() {
      const trs = document.querySelectorAll('tr[role="row"]');
      state.allDossiers = [];
      let countWarning = 0;
      const now2 = /* @__PURE__ */ new Date();
      state.alertThresholdMinutes = parseFloat(document.getElementById("cfg-alert-minutes").value) || 1440;
      const msPerMinute = 60 * 1e3;
      trs.forEach((tr) => {
        if (tr.querySelector("th")) return;
        const isKetIso = tr.textContent.toLowerCase().includes("kết iso");
        const playPauseIcon = tr.querySelector(".st-column i");
        const isPaused = playPauseIcon && playPauseIcon.classList.contains("fa-pause");
        const col1 = tr.querySelector(".col-md-3:nth-child(1)");
        const maHoSoEl = col1 ? col1.querySelector("b") : null;
        const maHoSoFull = maHoSoEl ? maHoSoEl.textContent.trim() : "";
        let maHoSoRutGon = maHoSoFull;
        if (maHoSoFull) {
          const parts = maHoSoFull.split("-");
          if (parts.length >= 3) {
            const datePart = parts[1];
            const seqPart = parts[2];
            if (datePart.length >= 2) maHoSoRutGon = datePart.slice(-2) + "-" + seqPart;
          }
          maHoSoRutGon = maHoSoRutGon.toUpperCase();
        }
        let loaiHoSo = "";
        if (col1) {
          const titleDiv = col1.querySelector("div[title]");
          const titleStr = titleDiv ? titleDiv.getAttribute("title").toLowerCase() : col1.textContent.toLowerCase();
          if (titleStr.includes("xóa đăng ký thế chấp") || titleStr.includes("xóa đăng ký biện pháp bảo đảm")) loaiHoSo = "XTC";
          else if (titleStr.includes("đăng ký thế chấp") || titleStr.includes("đăng ký biện pháp bảo đảm")) loaiHoSo = "TC";
        }
        let diaChi = "";
        if (col1) {
          const mapMarker = col1.querySelector(".fa-map-marker");
          if (mapMarker && mapMarker.parentNode) {
            let fullAddr = mapMarker.parentNode.textContent.trim();
            fullAddr = fullAddr.split("(")[0].trim();
            fullAddr = fullAddr.replace(/xã |phường |thị trấn /gi, "").trim();
            diaChi = fullAddr.toUpperCase();
          }
        }
        const col2 = tr.querySelector(".col-md-3:nth-child(2)");
        let henTraStr = "";
        let tiepNhanStr = "";
        if (col2) {
          const badge = col2.querySelector(".badge-warning span, .badge-info span, .badge span");
          if (badge) henTraStr = badge.textContent.trim();
          const spanLabels = col2.querySelectorAll("span");
          for (let i = 0; i < spanLabels.length; i++) {
            if (spanLabels[i].textContent.includes("Tiếp nhận:")) {
              const nextDiv = spanLabels[i].parentElement.nextElementSibling;
              if (nextDiv) tiepNhanStr = nextDiv.textContent.trim();
              break;
            }
          }
        }
        const col3 = tr.querySelector(".col-md-3:nth-child(3)");
        let buocXl = "";
        if (col3) {
          const bElements = col3.querySelectorAll("b");
          if (bElements.length > 0) buocXl = bElements[0].textContent.trim();
        }
        const col4 = tr.querySelector(".col-md-3:nth-child(4)");
        let nguoiNop2 = "";
        if (col4) {
          const bElements = col4.querySelectorAll("b");
          if (bElements.length > 0) nguoiNop2 = bElements[0].textContent.trim().toUpperCase();
        }
        if (maHoSoFull) {
          const dossier = { maHoSo: maHoSoFull, maHoSoRutGon, loaiHoSo, diaChi, tiepNhanStr, henTraStr, buocXl, nguoiNop: nguoiNop2, isPaused, isKetIso, element: tr };
          state.allDossiers.push(dossier);
          tr.style.backgroundColor = "";
          tr.style.borderLeft = "";
          const isCuaToi = buocXl.includes("Lưu trữ hồ sơ");
          if (isPaused) {
            tr.style.backgroundColor = "#f1f5f9";
            tr.style.borderLeft = "4px solid #94a3b8";
          } else if (henTraStr && !isKetIso && isCuaToi) {
            const henTra = parseDateVn(henTraStr);
            if (henTra) {
              const diffMs = henTra - now2;
              const diffMinutes = diffMs / msPerMinute;
              if (diffMinutes <= state.alertThresholdMinutes) {
                countWarning++;
                tr.style.backgroundColor = diffMinutes < 0 ? "#fee2e2" : "#fef3c7";
                tr.style.borderLeft = diffMinutes < 0 ? "4px solid #ef4444" : "4px solid #f59e0b";
                const status = diffMinutes < 0 ? "TRỄ HẠN" : "Sắp trễ";
                if (!state.detectedDossiers.includes(maHoSoFull)) {
                  state.detectedDossiers.push(maHoSoFull);
                  sessionStorage.setItem("mplis_detected_dossiers", JSON.stringify(state.detectedDossiers));
                  writeLog(`🚨 [${status}] ${maHoSoFull} | ${buocXl}`);
                }
              }
            }
          }
        }
      });
      document.getElementById("stat-m-count").textContent = countWarning;
      writeLog(`✅ Tìm thấy ${state.allDossiers.length} hồ sơ. Có ${countWarning} hồ sơ cần chú ý.`);
      state.allDossiers.sort((a, b) => {
        const da = parseDateVn(a.henTraStr);
        const db = parseDateVn(b.henTraStr);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
      if (state.allDossiers.length > 0) {
        const tbody = state.allDossiers[0].element.parentNode;
        if (tbody) state.allDossiers.forEach((dos) => tbody.appendChild(dos.element));
      }
      applyFilters();
    }
    return {
      init: function() {
        document.getElementById("btn-m-scan-now").onclick = scanTable;
        const btnReload = document.getElementById("btn-m-reload-table");
        if (btnReload) {
          btnReload.onclick = () => {
            let btn = document.getElementById("btnTraCuuHoSoTiepNhan") || document.getElementById("btnTraCuu");
            if (!btn) {
              const searchIcon = document.querySelector("a i.fa-search, button i.fa-search");
              if (searchIcon) btn = searchIcon.parentElement;
            }
            if (!btn) {
              for (let i = 0; i < window.frames.length; i++) {
                try {
                  let doc = window.frames[i].document;
                  btn = doc.getElementById("btnTraCuuHoSoTiepNhan") || doc.getElementById("btnTraCuu");
                  if (!btn) {
                    const icon = doc.querySelector("a i.fa-search, button i.fa-search");
                    if (icon) btn = icon.parentElement;
                  }
                  if (btn) break;
                } catch (e) {
                }
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
        const btnCopyAll = document.getElementById("btn-m-copy-all");
        if (btnCopyAll) btnCopyAll.onclick = copyAllVisible;
        document.querySelectorAll("#tab-alert .mplis-filter-tab").forEach((tab) => {
          tab.onclick = (e) => {
            document.querySelectorAll("#tab-alert .mplis-filter-tab").forEach((t) => {
              t.style.background = "transparent";
              t.style.color = "#94a3b8";
            });
            e.target.style.background = "rgba(14,165,233,0.3)";
            e.target.style.color = "#fff";
            state.currentTab = e.target.dataset.step;
            applyFilters();
          };
        });
      },
      getTopState: function() {
        return state;
      }
    };
  }();

  // src/lookup-module.js
  var MAX_RESULTS = 30;
  function parseAspNetDate(str) {
    const m = (str || "").match(/\/Date\((\d+)\)\//);
    if (!m) return "";
    const d = new Date(parseInt(m[1], 10));
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function buildPattern(raw) {
    const q = (raw || "").trim();
    if (!q) return "";
    return q.startsWith("%") ? q : "%" + q;
  }
  function search(pattern) {
    return new Promise((resolve, reject) => {
      const jq2 = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
      if (!jq2 || !jq2.ajax) {
        reject(new Error("Trang chưa sẵn sàng (không có jQuery)"));
        return;
      }
      jq2.ajax({
        url: "https://dla.mplis.gov.vn/dc/DangKyAjax/AdvancedSearchHoSoTiepNhan",
        method: "POST",
        data: {
          start: 0,
          length: MAX_RESULTS,
          "model[tinhId]": 66,
          "model[huyenId]": 650,
          "model[xaId]": "",
          "model[quytrinh]": "",
          "model[state]": "",
          "model[soBienNhan]": pattern,
          "model[laHoSoMotCua]": false,
          "model[tiepNhanTuNgay]": "",
          "model[tiepNhanDenNgay]": "",
          "model[henTraTuNgay]": "",
          "model[henTraDenNgay]": "",
          "model[trangThaiHoSo]": 0,
          "model[trangThaiKetISO][]": 0,
          "model[diaChiTaiSan]": "",
          "model[soThua]": "",
          "model[soTo]": "",
          "model[diaChi]": "",
          "model[hoTen]": "",
          "model[soDienThoai]": "",
          "model[giayChungMinh]": "",
          "model[daXuLy]": -1
        }
      }).done((json) => resolve(json && Array.isArray(json.data) ? json.data : [])).fail((xhr) => reject(new Error("Lỗi " + xhr.status)));
    });
  }
  function chip(text, cls) {
    return `<span class="mplis-chip ${cls || ""}">${escapeHtml(text)}</span>`;
  }
  function pickField(obj, regex) {
    if (!obj || typeof obj !== "object") return "";
    for (const k of Object.keys(obj)) {
      if (!regex.test(k)) continue;
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  }
  function findDeep(obj, regex, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 4) return "";
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (regex.test(k) && typeof v === "string" && v.trim()) return v.trim();
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") {
        const found = findDeep(v, regex, depth + 1);
        if (found) return found;
      }
    }
    return "";
  }
  function phuongXaHoSo(item) {
    if (!item) return "";
    const diaChi = pickField(item.nguoiNopDon, /^(diaChi|diaChiThuongTru|diaChiLienHe|diaChiNguoiNop)$/i) || pickField(item.nguoiNopDon, /diaChi/i);
    const wardMatch = diaChi.match(/(Xã|Phường|Thị trấn)\s+[^,]+/i);
    const taiSanMatch = String(item.diaChiTaiSan || "").match(/(Xã|Phường|Thị trấn)\s+[^,]+/i);
    return (taiSanMatch ? taiSanMatch[0].trim() : "") || findDeep(item, /^(phuongXa|tenPhuongXa)$/i) || (wardMatch ? wardMatch[0].trim() : "");
  }
  function extractApplicant(item) {
    const n = item.nguoiNopDon || {};
    const hoTen = pickField(n, /^(hoTen|hovaten|tenNguoiNop|tenNguoiNopDon|ten)$/i) || pickField(n, /ten/i);
    const soGiayTo = pickField(n, /(giayChungMinh|soGiayTo|cmnd|cccd|cmt|dinhDanh|soGiay)/i);
    const sdt = pickField(n, /(dienThoai|sdt|phone)/i);
    const phuongXa = phuongXaHoSo(item);
    if (!hoTen || !soGiayTo || !sdt) {
      try {
        console.log("[MPLIS Lookup] Thiếu thông tin người nộp, nguoiNopDon =", JSON.stringify(item.nguoiNopDon));
      } catch (e) {
      }
    }
    return { hoTen, soGiayTo, sdt, phuongXa };
  }
  function renderCard(item) {
    const state = item.state && item.state.Title || "Đang xử lý";
    const chips = [];
    if (item.daTra) chips.push(chip("Đã trả " + parseAspNetDate(item.ngayTra), "good"));
    if (item.daKetISO) chips.push(chip("Đã kết ISO", "info"));
    if (item.daCapNhatDuLieuPhapLy) chips.push(chip("Đã cập nhật pháp lý", "info"));
    if (item.choBoSung) chips.push(chip("Chờ bổ sung", "warn"));
    const docs = Array.isArray(item.giayToDinhKem) ? item.giayToDinhKem : [];
    const docHtml = docs.length ? docs.map((g) => {
      const ten = escapeHtml(g.tenGiayTo || g.Title || "(không tên)");
      const label = g.tepDinhKem ? `<a class="mplis-lk-doc" href="https://dla.mplis.gov.vn/dc/PdfViewer?fileId=${encodeURIComponent(g.tepDinhKem)}" target="_blank" rel="noopener" title="Mở file trong tab mới">${ten}</a>` : ten;
      return `<li>${label}${g.laGiayToKySo ? " " + chip("ký số", "good") : ""}</li>`;
    }).join("") : '<li class="mplis-dim">Chưa có giấy tờ đính kèm</li>';
    const row = (label, val) => `<div class="mplis-lk-row"><span>${label}</span><b>${escapeHtml(val || "—")}</b></div>`;
    const hen = parseAspNetDate(item.ngayhenTra);
    const ap = extractApplicant(item);
    return `
        <div class="mplis-card mplis-lk-card">
            <div class="mplis-lk-head">
                <button type="button" class="mplis-lk-code" data-copy="${escapeHtml(item.soBienNhan)}" title="Bấm để copy mã hồ sơ">${escapeHtml(item.soBienNhan)}</button>
            </div>
            <div class="mplis-lk-state">${escapeHtml(state)}</div>
            <div class="mplis-lk-chips">${chips.join("")}</div>
            ${row("Người đang xử lý", item.tenNguoiTiepNhan)}
            ${row("Người chuyển tiếp", item.tenNguoiChuyenTiep)}
            ${hen ? row("Hẹn trả", hen) : ""}
            <div class="mplis-lk-docs-title">Thông tin người nộp đơn</div>
            ${row("Người nộp hồ sơ", ap.hoTen)}
            ${row("Số giấy tờ", ap.soGiayTo)}
            ${row("Số điện thoại", ap.sdt)}
            ${row("Phường/Xã", ap.phuongXa)}
            <div class="mplis-lk-docs-title">Giấy tờ đính kèm (${docs.length})</div>
            <ul class="mplis-lk-docs">${docHtml}</ul>
        </div>`;
  }
  function copyText(text) {
    try {
      GM_setClipboard(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }
  var LookupModule = {
    init() {
      const input = document.getElementById("lookup-input");
      const btn = document.getElementById("btn-lookup");
      const out = document.getElementById("lookup-results");
      const info = document.getElementById("lookup-info");
      if (!input || !btn || !out || !info) return;
      let seq = 0;
      const run = async () => {
        const pattern = buildPattern(input.value);
        if (!pattern) {
          info.textContent = "Nhập một phần mã hồ sơ, ví dụ 0402 hoặc 9-0402.";
          out.innerHTML = "";
          return;
        }
        const mine = ++seq;
        info.textContent = "Đang tìm...";
        btn.disabled = true;
        try {
          const items = await search(pattern);
          if (mine !== seq) return;
          info.textContent = items.length ? `Tìm thấy ${items.length} hồ sơ` + (items.length >= MAX_RESULTS ? " (hiện tối đa " + MAX_RESULTS + ")" : "") : "Không tìm thấy hồ sơ nào.";
          out.innerHTML = items.map(renderCard).join("");
        } catch (e) {
          if (mine !== seq) return;
          info.textContent = "Lỗi: " + e.message;
          out.innerHTML = "";
        } finally {
          if (mine === seq) btn.disabled = false;
        }
      };
      btn.onclick = run;
      input.onkeydown = (e) => {
        if (e.key === "Enter") run();
      };
      out.onclick = (e) => {
        const b = e.target.closest("[data-copy]");
        if (!b) return;
        copyText(b.dataset.copy);
        const old = b.textContent;
        b.textContent = "Đã copy!";
        setTimeout(() => {
          b.textContent = old;
        }, 1200);
      };
    }
  };
  async function tenNguoiNop(maDayDu) {
    const items = await search(buildPattern(maDayDu));
    const it = items.find((x) => x.soBienNhan === maDayDu) || items[0];
    return it ? extractApplicant(it).hoTen : "";
  }
  async function traCuuHoSo(raw) {
    return search(buildPattern(raw));
  }

  // src/han-tra.js
  function hanTraMs(r) {
    const m = /\/Date\((-?\d+)\)\//.exec(r && r.ngayhenTra || "");
    return m ? parseInt(m[1], 10) : null;
  }
  function phanLoaiHan(rows, now2, phutSap) {
    const tre = [], sap = [];
    const gioiHan = now2 + phutSap * 6e4;
    (rows || []).forEach((r) => {
      const t = hanTraMs(r);
      if (t === null) return;
      if (t < now2) tre.push({ r, t });
      else if (t <= gioiHan) sap.push({ r, t });
    });
    const theoHan = (a, b) => a.t - b.t;
    return { tre: tre.sort(theoHan), sap: sap.sort(theoHan) };
  }
  function mocDaToi(conLaiMs, phutSap, n) {
    const r = [];
    for (let i = 0; i < n; i++) if (conLaiMs <= phutSap * 6e4 * (n - i) / n) r.push(i);
    return r;
  }
  function khoangThoiGian(ms) {
    const p = Math.round(Math.abs(ms) / 6e4);
    if (p < 60) return p + " phút";
    const g = Math.floor(p / 60);
    if (g < 24) return g + " giờ" + (p % 60 ? " " + p % 60 + " phút" : "");
    return Math.floor(g / 24) + " ngày" + (g % 24 ? " " + g % 24 + " giờ" : "");
  }

  // src/van-ban.js
  var THAY_THE = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };
  function htmlSangChu(html) {
    return String(html == null ? "" : html).replace(/<br\s*\/?>/gi, "\n").replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, url, nhan) => nhan + " (" + url.replace(/&amp;/g, "&") + ")").replace(/<[^>]+>/g, "").replace(/&(lt|gt|quot|#39|amp);/g, (m) => THAY_THE[m]);
  }
  function chiaTheoDo(text, toiDa) {
    const khuc = [];
    let cur = "";
    const day = (s) => {
      if (s) khuc.push(s);
    };
    String(text || "").split("\n").forEach((dong) => {
      while (dong.length > toiDa) {
        day(cur);
        cur = "";
        day(dong.slice(0, toiDa));
        dong = dong.slice(toiDa);
      }
      if ((cur ? cur.length + 1 : 0) + dong.length > toiDa) {
        day(cur);
        cur = dong;
      } else cur += (cur ? "\n" : "") + dong;
    });
    day(cur);
    return khuc;
  }
  function catToiLenh(text) {
    const t = String(text == null ? "" : text).trim();
    const k = t.search(/(^|\s)\/[A-Za-zÀ-ỹ]/);
    return k > 0 ? t.slice(k).trim() : t;
  }

  // src/telegram-notify.js
  var K_ON = "mplis_tg_enabled";
  var K_TOKEN = "mplis_tg_token";
  var K_CHAT = "mplis_tg_chat";
  var K_SEEN = "mplis_tg_seen";
  var K_BASE = "mplis_tg_baseline";
  var K_SEC = "mplis_tg_interval";
  var K_ALERT_ERR = "mplis_tg_alert_error";
  var K_NHAC_ON = "mplis_tg_nhac_tre";
  var K_NHAC = "mplis_tg_nhac_da_gui";
  var K_ZL_TOKEN = "mplis_zl_token";
  var K_ZL_CHAT = "mplis_zl_chat";
  var ZL_TOI_DA = 1900;
  var SEEN_MAX = 600;
  var NOTIFY_URL = "https://dla.mplis.gov.vn/dc/DangKyAjax/GetNotify";
  var WORK_URL = "https://dla.mplis.gov.vn/dc/DangKyAjax/GetXuLyCongViec";
  var st = { items: [], total: null, working: null, lastCheck: 0, msg: "", busy: false, newIds: /* @__PURE__ */ new Set() };
  var ls = {
    get: (k, d = "") => {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : v;
      } catch (e) {
        return d;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
      }
    }
  };
  var isOn = () => ls.get(K_ON) === "true";
  var getSeen = () => {
    try {
      return new Set(JSON.parse(ls.get(K_SEEN, "[]")));
    } catch (e) {
      return /* @__PURE__ */ new Set();
    }
  };
  function saveSeen(set) {
    ls.set(K_SEEN, JSON.stringify(Array.from(set).slice(-SEEN_MAX)));
  }
  var jq = () => typeof unsafeWindow !== "undefined" && unsafeWindow.$ && unsafeWindow.$.ajax ? unsafeWindow.$ : null;
  function aspDate(str) {
    const m = /\/Date\((-?\d+)\)\//.exec(str || "");
    return m ? new Date(parseInt(m[1], 10)) : null;
  }
  var p2 = (n) => String(n).padStart(2, "0");
  var fmtTime = (d) => d ? p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1) : "";
  var gioNgan = (d) => {
    if (!d) return "";
    const now2 = /* @__PURE__ */ new Date();
    const homNay = d.getDate() === now2.getDate() && d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
    return homNay ? p2(d.getHours()) + ":" + p2(d.getMinutes()) : fmtTime(d);
  };
  var KE = "━━━━━━━━━━━━━━";
  var K_NAMES = "mplis_tg_names";
  var getNames = () => {
    try {
      return JSON.parse(ls.get(K_NAMES, "{}"));
    } catch (e) {
      return {};
    }
  };
  function nhoTen(list) {
    const m = getNames();
    let doi = false;
    list.forEach((n) => {
      const u = (n.UserNameChuyenTiep || "").trim().toLowerCase(), f = (n.FullNameNguoiChuyenTiep || "").trim();
      if (u && f && m[u] !== f) {
        m[u] = f;
        doi = true;
      }
    });
    if (doi) ls.set(K_NAMES, JSON.stringify(m));
  }
  var SUA_TEN = { "TRINH ĐÌNH THỞI": "Trịnh Đình Thởi" };
  function chuanTen(raw) {
    raw = (raw || "").trim().normalize("NFC");
    const full = getNames()[raw.toLowerCase()];
    if (full) raw = full;
    const sua = Object.keys(SUA_TEN).find((k) => k.normalize("NFC") === raw.toUpperCase());
    if (sua) return SUA_TEN[sua];
    return raw && raw === raw.toUpperCase() ? raw.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : raw;
  }
  function tenNguoi(n) {
    return chuanTen(n.FullNameNguoiChuyenTiep || n.UserNameChuyenTiep || "Không rõ");
  }
  var laTap = (n) => n.WarningType === 5;
  function ajax(url, data, json) {
    return new Promise((resolve, reject) => {
      const $ = jq();
      if (!$) {
        reject(new Error("Trang chưa sẵn sàng"));
        return;
      }
      const opt = { url, method: "POST", dataType: "json", global: false };
      if (json) {
        opt.contentType = "application/json; charset=utf-8";
        opt.data = JSON.stringify(data);
      } else opt.data = data;
      $.ajax(opt).done(resolve).fail((x) => reject(new Error("Lỗi " + x.status)));
    });
  }
  async function fetchNotify() {
    const j = await ajax(NOTIFY_URL, { start: 0, length: 30 }, true);
    return Array.isArray(j && j.Value) ? j.Value : [];
  }
  async function fetchWork() {
    const body = topWin.__mplisLastReq && topWin.__mplisLastReq["DangKyAjax/GetXuLyCongViec"] || "draw=1&columns%5B0%5D%5Bdata%5D=stt&columns%5B0%5D%5Borderable%5D=false&columns%5B1%5D%5Bdata%5D=soBienNhan&columns%5B1%5D%5Borderable%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=asc&start=0&length=100&search%5Bvalue%5D=&search%5Bregex%5D=false&query=&soNgayCanhBaoHoSoSapDenNgayTra=7&sortField=ngayhenTra&sortDirection=asc&filterBy=0";
    const sp = new URLSearchParams(body);
    sp.set("start", "0");
    sp.set("length", "200");
    sp.set("query", "");
    sp.set("search[value]", "");
    sp.set("filterBy", "0");
    const j = await ajax(WORK_URL, sp.toString(), false);
    if (!j || j.success === false) return null;
    return { total: j.recordsTotal, rows: Array.isArray(j.data) ? j.data : [] };
  }
  function sendTelegram(text) {
    return new Promise((resolve, reject) => {
      const token = ls.get(K_TOKEN).trim(), chat = ls.get(K_CHAT).trim();
      if (!token || !chat) {
        reject(new Error("Chưa nhập API Key hoặc Chat ID"));
        return;
      }
      if (typeof GM_xmlhttpRequest === "undefined") {
        reject(new Error("Thiếu GM_xmlhttpRequest"));
        return;
      }
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.telegram.org/bot" + token + "/sendMessage",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
        onload: (res) => {
          let b = null;
          try {
            b = JSON.parse(res.responseText);
          } catch (e) {
          }
          if (b && b.ok) resolve();
          else reject(new Error(b && b.description || "HTTP " + res.status));
        },
        onerror: () => reject(new Error("Lỗi kết nối Telegram")),
        ontimeout: () => reject(new Error("Telegram quá thời gian")),
        timeout: 15e3
      });
    });
  }
  function zaloGoi(method, body, choMs) {
    return new Promise((resolve, reject) => {
      const token = ls.get(K_ZL_TOKEN).trim();
      if (!token) {
        reject(new Error("Chưa nhập token Zalo"));
        return;
      }
      if (typeof GM_xmlhttpRequest === "undefined") {
        reject(new Error("Thiếu GM_xmlhttpRequest"));
        return;
      }
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://bot-api.zaloplatforms.com/bot" + token + "/" + method,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(body || {}),
        timeout: choMs || 15e3,
        onload: (res) => {
          let b = null;
          try {
            b = JSON.parse(res.responseText);
          } catch (e) {
          }
          if (b && b.ok) resolve(b.result);
          else reject(new Error(method + ": " + (b && b.description || "HTTP " + res.status) + " " + String(res.responseText || "").slice(0, 120)));
        },
        onerror: () => reject(new Error("Lỗi kết nối Zalo")),
        ontimeout: () => reject(new Error("Zalo quá thời gian"))
      });
    });
  }
  function guiZalo(text) {
    const chat = ls.get(K_ZL_CHAT).trim();
    if (!chat) return Promise.reject(new Error("Chưa nhập Chat ID Zalo"));
    return chiaTheoDo(text, ZL_TOI_DA).reduce((p, t) => p.then(() => zaloGoi("sendMessage", { chat_id: chat, text: t })), Promise.resolve());
  }
  var K_KENH = "mplis_kenh";
  var LOAI_TIN = [["moi", "Hồ sơ mới"], ["tre", "Sắp trễ hạn"], ["loi", "Auto dừng vì lỗi"], ["lenh", "Trả lời lệnh (/tong, /tre…)"]];
  var macDinhKenh = (k, l) => {
    if (l === "on") {
      const v = ls.get(K_KENH, "ca");
      return v === "tg" || v === "zl" ? v === k : true;
    }
    if (l === "tre") return ls.get(K_NHAC_ON, "true") !== "false";
    if (l === "loi") return ls.get(K_ALERT_ERR, "true") !== "false";
    return true;
  };
  var kenhBat = (k, l) => {
    const v = ls.get("mplis_ch_" + k + "_" + l);
    return v === "" ? macDinhKenh(k, l) : v === "true";
  };
  var gioiHanGio = (v, macDinh) => Math.min(72, Math.max(0.25, parseFloat(String(v).replace(",", ".")) || macDinh));
  var gioBaoTre = (k) => gioiHanGio(ls.get("mplis_ch_" + k + "_gio"), 2);
  var soLanNhac = (k) => Math.min(10, Math.max(1, parseInt(ls.get("mplis_ch_" + k + "_lan"), 10) || 1));
  var dungTg = () => kenhBat("tg", "on");
  var dungZl = () => kenhBat("zl", "on");
  var coTg = () => !!(ls.get(K_TOKEN).trim() && ls.get(K_CHAT).trim());
  var coZl = () => !!(ls.get(K_ZL_TOKEN).trim() && ls.get(K_ZL_CHAT).trim());
  var telegramSan = (loai) => dungTg() && coTg() && (!loai || kenhBat("tg", loai));
  var zaloSan = (loai) => dungZl() && coZl() && (!loai || kenhBat("zl", loai));
  async function guiTatCa(html, loai, chiKenh) {
    const kenh = [];
    if (telegramSan(loai) && (!chiKenh || chiKenh === "tg")) kenh.push(["Telegram", sendTelegram(html)]);
    if (zaloSan(loai) && (!chiKenh || chiKenh === "zl")) kenh.push(["Zalo", guiZalo(htmlSangChu(html))]);
    if (!kenh.length) {
      if (telegramSan() || zaloSan()) return [];
      throw new Error("Chưa nhập API Key + Chat ID (Telegram hoặc Zalo) hoặc kênh đang tắt");
    }
    const kq = await Promise.allSettled(kenh.map((k) => k[1]));
    const ds = kq.map((r, i) => [kenh[i][0], r.status === "rejected" ? r.reason.message : ""]);
    if (ds.every((x) => x[1])) throw new Error(ds.map((x) => x[0] + ": " + x[1]).join(" · "));
    return ds;
  }
  var nguoiNop = {};
  async function traNguoiNop(fresh) {
    (st.working || []).forEach((r) => {
      const t = docNguoiNop(r);
      if (t && r.soBienNhan) nguoiNop[r.soBienNhan] = t;
    });
    await Promise.all(fresh.filter((n) => !laTap(n) && n.ObjectId && !nguoiNop[n.ObjectId]).map(async (n) => {
      try {
        const t = await tenNguoiNop(n.ObjectId);
        if (t) nguoiNop[n.ObjectId] = t;
      } catch (e) {
      }
    }));
  }
  function buildMessage(fresh) {
    const byPerson = /* @__PURE__ */ new Map();
    fresh.forEach((n) => {
      const k = tenNguoi(n);
      if (!byPerson.has(k)) byPerson.set(k, []);
      byPerson.get(k).push(n);
    });
    const parts = [];
    byPerson.forEach((list, who) => {
      const soHS = list.filter((n) => !laTap(n)).length, soTap = list.filter(laTap).length;
      const dem = [soHS ? soHS + " hồ sơ" : "", soTap ? soTap + " tập hồ sơ" : ""].filter(Boolean).join(" + ");
      const lines = list.slice().reverse().map((n) => "  ▸ " + (laTap(n) ? "Tập <b>" + escapeHtml(n.ObjectId) + "</b>" : "<b>" + escapeHtml(String(n.ObjectId || "").toUpperCase()) + "</b>") + (nguoiNop[n.ObjectId] ? " · " + escapeHtml(nguoiNop[n.ObjectId]) : "") + " · " + escapeHtml(gioNgan(aspDate(n.NgayTao))) + (laTap(n) ? "" : dongPhu((st.working || []).find((r) => r && r.soBienNhan === n.ObjectId))));
      parts.push("👤 <b>" + escapeHtml(who) + "</b> chuyển <b>" + dem + "</b>\n" + lines.join("\n"));
    });
    let msg = "📥 <b>HỒ SƠ MỚI</b>\n" + KE + "\n" + parts.join("\n\n");
    if (st.working) {
      const tong = st.total !== null ? st.total : st.working.length;
      const ds = Array.from(demTheoNguoi().entries()).sort((a, b) => b[1].n - a[1].n);
      msg += "\n" + KE + "\n📊 <b>Đang chờ xử lý: " + tong + " bộ</b>\n" + ds.map(([ten, o]) => "  • " + escapeHtml(ten) + " — <b>" + o.n + "</b> bộ").join("\n");
    } else if (st.total !== null) msg += "\n" + KE + "\n📊 Đang chờ xử lý: <b>" + st.total + "</b> bộ";
    return msg;
  }
  function dongTre(x, now2) {
    const nn = docNguoiNop(x.r);
    return "  ▸ <b>" + escapeHtml(String(x.r.soBienNhan || "").toUpperCase()) + "</b>" + (nn ? " · " + escapeHtml(nn) : "") + " · " + (x.t < now2 ? "🔴 trễ " : "⏳ còn ") + khoangThoiGian(x.t - now2) + dongPhu(x.r);
  }
  async function nhacSapTre() {
    if (!st.working) return;
    const now2 = Date.now();
    let daNhac;
    try {
      daNhac = new Set(JSON.parse(ls.get(K_NHAC, "[]")));
    } catch (e) {
      daNhac = /* @__PURE__ */ new Set();
    }
    let loi = null;
    for (const k of ["tg", "zl"]) {
      if (!(k === "tg" ? telegramSan("tre") : zaloSan("tre"))) continue;
      const phut = Math.round(gioBaoTre(k) * 60);
      const n = soLanNhac(k);
      const khoa = (x, i) => k + "|" + x.r.soBienNhan + "|" + x.t + "|" + i;
      const daToi = (x) => mocDaToi(x.t - now2, phut, n);
      const moi = phanLoaiHan(st.working, now2, phut).sap.filter((x) => daToi(x).some((i) => !daNhac.has(khoa(x, i))));
      if (!moi.length) continue;
      try {
        await guiTatCa("⏰ <b>HỒ SƠ SẮP ĐẾN HẠN TRẢ</b> (còn dưới " + khoangThoiGian(phut * 6e4) + ")\n" + KE + "\n" + moi.map((x) => dongTre(x, now2)).join("\n"), "tre", k);
        moi.forEach((x) => daToi(x).forEach((i) => daNhac.add(khoa(x, i))));
      } catch (e) {
        loi = e;
      }
    }
    const con = new Set(st.working.map((r) => r.soBienNhan + "|" + hanTraMs(r)));
    ls.set(K_NHAC, JSON.stringify(Array.from(daNhac).filter((x) => {
      const p = x.split("|");
      return con.has(p[1] + "|" + p[2]);
    }).slice(-3e3)));
    if (loi) throw loi;
  }
  function tomTatTre(doi) {
    if (!st.working) return "Chưa có dữ liệu hồ sơ. Thử lại sau ít giây.";
    const gio = gioiHanGio(doi, 1);
    const now2 = Date.now();
    const { tre, sap } = phanLoaiHan(st.working, now2, Math.round(gio * 60));
    const tenGio = gio + " giờ";
    if (!tre.length && !sap.length) return "✅ <b>Không có hồ sơ trễ hoặc sắp trễ trong " + tenGio + " tới.</b>";
    let msg = "";
    if (tre.length) msg += "🔴 <b>ĐÃ TRỄ HẠN: " + tre.length + " bộ</b>\n" + KE + "\n" + tre.map((x) => dongTre(x, now2)).join("\n");
    if (sap.length) msg += (msg ? "\n\n" : "") + "🟠 <b>SẮP TRỄ trong " + tenGio + ": " + sap.length + " bộ</b>\n" + KE + "\n" + sap.map((x) => dongTre(x, now2)).join("\n");
    return msg;
  }
  async function tick(manual) {
    if (st.busy) return;
    if (!manual && !isOn()) return;
    const run = topWin.MPLIS_AUTO_STATE;
    if (run && run.isRunning) {
      st.msg = "Auto đang chạy, tạm hoãn kiểm tra.";
      render();
      return;
    }
    st.busy = true;
    try {
      const list = await fetchNotify();
      st.items = list;
      nhoTen(list);
      let conCho = null;
      try {
        const w = await fetchWork();
        if (w) {
          st.total = w.total;
          st.working = w.rows;
          conCho = maConCho(w.rows, w.total);
        }
      } catch (e) {
      }
      st.lastCheck = Date.now();
      const seen = getSeen();
      const conTrongDs = (n) => laTap(n) || !conCho || conCho.has(n.ObjectId);
      list.forEach((n) => {
        if (n.Id && !seen.has(n.Id) && !conTrongDs(n)) seen.add(n.Id);
      });
      saveSeen(seen);
      const fresh = list.filter((n) => n.Id && !seen.has(n.Id));
      st.newIds = new Set(fresh.map((n) => n.Id));
      if (ls.get(K_BASE) !== "true") {
        list.forEach((n) => n.Id && seen.add(n.Id));
        saveSeen(seen);
        ls.set(K_BASE, "true");
        st.newIds = /* @__PURE__ */ new Set();
        st.msg = "Đã ghi nhận mốc " + list.length + " thông báo cũ, từ giờ chỉ báo cái mới.";
      } else if (isOn() && fresh.length) {
        await traNguoiNop(fresh);
        const kq = await guiTatCa(buildMessage(fresh), "moi");
        fresh.forEach((n) => seen.add(n.Id));
        saveSeen(seen);
        const hong = kq.filter((x) => x[1]);
        st.msg = !kq.length ? "ℹ️ Có " + fresh.length + ' thông báo mới nhưng không kênh nào đang nhận loại "Hồ sơ mới" nên chưa gửi.' : hong.length ? "⚠️ Gửi " + fresh.length + " thông báo mới nhưng lỗi: " + hong.map((x) => x[0] + ": " + x[1]).join(" · ") : "✅ Đã gửi " + fresh.length + " thông báo mới.";
      } else {
        st.msg = fresh.length ? fresh.length + " thông báo mới (chưa gửi vì đang tắt)." : "Không có hồ sơ mới.";
      }
      if (isOn()) await nhacSapTre();
    } catch (e) {
      st.msg = "❌ " + e.message + " (sẽ thử lại, không bỏ sót).";
    } finally {
      st.busy = false;
      render();
    }
  }
  function docNguoiChuyen(r) {
    return chuanTen(r && (r.nguoiChuyenTiep || r.tenNguoiChuyenTiep) || "");
  }
  function docGioChuyen(r) {
    return aspDate(r && r.ngayPhanCong);
  }
  function docNguoiNop(r) {
    return String(r && r.nguoiNopDon && r.nguoiNopDon.hoTen || "").replace(/\s+/g, " ").trim();
  }
  var _daLogCot = false;
  function maConCho(rows, total) {
    if (!Array.isArray(rows)) return null;
    if (typeof total === "number" && rows.length < total) return null;
    return new Set(rows.map((r) => r && r.soBienNhan).filter(Boolean));
  }
  function demTheoNguoi() {
    const m = /* @__PURE__ */ new Map();
    (st.working || []).forEach((r) => {
      const k = docNguoiChuyen(r) || "Chưa rõ người chuyển";
      const o = m.get(k) || { n: 0, gio: null, ds: [] };
      o.n++;
      o.ds.push(r);
      const g = docGioChuyen(r);
      if (g && (!o.gio || g > o.gio)) o.gio = g;
      m.set(k, o);
    });
    return m;
  }
  function renderSenders() {
    const el = document.getElementById("qt-sender-list");
    if (!el) return;
    const dim = (t) => '<span style="font-size:11.5px; color:var(--mplis-text-dim);">' + t + "</span>";
    if (!st.working) {
      el.innerHTML = dim('Chưa có dữ liệu. Mở màn Xử lý công việc hoặc bấm "Kiểm tra ngay" ở tab chuông.');
      return;
    }
    if (!_daLogCot && st.working.length) {
      _daLogCot = true;
      console.log("[MPLIS Notify] Các cột của 1 dòng GetXuLyCongViec:", Object.keys(st.working[0]), st.working[0]);
    }
    const tong = st.total !== null ? st.total : st.working.length;
    const m = demTheoNguoi();
    let html = '<div style="font-size:12px; margin-bottom:3px;">Đang chờ xử lý: <b style="color:var(--mplis-accent-2);">' + tong + "</b> bộ</div>";
    html += Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n).map(([ten, o]) => '<div class="mplis-lk-row" style="border-top:none; padding:3px 0;"><span style="color:var(--mplis-text);">' + escapeHtml(ten) + "</span><b>" + o.n + " bộ" + (o.gio ? " · " + escapeHtml(fmtTime(o.gio)) : "") + "</b></div>").join("");
    el.innerHTML = html;
  }
  window.addEventListener("mplis:api", ({ detail: e }) => {
    try {
      const ep = e.ep || "";
      const q = new URLSearchParams(typeof e.req === "string" ? e.req : "");
      const daLoc = !!(q.get("query") || q.get("search[value]") || q.get("filterBy") && q.get("filterBy") !== "0");
      if (ep.indexOf("GetXuLyCongViec") !== -1 && !daLoc && e.res && Array.isArray(e.res.data)) {
        st.working = e.res.data;
        st.total = typeof e.res.recordsTotal === "number" ? e.res.recordsTotal : e.res.data.length;
        render();
      } else if (ep.indexOf("GetNotify") !== -1 && e.res && Array.isArray(e.res.Value)) {
        st.items = e.res.Value;
        nhoTen(st.items);
        render();
      }
    } catch (err) {
    }
  });
  function render() {
    renderSenders();
    const box = document.getElementById("tg-list");
    if (!box) return;
    const cnt = document.getElementById("tg-total");
    if (cnt) cnt.textContent = st.total === null ? "—" : String(st.total);
    const sub = document.getElementById("tg-sub");
    if (sub) sub.textContent = st.lastCheck ? "Kiểm tra lúc " + fmtTime(new Date(st.lastCheck)) : "Chưa kiểm tra";
    const msg = document.getElementById("tg-msg");
    if (msg) msg.textContent = st.msg;
    const conCho = st.working ? maConCho(st.working, st.total) : null;
    const dsHien = st.items.filter((n) => laTap(n) || !conCho || conCho.has(n.ObjectId));
    const hs = dsHien.filter((n) => !laTap(n)).length, tap = dsHien.length - hs;
    const head = document.getElementById("tg-recv");
    if (head) head.textContent = "Vừa nhận: " + hs + " hồ sơ" + (tap ? " · " + tap + " tập" : "");
    box.innerHTML = dsHien.length ? dsHien.map(
      (n) => '<div class="mplis-lk-row"><span>' + escapeHtml(fmtTime(aspDate(n.NgayTao))) + (st.newIds.has(n.Id) ? " 🆕" : "") + "</span><b>" + (laTap(n) ? "Tập " + escapeHtml(n.ObjectId) : escapeHtml(String(n.ObjectId || "").toUpperCase())) + " ← " + escapeHtml(tenNguoi(n)) + "</b></div>"
    ).join("") : "";
  }
  var K_OFFSET = "mplis_tg_offset";
  function tgGoi(method, body) {
    return new Promise((resolve, reject) => {
      const token = ls.get(K_TOKEN).trim();
      if (!token || typeof GM_xmlhttpRequest === "undefined") {
        reject(new Error("Thiếu API Key"));
        return;
      }
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.telegram.org/bot" + token + "/" + method,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(body || {}),
        timeout: 15e3,
        onload: (res) => {
          try {
            const b = JSON.parse(res.responseText);
            b.ok ? resolve(b.result) : reject(new Error(b.description || "HTTP " + res.status));
          } catch (e) {
            reject(e);
          }
        },
        onerror: () => reject(new Error("Lỗi kết nối Telegram")),
        ontimeout: () => reject(new Error("Telegram quá thời gian"))
      });
    });
  }
  function loaiHoSoNgan(item) {
    let t = String(item && item.quytrinh && item.quytrinh.SchemaName || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    t = t.replace(/^[\w.]+\.\s+/, "").replace(/^trường hợp\s+/i, "");
    t = t.split(/\s+(?:quyền|trong trường)/i)[0].replace(/[.,;\s]+$/, "");
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t.length > 90 ? t.slice(0, 87) + "..." : t;
  }
  function henTraNgan(item) {
    const d = aspDate(item && item.ngayhenTra);
    if (!d) return "";
    const s = p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear();
    return d.getTime() < Date.now() ? s + " ⚠️ quá hạn" : s;
  }
  function dongPhu(item) {
    const loai = loaiHoSoNgan(item), hen = henTraNgan(item), xa = phuongXaHoSo(item);
    return (loai ? "\n      📋 " + escapeHtml(loai) : "") + (xa ? "\n      📍 " + escapeHtml(xa) : "") + (hen ? "\n      ⏰ Hẹn trả: <b>" + escapeHtml(hen) + "</b>" : "");
  }
  function dongHoSo(r) {
    const nn = docNguoiNop(r);
    return "  ▸ <b>" + escapeHtml(String(r.soBienNhan || "").toUpperCase()) + "</b>" + (nn ? " · " + escapeHtml(nn) : "") + " · " + escapeHtml(gioNgan(docGioChuyen(r))) + dongPhu(r);
  }
  function tomTat(chiTiet) {
    if (!st.working) return "Chưa có dữ liệu hồ sơ. Thử lại sau ít giây.";
    const tong = st.total !== null ? st.total : st.working.length;
    const ds = Array.from(demTheoNguoi().entries()).sort((a, b) => b[1].n - a[1].n);
    if (!ds.length) return "📊 <b>Không có hồ sơ nào đang chờ xử lý.</b>";
    let msg = "📊 <b>ĐANG CHỜ XỬ LÝ: " + tong + " bộ</b>\n" + KE;
    ds.forEach(([ten, o]) => {
      msg += "\n👤 <b>" + escapeHtml(ten) + "</b> — " + o.n + " bộ" + (o.gio ? " (mới nhất " + escapeHtml(gioNgan(o.gio)) + ")" : "");
      if (chiTiet) {
        o.ds.slice().sort((a, b) => (docGioChuyen(b) || 0) - (docGioChuyen(a) || 0)).forEach((r) => {
          msg += "\n" + dongHoSo(r);
        });
        msg += "\n";
      }
    });
    msg += "\n" + KE + "\n🕒 Cập nhật " + fmtTime(new Date(st.lastCheck || Date.now()));
    return msg;
  }
  function guiChia(chat, text) {
    const parts = [];
    let cur = "";
    text.split("\n").forEach((line) => {
      if ((cur + "\n" + line).length > 3800) {
        parts.push(cur);
        cur = line;
      } else cur += (cur ? "\n" : "") + line;
    });
    if (cur) parts.push(cur);
    return parts.reduce((p, t) => p.then(() => tgGoi("sendMessage", { chat_id: chat, text: t, parse_mode: "HTML", disable_web_page_preview: true })), Promise.resolve());
  }
  var HUONG_DAN = "🤖 <b>BOT MPLIS — CÁCH HỎI</b>\n" + KE + '\n📊 <b>/tong</b> — tổng số bộ đang chờ, mỗi người chuyển bao nhiêu\n📋 <b>/chitiet</b> — như trên, kèm từng hồ sơ (mã, người nộp, giờ chuyển)\n👤 <b>/ai thoi</b> — hồ sơ của người có tên chứa "thoi" (gõ không dấu cũng được)\n⏰ <b>/tre</b> — hồ sơ đã trễ + sắp trễ trong 1 giờ (<b>/tre 3</b> = trong 3 giờ). Bot cũng tự nhắc khi hồ sơ sắp đến hạn trả\n🔎 <b>/tracuu 0402</b> — hồ sơ đi tới đâu, ai đang giữ, hẹn trả khi nào\n      Gõ thẳng đuôi mã (VD: <b>0402</b> hoặc <b>9-0402</b>) cũng được\n🔄 <b>/f5</b> — tải lại trang MPLIS trên máy (khi trang treo hoặc hết phiên)\n❓ <b>/help</b> — hiện bảng này\n' + KE + "\nGõ chữ khác bot sẽ hiện /tong.";
  var boDau = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  function tomTatNguoi(tuKhoa) {
    if (!st.working) return "Chưa có dữ liệu hồ sơ. Thử lại sau ít giây.";
    const k = boDau(tuKhoa);
    const ds = Array.from(demTheoNguoi().entries()).filter(([ten]) => boDau(ten).includes(k));
    if (!ds.length) return '❌ Không thấy ai tên có "' + escapeHtml(tuKhoa) + '" trong danh sách đang chờ.';
    let msg = "";
    ds.forEach(([ten, o]) => {
      msg += (msg ? "\n\n" : "") + "👤 <b>" + escapeHtml(ten) + "</b> — " + o.n + " bộ\n" + KE;
      o.ds.slice().sort((a, b) => (docGioChuyen(b) || 0) - (docGioChuyen(a) || 0)).forEach((r) => {
        msg += "\n" + dongHoSo(r);
      });
    });
    return msg;
  }
  function moTaHoSo(it) {
    const buoc = it.state && it.state.Title || "Đang xử lý";
    const ap = extractApplicant(it);
    const dong = [];
    const row = (icon, nhan, val) => dong.push(icon + " " + nhan + ": <b>" + escapeHtml(val || "—") + "</b>");
    const row2 = (nhan, val) => dong.push("  " + nhan + ": <b>" + escapeHtml(val || "—") + "</b>");
    dong.push("🔎 <b>" + escapeHtml(it.soBienNhan) + "</b>");
    dong.push("📍 Đang ở bước: <b>" + escapeHtml(buoc) + "</b>");
    const loaiHS = loaiHoSoNgan(it);
    if (loaiHS) dong.push("📋 Loại hồ sơ: <b>" + escapeHtml(loaiHS) + "</b>");
    const chip2 = [];
    if (it.daTra) chip2.push("✅ Đã trả " + parseAspNetDate(it.ngayTra));
    if (it.daKetISO) chip2.push("🟦 Đã kết ISO");
    if (it.daCapNhatDuLieuPhapLy) chip2.push("🟦 Đã cập nhật pháp lý");
    if (it.choBoSung) chip2.push("⚠️ Chờ bổ sung");
    if (chip2.length) dong.push(escapeHtml(chip2.join(" · ")));
    dong.push(KE);
    row("🧑‍💼", "Người đang xử lý", it.tenNguoiTiepNhan ? chuanTen(it.nguoiTiepNhan || it.tenNguoiTiepNhan) : "");
    row("📤", "Người chuyển tiếp", it.tenNguoiChuyenTiep ? chuanTen(it.nguoiChuyenTiep || it.tenNguoiChuyenTiep) : "");
    const hen = parseAspNetDate(it.ngayhenTra);
    if (hen) row("⏰", "Hẹn trả", hen);
    dong.push(KE);
    dong.push("🙍 <b>Người nộp đơn</b>");
    row2("Họ tên", ap.hoTen);
    row2("Số giấy tờ", ap.soGiayTo);
    row2("Điện thoại", ap.sdt);
    row2("Phường/Xã", ap.phuongXa);
    const docs = Array.isArray(it.giayToDinhKem) ? it.giayToDinhKem : [];
    dong.push(KE);
    dong.push("📎 <b>Giấy tờ đính kèm (" + docs.length + ")</b>");
    if (!docs.length) dong.push("  Chưa có giấy tờ đính kèm");
    docs.forEach((g, i) => {
      const ten = escapeHtml(g.tenGiayTo || g.Title || "(không tên)");
      const nhan = g.tepDinhKem ? '<a href="https://dla.mplis.gov.vn/dc/PdfViewer?fileId=' + encodeURIComponent(g.tepDinhKem) + '">' + ten + "</a>" : ten;
      dong.push("  " + (i + 1) + ". " + nhan + (g.laGiayToKySo ? " ✍️" : ""));
    });
    return dong.join("\n");
  }
  async function traCuuBot(tuKhoa) {
    const q = String(tuKhoa || "").trim();
    if (!/\d{2,}/.test(q)) return "Nhập ít nhất 2-3 số cuối mã hồ sơ. VD: <b>/tracuu 0402</b>";
    let ds;
    try {
      ds = await traCuuHoSo(q);
    } catch (e) {
      return "❌ Tra cứu lỗi: " + escapeHtml(e.message);
    }
    if (!ds.length) return '❌ Không tìm thấy hồ sơ nào khớp "' + escapeHtml(q) + '".';
    const toiDa = 5;
    let msg = ds.slice(0, toiDa).map(moTaHoSo).join("\n\n");
    if (ds.length > toiDa) msg += "\n\n… còn " + (ds.length - toiDa) + " hồ sơ khác, gõ thêm số cho gọn (VD: <b>9-0402</b>).";
    return msg;
  }
  var daDatMenu = false;
  async function datMenuBot() {
    if (daDatMenu) return;
    try {
      await tgGoi("setMyCommands", { commands: [
        { command: "tong", description: "Tổng hồ sơ đang chờ, ai chuyển bao nhiêu" },
        { command: "chitiet", description: "Chi tiết từng hồ sơ" },
        { command: "ai", description: "Xem hồ sơ của 1 người: /ai thoi" },
        { command: "tre", description: "Hồ sơ đã trễ và sắp trễ hạn" },
        { command: "tracuu", description: "Hồ sơ đi tới đâu: /tracuu 0402" },
        { command: "f5", description: "Tải lại trang MPLIS trên máy" },
        { command: "help", description: "Hướng dẫn" }
      ] });
      daDatMenu = true;
    } catch (e) {
    }
  }
  async function lamMoiDuLieu() {
    const run = topWin.MPLIS_AUTO_STATE;
    if (run && run.isRunning) return;
    try {
      const w = await fetchWork();
      if (w) {
        st.total = w.total;
        st.working = w.rows;
        st.lastCheck = Date.now();
        render();
      }
    } catch (e) {
    }
  }
  var canTaiLai = false;
  async function traLoi(text) {
    const t = catToiLenh(text);
    const m = /^\/?([a-zA-Z0-9_À-ỹ]+)(?:@\w+)?\s*(.*)$/s.exec(t);
    const lenh = m ? boDau(m[1]) : "";
    const doi = m ? m[2].trim() : "";
    if (/^(start|help|huongdan|hd|trogiup)$/.test(lenh) || t === "?") return HUONG_DAN;
    if (/^(f5|reload|taitrang|lammoi)$/.test(lenh)) {
      const run = topWin.MPLIS_AUTO_STATE;
      if (run && run.isRunning && !/ep|force/i.test(doi)) return "⚠️ Đang làm dở hồ sơ, tải lại trang giữa chừng có thể làm hỏng việc đang làm.\nMuốn vẫn tải lại thì gõ <b>/f5 ep</b>.";
      canTaiLai = true;
      return "🔄 Đang tải lại trang (F5)...";
    }
    if (/^(tre|trehan|han)$/.test(lenh)) {
      await lamMoiDuLieu();
      return tomTatTre(doi);
    }
    if (/^(tracuu|tc|tim|hoso)$/.test(lenh)) return traCuuBot(doi);
    if (/\d{3,}/.test(t) && !/^\/(tong|chitiet|ai)\b/i.test(t)) return traCuuBot(t.replace(/^\/\S+\s*/, ""));
    if (/^(ai|nguoi)$/.test(lenh)) {
      if (!doi) return "Gõ kèm tên, VD: <b>/ai thoi</b>";
      await lamMoiDuLieu();
      return tomTatNguoi(doi);
    }
    await lamMoiDuLieu();
    return tomTat(/^(chitiet|ct|ds|list)$/.test(lenh));
  }
  var dangHoi = false;
  async function pollLenh() {
    if (dangHoi || !isOn() || !kenhBat("tg", "lenh") || !dungTg() || !ls.get(K_TOKEN).trim() || !ls.get(K_CHAT).trim()) return;
    dangHoi = true;
    try {
      datMenuBot();
      const raw = ls.get(K_OFFSET, "");
      const dsCapNhat = await tgGoi("getUpdates", raw ? { offset: parseInt(raw, 10), timeout: 0, allowed_updates: ["message"] } : { timeout: 0, allowed_updates: ["message"] });
      if (!dsCapNhat.length) {
        if (!raw) ls.set(K_OFFSET, "0");
        return;
      }
      if (!raw) {
        ls.set(K_OFFSET, String(dsCapNhat[dsCapNhat.length - 1].update_id + 1));
        return;
      }
      const chat = ls.get(K_CHAT).trim();
      for (const u of dsCapNhat) {
        const m = u.message;
        if (m && m.text && String(m.chat && m.chat.id) === chat) {
          let tra;
          try {
            tra = await traLoi(m.text);
          } catch (e) {
            tra = "❌ Lỗi: " + escapeHtml(e.message);
          }
          try {
            await guiChia(chat, tra);
          } catch (e) {
            if (/kết nối|quá thời gian/.test(e.message)) throw e;
          }
        }
        ls.set(K_OFFSET, String(u.update_id + 1));
        if (canTaiLai) {
          canTaiLai = false;
          setTimeout(() => {
            try {
              topWin.location.reload();
            } catch (e) {
              location.reload();
            }
          }, 800);
          return;
        }
      }
    } catch (e) {
    } finally {
      dangHoi = false;
    }
  }
  var zlDangHoi = false;
  var zlDaGoHook = false;
  async function pollZalo() {
    if (zlDangHoi || !isOn() || !kenhBat("zl", "lenh") || !dungZl() || !ls.get(K_ZL_TOKEN).trim()) return;
    zlDangHoi = true;
    try {
      if (!zlDaGoHook) {
        zlDaGoHook = true;
        try {
          await zaloGoi("deleteWebhook", {});
        } catch (e) {
        }
      }
      const r = await zaloGoi("getUpdates", { timeout: "10" }, 45e3).catch((e) => {
        if (/408|Request timeout/.test(e.message)) return null;
        throw e;
      });
      const ds = Array.isArray(r) ? r : r && r.message ? [r] : [];
      const chat = ls.get(K_ZL_CHAT).trim();
      if (!chat && !ds.length) {
        st.msg = "Zalo: đã kết nối, chưa có tin mới. Hãy nhắn bot 1 tin bất kỳ." + (r ? " Trả về: " + JSON.stringify(r).slice(0, 150) : "");
        render();
      }
      for (const u of ds) {
        const m = u.message;
        if (!m || !m.text || m.from && m.from.is_bot) continue;
        const id = String(m.chat && m.chat.id);
        if (!chat) {
          st.msg = "Zalo: có tin từ chat ID " + id + " (loại " + (m.chat && m.chat.chat_type || "?") + "). Đúng chat của bạn thì dán ID này vào ô Zalo Chat ID.";
          render();
          break;
        }
        if (id !== chat) {
          st.msg = "Zalo: có tin từ chat khác (loại " + (m.chat && m.chat.chat_type || "?") + ", ID " + id + "), bỏ qua. Muốn dùng chat đó thì dán ID này vào ô Zalo Chat ID.";
          render();
          continue;
        }
        let tra;
        try {
          tra = await traLoi(m.text);
        } catch (e) {
          tra = "❌ Lỗi: " + escapeHtml(e.message);
        }
        await guiZalo(htmlSangChu(tra) + (/^\/?(start|help|hd|huongdan|trogiup)\b/i.test(String(m.text).trim()) ? "" : "\n" + KE + "\n💡 Gõ: /tong · /chitiet · /tre · /ai <tên> · /tracuu 0402 · /f5 · /help"));
        if (canTaiLai) {
          canTaiLai = false;
          setTimeout(() => {
            try {
              topWin.location.reload();
            } catch (e) {
              location.reload();
            }
          }, 800);
          return;
        }
      }
    } catch (e) {
      if (!ls.get(K_ZL_CHAT).trim()) {
        st.msg = "Zalo: chưa nhận được tin (" + e.message + ")";
        render();
      }
    } finally {
      zlDangHoi = false;
    }
  }
  if (window === window.top) {
    topWin.MPLIS_TG_ALERT = (html, ma) => {
      if (!isOn() || !(telegramSan("loi") || zaloSan("loi"))) return;
      const r = ma && (st.working || []).find((x) => x && String(x.soBienNhan).toUpperCase() === String(ma).toUpperCase());
      const xa = r ? phuongXaHoSo(r) : "";
      if (xa) html = html.replace(/(📄 Hồ sơ:[^\n]*)/, (m) => m + "\n📍 " + escapeHtml(xa));
      guiTatCa(html, "loi").catch((e) => console.log("[MPLIS Notify] Không gửi được cảnh báo lỗi:", e.message));
    };
  }
  var timer = false;
  function startTimer() {
    if (timer) return;
    timer = true;
    const run = () => {
      const sec = Math.max(15, parseInt(ls.get(K_SEC, "30"), 10) || 30);
      if (Date.now() - st.lastCheck >= sec * 1e3 - 500) tick(false);
    };
    const chay = () => setFastInterval(() => {
      run();
      pollLenh();
      pollZalo();
    }, 5e3);
    if ("locks" in navigator) navigator.locks.request("mplis-notify", () => {
      chay();
      return new Promise(() => {
      });
    });
    else chay();
  }
  function khoiKenh(k, ten, oNhap) {
    const tick2 = (l, nhan) => '<label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--mplis-text);"><input type="checkbox" id="ch-' + k + "-" + l + '" ' + (kenhBat(k, l) ? "checked" : "") + "> " + nhan + "</label>";
    return '<div id="kenh-' + k + '" style="padding:8px 0; border-top:1px solid var(--mplis-border);"><div class="mplis-bypass-row" style="padding:0 0 6px;"><div class="mplis-bypass-row-label"><strong>' + ten + '</strong></div><label class="mplis-toggle-sw"><input type="checkbox" id="ch-' + k + '-on" ' + (kenhBat(k, "on") ? "checked" : "") + '><span class="mplis-toggle-track"></span></label></div>' + oNhap + '<div style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--mplis-text-dim); margin:4px 0;">Báo trễ trước <input type="number" id="ch-' + k + '-gio" min="0.25" max="72" step="0.5" value="' + gioBaoTre(k) + '" style="width:60px; padding:4px; text-align:center;"> giờ, nhắc <input type="number" id="ch-' + k + '-lan" min="1" max="10" step="1" value="' + soLanNhac(k) + '" style="width:48px; padding:4px; text-align:center;"> lần</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; margin-top:2px;">' + LOAI_TIN.map(([l, nhan]) => tick2(l, nhan)).join("") + "</div></div>";
  }
  var NotifyModule = {
    html() {
      return `
        <div class="mplis-card">
            <div class="mplis-bypass-row" style="padding-top:0;">
                <div class="mplis-bypass-row-label"><strong>Chế độ đi vắng · báo tin</strong><span id="tg-sub">Chưa kiểm tra</span></div>
                <label class="mplis-toggle-sw"><input type="checkbox" id="tg-on" ${isOn() ? "checked" : ""}><span class="mplis-toggle-track"></span></label>
            </div>
            <div style="display:flex; align-items:baseline; gap:8px; margin-top:6px;">
                <span id="tg-total" style="font-size:30px; font-weight:800; color:var(--mplis-accent-2); font-variant-numeric:tabular-nums;">—</span>
                <span style="font-size:12px; color:var(--mplis-text-dim);">bộ đang chờ xử lý</span>
            </div>
            <div id="tg-recv" style="font-size:12px; color:var(--mplis-text); margin-top:2px;"></div>
            <div id="tg-msg" class="mplis-hint" title="Bấm để copy" style="margin:6px 0 0; cursor:pointer; user-select:text !important;"></div>
            <div style="display:flex; gap:6px; margin-top:8px;">
                <button type="button" class="mplis-btn-primary" id="tg-check" style="flex:1; padding:8px;">Kiểm tra ngay</button>
                <button type="button" class="mplis-btn-ghost" id="tg-test" style="padding:8px 12px;">Gửi thử</button>
            </div>
        </div>
        <div class="mplis-card" id="tg-list" style="max-height:260px; overflow-y:auto;"></div>
        <div class="mplis-card mplis-collapse" id="tg-cfg-card">
            <button type="button" class="mplis-collapse-head" id="tg-cfg-toggle" aria-expanded="false">
                <span class="mplis-section-label">Kênh báo tin</span>
                <span class="mplis-collapse-state" id="tg-cfg-state">${telegramSan() || zaloSan() ? "Đã nhập" : "Chưa nhập"}</span>
                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="mplis-collapse-body">
                ${khoiKenh("tg", "Telegram", '<input type="text" id="tg-token" placeholder="API Key" autocomplete="off" spellcheck="false" style="width:100%; padding:8px; font-size:12px; margin-bottom:6px; color:#f0f4fc !important; -webkit-text-security:disc; text-security:disc;"><input type="text" id="tg-chat" placeholder="Chat ID" autocomplete="off" spellcheck="false" style="width:100%; color:#f0f4fc !important; padding:8px; font-size:12px; margin-bottom:6px;">')}
                ${khoiKenh("zl", "Zalo Bot", '<input type="text" id="zl-token" placeholder="Zalo Bot token" autocomplete="off" spellcheck="false" style="width:100%; padding:8px; font-size:12px; margin-bottom:6px; color:#f0f4fc !important; -webkit-text-security:disc; text-security:disc;"><input type="text" id="zl-chat" placeholder="Zalo Chat ID" autocomplete="off" spellcheck="false" style="width:100%; color:#f0f4fc !important; padding:8px; font-size:12px; margin-bottom:6px;">')}
                <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mplis-text-dim);">Kiểm tra mỗi
                    <input type="number" id="tg-sec" min="15" step="5" style="width:64px; padding:5px; text-align:center;"> giây</div>
                <button type="button" class="mplis-btn-ghost" id="tg-reset" style="margin-top:8px; padding:7px 12px; font-size:11.5px;">Xoá lịch sử đã gửi</button>
            </div>
        </div>`;
    },
    init() {
      const el = (id) => document.getElementById(id);
      if (!el("tab-notify")) return;
      el("tab-notify").innerHTML = this.html();
      el("tg-token").value = ls.get(K_TOKEN);
      el("tg-chat").value = ls.get(K_CHAT);
      el("tg-sec").value = ls.get(K_SEC, "30");
      el("zl-token").value = ls.get(K_ZL_TOKEN);
      el("zl-chat").value = ls.get(K_ZL_CHAT);
      ["tg", "zl"].forEach((k) => ["on"].concat(LOAI_TIN.map((x) => x[0])).forEach((l) => {
        el("ch-" + k + "-" + l).onchange = (e) => {
          ls.set("mplis_ch_" + k + "_" + l, e.target.checked ? "true" : "false");
          el("tg-cfg-state").textContent = telegramSan() || zaloSan() ? "Đã nhập" : "Chưa nhập";
          st.msg = "Đã lưu cài đặt " + (k === "tg" ? "Telegram" : "Zalo") + ".";
          render();
        };
      }));
      ["tg", "zl"].forEach((k) => {
        el("ch-" + k + "-lan").oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          if (v >= 1) ls.set("mplis_ch_" + k + "_lan", String(Math.min(10, v)));
        };
        el("ch-" + k + "-gio").oninput = (e) => {
          const v = parseFloat(String(e.target.value).replace(",", "."));
          if (v > 0) ls.set("mplis_ch_" + k + "_gio", String(v));
        };
      });
      const card = el("tg-cfg-card");
      el("tg-cfg-toggle").onclick = () => {
        const o = card.classList.toggle("open");
        el("tg-cfg-toggle").setAttribute("aria-expanded", o ? "true" : "false");
      };
      const saveCfg = () => {
        ls.set(K_TOKEN, el("tg-token").value.trim());
        ls.set(K_CHAT, el("tg-chat").value.trim());
        ls.set(K_SEC, String(Math.max(15, parseInt(el("tg-sec").value, 10) || 30)));
        ls.set(K_ZL_TOKEN, el("zl-token").value.trim());
        ls.set(K_ZL_CHAT, el("zl-chat").value.trim());
        el("tg-cfg-state").textContent = telegramSan() || zaloSan() ? "Đã nhập" : "Chưa nhập";
      };
      ["tg-token", "tg-chat", "tg-sec", "zl-token", "zl-chat"].forEach((id) => {
        el(id).oninput = saveCfg;
      });
      el("tg-on").onchange = (e) => {
        ls.set(K_ON, e.target.checked ? "true" : "false");
        st.msg = e.target.checked ? "Đã bật. Lần kiểm tra tới sẽ báo hồ sơ mới." : "Đã tắt, không gửi tin nào.";
        render();
        if (e.target.checked) tick(false);
      };
      el("tg-check").onclick = () => tick(true);
      el("tg-msg").onclick = () => {
        try {
          GM_setClipboard(el("tg-msg").textContent);
          const cu = st.msg;
          st.msg = "Đã copy dòng trạng thái";
          render();
          setTimeout(() => {
            st.msg = cu;
            render();
          }, 1200);
        } catch (e) {
        }
      };
      el("tg-cfg-card").style.display = "block";
      el("tg-test").onclick = async () => {
        saveCfg();
        try {
          const kq = await guiTatCa("✅ Bot đã kết nối, báo tin được rồi.");
          st.msg = "Gửi thử: " + kq.map(([ten, loi]) => ten + (loi ? " ❌ " + loi : " ✅")).join(" · ");
        } catch (e) {
          st.msg = "❌ Gửi thử lỗi: " + e.message;
        }
        render();
      };
      el("tg-reset").onclick = () => {
        ls.set(K_SEEN, "[]");
        ls.set(K_BASE, "false");
        ls.set(K_NHAC, "[]");
        st.msg = "Đã xoá lịch sử. Lần kiểm tra tới ghi lại mốc, không gửi tin cũ.";
        render();
      };
      render();
      startTimer();
    }
  };

  // src/toggle.js
  function toggleProcess(customStopMessage) {
    const state = ProcessModule.getTopState();
    const btn = document.getElementById("btn-toggle-process");
    if (!state.isRunning && typeof customStopMessage === "string") return;
    if (state.isRunning) {
      state.isRunning = false;
      btn.textContent = "Bắt đầu Xử Lý";
      btn.classList.remove("running");
      const isCustom = typeof customStopMessage === "string";
      const laLoi = isCustom && /LỖI|⚠️/.test(customStopMessage);
      state.lastStopKind = laLoi ? "error" : isCustom ? "done" : "user";
      ProcessModule.getTopState().updateStatus(laLoi ? "Lỗi - đã dừng" : isCustom ? "Hoàn thành" : "Đang dừng", laLoi ? "error" : "idle");
      ProcessModule.getTopState().writeLog(isCustom ? customStopMessage : "Đã dừng hoạt động.");
      if (isCustom) {
        const logEl = document.getElementById("mplis-step-log-process");
        if (logEl) {
          logEl.style.color = customStopMessage.includes("LỖI") ? "#ef4444" : "#10b981";
          logEl.style.fontWeight = "bold";
        }
        setTimeout(() => {
          if (logEl) {
            logEl.style.color = "";
            logEl.style.fontWeight = "";
          }
        }, 1e4);
      }
    } else {
      if (state.config.activeWorkflows.length === 0) return alert("Vui lòng chọn ít nhất 1 quy trình!");
      document.querySelectorAll('*[data-mplis-clicked="true"]').forEach((el) => el.removeAttribute("data-mplis-clicked"));
      state.lastStopKind = null;
      state._qt5Done = false;
      state.tacVuDaXuLy = null;
      state.qt1ConfirmStreak = 0;
      state.isRunning = true;
      btn.textContent = "Tạm dừng Xử Lý";
      btn.classList.add("running");
      ProcessModule.getTopState().updateStatus("Đang chạy", "active");
      let maHS = "";
      try {
        maHS = findCurrentMaHS() || "";
      } catch (e) {
      }
      ProcessModule.getTopState().writeLog("▶ Bắt đầu xử lý hồ sơ" + (maHS ? " " + maHS : ""));
    }
  }

  // src/inject-panel.js
  var svgIcon = (paths, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex-shrink:0;">${paths}</svg>`;
  var ICON_PROCESS = svgIcon('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>');
  var ICON_ALERT = svgIcon('<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>');
  var ICON_EXCEL = svgIcon('<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>');
  var ICON_SETTINGS = svgIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>');
  var ICON_SEARCH = svgIcon('<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>');
  var ICON_BELL = svgIcon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>');
  var ICON_MORE = svgIcon('<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>');
  var ICON_LINK = svgIcon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>', 16);
  var ICON_REFRESH = svgIcon('<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path>', 16);
  function injectPanel() {
    if (document.getElementById("mplis-auto-panel")) return;
    const panel = document.createElement("div");
    panel.id = "mplis-auto-panel";
    panel.classList.add("minimized");
    const pCfg = ProcessModule.getTopState().config;
    const isQT0 = pCfg.activeWorkflows.includes("QT0") ? "checked" : "";
    const isQT1 = pCfg.activeWorkflows.includes("QT1") ? "checked" : "";
    const isQT2 = pCfg.activeWorkflows.includes("QT2") ? "checked" : "";
    const isQT3 = pCfg.activeWorkflows.includes("QT3") ? "checked" : "";
    const isQT4 = pCfg.activeWorkflows.includes("QT4") ? "checked" : "";
    const isAutoConfirmChecked = isAutoConfirmEnabled() ? "checked" : "";
    const isPhapLyAutofillChecked = localStorage.getItem("mplis_phaply_autofill_enabled") !== "false" ? "checked" : "";
    const phapLyNgayVaoSo = (localStorage.getItem("mplis_phaply_ngay_vao_so") || "").trim();
    const hauToTenFile = ["GT", "PT"].includes((localStorage.getItem("mplis_tenfile_hau_to") || "").toUpperCase()) ? localStorage.getItem("mplis_tenfile_hau_to").toUpperCase() : "GT";
    const isTuTichDongBoChecked = localStorage.getItem("mplis_tenfile_tu_tich_dongbo") === "true" ? "checked" : "";
    const MUC_TOC_DO = [
      { key: "thuong", label: "Thường", delay: 500 },
      { key: "nhanh", label: "Nhanh", delay: 250 },
      { key: "toida", label: "Tối đa", delay: 120 }
    ];
    const tocDoHienTai = (MUC_TOC_DO.find((m) => m.delay === pCfg.delayAction) || MUC_TOC_DO[0]).key;
    const isBypassSpatialLinkChecked = localStorage.getItem("mplis_bypass_spatial_link_enabled") === "true" ? "checked" : "";
    const isBypassDaKySoChecked = localStorage.getItem("mplis_bypass_dakyso_enabled") === "true" ? "checked" : "";
    function qt2FileHint(selectAll) {
      return selectAll ? "Tích hết file trong bảng. Giấy chứng nhận chỉ gắn file có Số phát hành khớp của đơn, file khác bỏ qua." : "Chỉ tích file khớp Số phát hành của đơn, cộng file gt/pt dùng chung.";
    }
    function qt2FileState(selectAll) {
      return selectAll ? "Tích hết · gắn theo SPH" : "Lọc theo SPH";
    }
    function fwUserState(user) {
      return (user || "").trim() ? user.trim() : "Chưa đặt";
    }
    function bindCollapse(cardId, toggleId, storageKey) {
      const card = document.getElementById(cardId);
      const toggle = document.getElementById(toggleId);
      if (!card || !toggle) return;
      if (localStorage.getItem(storageKey) === "true") {
        card.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
      toggle.onclick = () => {
        const opened = card.classList.toggle("open");
        toggle.setAttribute("aria-expanded", opened ? "true" : "false");
        localStorage.setItem(storageKey, opened ? "true" : "false");
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
                <div class="mplis-hdr-actions">
                <button class="mplis-btn-minimize" id="mplis-btn-zoom-out" title="Chữ nhỏ lại" aria-label="Chữ nhỏ lại">A-</button>
                <button class="mplis-btn-minimize" id="mplis-btn-zoom-in" title="Chữ to lên" aria-label="Chữ to lên">A+</button>
                <button class="mplis-btn-minimize" id="mplis-btn-size" title="Đổi cỡ khung: vừa / lớn / rất lớn (hoặc kéo góc trên trái)" aria-label="Đổi cỡ khung"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg></button>
                <button class="mplis-btn-minimize" id="mplis-btn-minimize" title="Thu nhỏ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                </button>
                </div>
            </div>

            <div class="mplis-resize" id="mplis-resize" title="Kéo để đổi cỡ khung, bấm đúp để về mặc định"></div>

            <button class="mplis-minimized-trigger" id="mplis-btn-maximize" title="Mở rộng MPLIS Auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </button>

            <div class="mplis-shell">
                <div class="mplis-tabs">
                    <button class="mplis-tab active" data-tab="tab-process" title="Xử lý Quy trình" aria-label="Xử lý Quy trình">${ICON_PROCESS}</button>
                    <button class="mplis-tab" data-tab="tab-alert" title="Nhắc nhở hồ sơ trễ hạn" aria-label="Nhắc nhở hồ sơ trễ hạn">${ICON_ALERT}</button>
                    <button class="mplis-tab" data-tab="tab-excel" title="Xuất dữ liệu Excel" aria-label="Xuất dữ liệu Excel">${ICON_EXCEL}</button>
                    <button class="mplis-tab" data-tab="tab-lookup" title="Tra cứu hồ sơ" aria-label="Tra cứu hồ sơ">${ICON_SEARCH}</button>
                    <button class="mplis-tab" data-tab="tab-notify" title="Thông báo hồ sơ mới" aria-label="Thông báo hồ sơ mới">${ICON_BELL}</button>
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
                            <label title="QT5 · Chuyển tiếp hồ sơ"><input type="checkbox" id="chk-qt5" ${pCfg.isQT5 ? "checked" : ""}> QT5 · Chuyển tiếp</label>
                        </div>

                        <div class="mplis-card mplis-collapse" id="qt2-file-group" style="display: ${isQT2 ? "block" : "none"};">
                            <button type="button" class="mplis-collapse-head" id="qt2-file-toggle" aria-expanded="false" aria-controls="qt2-file-body">
                                <span class="mplis-section-label">QT2 · Bảng chọn file quét</span>
                                <span class="mplis-collapse-state ${pCfg.qt2SelectAllFiles ? "on" : ""}" id="qt2-file-state">${qt2FileState(pCfg.qt2SelectAllFiles)}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="qt2-file-body">
                                <div class="mplis-bypass-row" style="margin-bottom:4px;">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Chọn hết file trong bảng</strong>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-qt2-selectall" ${pCfg.qt2SelectAllFiles ? "checked" : ""}>
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
                                    <button type="button" id="btn-lamoi-thu-muc" class="mplis-btn-ghost" style="padding:9px 12px; flex-shrink:0;" title="Đọc lại thư mục (sau khi đổi tên file). Tool cũng tự đọc lại trước mỗi lần upload.">↻</button>
                                    <button type="button" id="btn-xoa-thu-muc" class="mplis-btn-ghost" style="padding:9px 12px; flex-shrink:0;" title="Xóa thư mục đã chọn">✕</button>
                                </div>
                                <div id="qt-upload-files-status" style="font-size:11.5px; color:var(--mplis-text-dim); margin-bottom:8px; word-break:break-all; line-height:1.5;"></div>
                                <div style="font-size:12px; color:#e2e8f0; margin-bottom:6px;">Số cuối SPH để khớp file GCN:</div>
                                <div id="qt-upload-sochuso-group" role="radiogroup" aria-label="Số chữ số cuối SPH" style="display:flex; gap:6px;">
                                    <button type="button" class="mplis-hauto-btn" data-sochuso="3" role="radio" aria-checked="${(pCfg.qt2SoChuSo || 3) === 3 ? "true" : "false"}" style="flex:1; font-size:11px;" title="TC, XN NN (3 số cuối SPH)">3 số</button>
                                    <button type="button" class="mplis-hauto-btn" data-sochuso="4" role="radio" aria-checked="${(pCfg.qt2SoChuSo || 3) === 4 ? "true" : "false"}" style="flex:1; font-size:11px;" title="GCN khác (4 số cuối SPH)">4 số</button>
                                </div>
                                <div class="mplis-hint" style="margin-top:6px;">VD: SPH <b>08107975</b> → 3 số: <b>975</b> · 4 số: <b>7975</b><br/>File GT.pdf / PT.pdf tự nhận theo đuôi tên.</div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="fw-user-group" style="display: ${pCfg.isQT5 ? "block" : "none"};">
                            <button type="button" class="mplis-collapse-head" id="fw-user-toggle" aria-expanded="false" aria-controls="fw-user-body">
                                <span class="mplis-section-label">Chuyển tiếp (sau khi Kết ISO)</span>
                                <span class="mplis-collapse-state ${pCfg.forwardUser ? "on" : ""}" id="fw-user-state">${escapeHtml(fwUserState(pCfg.forwardUser))}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="fw-user-body">
                                <input type="text" id="cfg-p-forwardUser" value="${escapeHtml(pCfg.forwardUser || "")}" placeholder="Tên tài khoản, VD: dla.thoitd" style="background: rgba(0,0,0,0.25); border: 1px solid var(--mplis-border); border-radius: 8px; padding: 8px 10px; color: #f8fafc; width: 100%; font-size: 12px;">
                                <div class="mplis-hint" style="margin:8px 0 0;">Bỏ trống thì tool dừng lại sau Kết ISO, không chuyển cho ai.</div>
                            </div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="bypass-card" style="display: ${isQT2 || isQT4 ? "block" : "none"};">
                            <button type="button" class="mplis-collapse-head" id="bypass-card-toggle" aria-expanded="false" aria-controls="bypass-card-body">
                                <span class="mplis-section-label">Bypass cảnh báo</span>
                                <span class="mplis-collapse-state" id="bypass-card-state">Tất cả tắt</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="bypass-card-body">
                                <div class="mplis-bypass-row" id="bypass-row-dakyso" style="display: ${isQT2 ? "flex" : "none"};">
                                    <div class="mplis-bypass-row-label">
                                        <strong>QT2 · Ký số GCN</strong>
                                        <span>Bỏ qua lỗi "chưa ký số" khi lưu kho</span>
                                    </div>
                                    <label class="mplis-toggle-sw" title="Tự bỏ qua kiểm tra ký số Giấy chứng nhận khi lưu kho hồ sơ quét">
                                        <input type="checkbox" id="chk-bypass-dakyso" ${isBypassDaKySoChecked}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                                <div class="mplis-bypass-row" id="bypass-row-kg" style="display: ${isQT4 ? "flex" : "none"};">
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
                                    ${MUC_TOC_DO.map((m) => `<button type="button" class="mplis-hauto-btn" data-tocdo="${m.key}" role="radio" aria-checked="${m.key === tocDoHienTai ? "true" : "false"}" style="min-height:28px; padding:4px 9px !important; font-size:11px !important;">${m.label}</button>`).join("")}
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; margin-top:7px;">
                                <input type="range" id="tocdo-slider" min="100" max="1000" step="50" value="${pCfg.delayAction || 500}"
                                    aria-label="Thời gian nghỉ giữa 2 thao tác (mili giây)"
                                    style="flex:1; min-width:0; cursor:pointer;">
                                <span id="tocdo-value" style="flex-shrink:0; min-width:54px; text-align:right; font-size:11px; font-weight:700; color:var(--mplis-accent-2); font-variant-numeric:tabular-nums;"></span>
                            </div>
                        </div>

                        <div class="mplis-card" style="padding:8px 9px;">
                            <span class="mplis-section-label" style="margin-bottom:4px;">Người chuyển hồ sơ</span>
                            <div id="qt-sender-list"></div>
                        </div>

                        <div class="mplis-card mplis-collapse" id="proc-log-group" style="margin-top:8px;">
                            <button type="button" class="mplis-collapse-head" id="proc-log-toggle" aria-expanded="false" aria-controls="proc-log-body">
                                <span class="mplis-section-label">Nhật ký xử lý</span>
                                <span class="mplis-collapse-state" id="proc-log-count-process" style="font-variant-numeric:tabular-nums;">0</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="proc-log-body">
                                <div class="mplis-bypass-row" style="padding-top:0;">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Ghi nhật ký</strong>
                                        <span>Tắt thì không ghi thêm dòng nào (dòng trạng thái vẫn chạy).</span>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-proc-log-enabled" ${localStorage.getItem("mplis_proc_log_enabled") !== "false" ? "checked" : ""}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>
                                <div id="mplis-log-area-process" style="max-height:180px; overflow-y:auto; font-family:'Consolas','Cascadia Code',monospace; font-size:11px; line-height:1.65; color:var(--mplis-text-dim); background:rgba(0,0,0,0.25); border-radius:6px; padding:6px 8px; word-break:break-all;"></div>
                                <div style="display:flex; gap:6px; margin-top:6px;">
                                    <button type="button" id="btn-proc-log-copy" class="mplis-btn-ghost" style="flex:1; font-size:11.5px; padding:7px;" title="Copy nhật ký dễ đọc">Copy nhật ký</button>
                                    <button type="button" id="btn-proc-log-copy-raw" class="mplis-btn-ghost" style="flex:1; font-size:11.5px; padding:7px;" title="Bản đầy đủ cho người dò lỗi - gửi bản này khi cần hỗ trợ">Copy log kỹ thuật</button>
                                    <button type="button" id="btn-proc-log-clear" class="mplis-btn-ghost" style="padding:7px 14px; font-size:11.5px;">Xóa</button>
                                </div>
                            </div>
                        </div>

                        <div class="mplis-runbar">
                            <div class="mplis-run-summary" id="mplis-run-summary"></div>
                            <button class="mplis-btn-primary" id="btn-toggle-process">Bắt đầu Xử Lý</button>
                            <div class="mplis-status-bar">
                                <div class="mplis-status-row">
                                    <div class="mplis-status-lbl"><span class="mplis-status-dot" id="mplis-status-dot-process"></span><span id="mplis-status-text-process">Đang dừng</span></div>
                                    <div style="color: var(--mplis-text-dim);">Thành công: <span id="mplis-counter-val-process" style="color: var(--mplis-accent-2); font-weight: bold;">0</span></div>
                                </div>
                                <div class="mplis-log" id="mplis-step-log-process">Sẵn sàng</div>
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


                    <!-- TAB LOOKUP -->
                    <div class="mplis-panel-body" id="tab-lookup">
                        <div class="mplis-lk-bar">
                            <input type="text" id="lookup-input" placeholder="Gõ đuôi mã hồ sơ, VD: 0402 hoặc 9-0402" autocomplete="off">
                            <button type="button" class="mplis-btn-primary" id="btn-lookup">Tìm</button>
                        </div>
                        <div class="mplis-hint" id="lookup-info" style="margin:6px 0 8px;">Gõ một phần mã rồi Enter, tool tự thêm % phía trước.</div>
                        <div id="lookup-results"></div>
                    </div>

                    <!-- TAB NOTIFY -->
                    <div class="mplis-panel-body" id="tab-notify"></div>

                    <!-- TAB 6: SETTINGS -->
                    <!-- Mỗi mục là 1 thẻ thu gọn: đóng lại chỉ còn tiêu đề + trạng thái, nên tab
                         Cài đặt không dài tới mức phải cuộn mới thấy mục cuối. Trạng thái nằm trên
                         thanh tiêu đề để đóng vẫn biết đang bật/tắt gì. -->
                    <div class="mplis-panel-body" id="tab-settings">
                        <div class="mplis-card mplis-collapse" id="set-safe-group">
                            <button type="button" class="mplis-collapse-head" id="set-safe-toggle" aria-expanded="false" aria-controls="set-safe-body">
                                <span class="mplis-section-label">An toàn</span>
                                <span class="mplis-collapse-state ${isAutoConfirmChecked ? "on" : ""}" id="set-safe-state">${isAutoConfirmChecked ? "Tự đồng ý" : "Hỏi tay"}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-safe-body">
                                <div class="mplis-bypass-row">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Tự đồng ý hộp thoại</strong>
                                        <span>Chỉ khi auto đang chạy; lúc bạn tự thao tác vẫn hỏi như thường. Tắt nếu muốn tự xác nhận cả những hộp thoại gốc của trình duyệt. Cần <b>tải lại trang</b>.</span>
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
                                <span class="mplis-collapse-state ${isPhapLyAutofillChecked ? "on" : ""}" id="set-autofill-state">${isPhapLyAutofillChecked ? phapLyNgayVaoSo ? "Bật · ngày cố định" : "Bật · hôm nay" : "Tắt"}</span>
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
                                    <button type="button" class="mplis-hauto-btn" data-hauto="GT" aria-checked="${hauToTenFile === "GT" ? "true" : "false"}" role="radio" style="flex:1; min-height:34px;">GT</button>
                                    <button type="button" class="mplis-hauto-btn" data-hauto="PT" aria-checked="${hauToTenFile === "PT" ? "true" : "false"}" role="radio" style="flex:1; min-height:34px;">PT</button>
                                </div>
                                <div id="tenfile-hauto-state" style="margin-top:8px; font-size:11.5px; color:var(--mplis-text-dim); line-height:1.6;"></div>

                                <div class="mplis-bypass-row" style="margin-top:10px; padding-top:10px; border-top:1px solid var(--mplis-border);">
                                    <div class="mplis-bypass-row-label">
                                        <strong>Tự tạo đủ dòng GCN + GT/PT</strong>
                                        <span>Mở bảng giấy tờ đính kèm là tự thêm hết dòng, khỏi bấm "Tạo đủ".</span>
                                    </div>
                                    <label class="mplis-toggle-sw">
                                        <input type="checkbox" id="chk-tenfile-tuthem" ${localStorage.getItem("mplis_tenfile_tu_them") !== "false" ? "checked" : ""}>
                                        <span class="mplis-toggle-track"></span>
                                    </label>
                                </div>

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
                                <span class="mplis-collapse-state on" id="set-speed-state">${MUC_TOC_DO.find((m) => m.key === tocDoHienTai).label}</span>
                                <svg class="mplis-collapse-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="mplis-collapse-body" id="set-speed-body">
                                <div id="tocdo-group" role="radiogroup" aria-label="Tốc độ chạy quy trình" style="display:flex; gap:6px;">
                                    ${MUC_TOC_DO.map((m) => `<button type="button" class="mplis-hauto-btn" data-tocdo="${m.key}" role="radio" aria-checked="${m.key === tocDoHienTai ? "true" : "false"}" style="flex:1; min-height:34px;">${m.label}</button>`).join("")}
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
    function veBadge(id, chu, on) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = chu;
      el.classList.toggle("on", !!on);
    }
    const chkAutoConfirm = document.getElementById("chk-auto-confirm");
    if (chkAutoConfirm) {
      chkAutoConfirm.onchange = (e) => {
        localStorage.setItem("mplis_auto_confirm_override", e.target.checked ? "true" : "false");
        const settingsTab = document.getElementById("tab-settings");
        let notice = document.getElementById("auto-confirm-notice");
        if (!notice && settingsTab) {
          notice = document.createElement("div");
          notice.id = "auto-confirm-notice";
          notice.style.cssText = "margin-top:8px; font-size:12px; color:#f59e0b; font-weight:600;";
          settingsTab.insertBefore(notice, settingsTab.children[1]);
        }
        veBadge("set-safe-state", e.target.checked ? "Tự đồng ý" : "Hỏi tay", e.target.checked);
        if (notice) notice.textContent = "⚠️ Đã lưu. Tải lại trang (F5) để áp dụng thay đổi.";
      };
    }
    const chkPhapLyAutofill = document.getElementById("chk-phaply-autofill");
    if (chkPhapLyAutofill) {
      chkPhapLyAutofill.onchange = (e) => {
        localStorage.setItem("mplis_phaply_autofill_enabled", e.target.checked ? "true" : "false");
        const coNgay = !!(document.getElementById("cfg-phaply-ngay-vao-so") || {}).value;
        veBadge(
          "set-autofill-state",
          e.target.checked ? coNgay ? "Bật · ngày cố định" : "Bật · hôm nay" : "Tắt",
          e.target.checked
        );
      };
    }
    const inpPhapLyNgay = document.getElementById("cfg-phaply-ngay-vao-so");
    const statePhapLyNgay = document.getElementById("phaply-ngay-state");
    if (inpPhapLyNgay && statePhapLyNgay) {
      const veTrangThai = () => {
        const val = inpPhapLyNgay.value.trim();
        if (!val) {
          statePhapLyNgay.style.color = "var(--mplis-text-dim)";
          statePhapLyNgay.textContent = "Đang để trống: tự điền ngày hôm nay.";
          return;
        }
        const [yyyy, mm, dd] = val.split("-");
        statePhapLyNgay.style.color = "#f59e0b";
        statePhapLyNgay.textContent = "⚠️ Cố định " + dd + "/" + mm + "/" + yyyy + ' cho mọi hồ sơ. Bấm "Hôm nay" để trả về mặc định.';
      };
      const luuNgay = () => {
        try {
          localStorage.setItem("mplis_phaply_ngay_vao_so", inpPhapLyNgay.value.trim());
        } catch (e) {
        }
        veTrangThai();
        const bat = (document.getElementById("chk-phaply-autofill") || {}).checked;
        veBadge(
          "set-autofill-state",
          bat ? inpPhapLyNgay.value.trim() ? "Bật · ngày cố định" : "Bật · hôm nay" : "Tắt",
          bat
        );
      };
      inpPhapLyNgay.onchange = luuNgay;
      inpPhapLyNgay.oninput = luuNgay;
      const btnNgayHomNay = document.getElementById("btn-phaply-ngay-hom-nay");
      if (btnNgayHomNay) {
        btnNgayHomNay.onclick = () => {
          inpPhapLyNgay.value = "";
          luuNgay();
        };
      }
      veTrangThai();
    }
    const hauToGroup = document.getElementById("tenfile-hauto-group");
    const hauToState = document.getElementById("tenfile-hauto-state");
    if (hauToGroup && hauToState) {
      const veHauTo = (hauTo) => {
        hauToGroup.querySelectorAll(".mplis-hauto-btn").forEach((b) => {
          const on = b.dataset.hauto === hauTo;
          b.setAttribute("aria-checked", on ? "true" : "false");
          b.classList.toggle("on", on);
        });
        veBadge("set-tenfile-state", hauTo, true);
        hauToState.innerHTML = 'Giấy tờ kèm: <b style="color:#fff;">&lt;mã hồ sơ&gt;-' + hauTo + '.pdf</b> — không tích ô đồng bộ một cửa.<br/>Giấy chứng nhận: <b style="color:#fff;">&lt;mã hồ sơ&gt;-&lt;Số phát hành&gt;.pdf</b> — tích ô đồng bộ một cửa.<br/>Phím tắt: <b style="color:#fff;">Alt+D</b> giấy chứng nhận, <b style="color:#fff;">Alt+G</b> giấy tờ kèm.';
      };
      hauToGroup.querySelectorAll(".mplis-hauto-btn").forEach((b) => {
        b.onclick = () => {
          const hauTo = b.dataset.hauto;
          try {
            localStorage.setItem("mplis_tenfile_hau_to", hauTo);
          } catch (e) {
          }
          veHauTo(hauTo);
        };
      });
      veHauTo(hauToTenFile);
    }
    const chkTenFileTuThem = document.getElementById("chk-tenfile-tuthem");
    if (chkTenFileTuThem) {
      chkTenFileTuThem.onchange = (e) => {
        localStorage.setItem("mplis_tenfile_tu_them", e.target.checked ? "true" : "false");
      };
    }
    const chkTenFileDongBo = document.getElementById("chk-tenfile-dongbo");
    if (chkTenFileDongBo) {
      chkTenFileDongBo.onchange = (e) => {
        localStorage.setItem("mplis_tenfile_tu_tich_dongbo", e.target.checked ? "true" : "false");
      };
    }
    const tocDoSlider = document.getElementById("tocdo-slider");
    const tocDoValue = document.getElementById("tocdo-value");
    const tocDoState = document.getElementById("tocdo-state");
    const nhomTocDo = ["tocdo-group", "tocdo-group-main"].map((id) => document.getElementById(id)).filter(Boolean);
    function tenMucTocDo(delay) {
      const khop = MUC_TOC_DO.find((m) => m.delay === delay);
      if (khop) return khop.label;
      if (delay <= 200) return "Tuỳ chỉnh · rất nhanh";
      if (delay >= 700) return "Tuỳ chỉnh · chậm";
      return "Tuỳ chỉnh";
    }
    function veTomTat() {
      const el = document.getElementById("mplis-run-summary");
      if (!el) return;
      const c = ProcessModule.getTopState().config;
      const buoc = (c.activeWorkflows || []).slice().sort();
      const chuyen = c.isQT5 && c.forwardUser;
      if (chuyen) buoc.push("QT5");
      if (!buoc.length) {
        el.textContent = "Chưa chọn quy trình nào";
        return;
      }
      el.innerHTML = "Sẽ chạy: <b>" + buoc.join(" · ") + "</b>" + (chuyen ? " → chuyển cho <b>" + escapeHtml(c.forwardUser) + "</b>" : "") + (c.isQT5 && !c.forwardUser ? " · QT5 chưa có người nhận" : "") + " · tốc độ <b>" + escapeHtml(tenMucTocDo(c.delayAction || 500).toLowerCase()) + "</b>";
    }
    function veTocDo(delay) {
      const muc = MUC_TOC_DO.find((m) => m.delay === delay);
      nhomTocDo.forEach((g) => g.querySelectorAll(".mplis-hauto-btn").forEach((b) => {
        const on = !!muc && b.dataset.tocdo === muc.key;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.classList.toggle("on", on);
      }));
      if (tocDoSlider && Number(tocDoSlider.value) !== delay) tocDoSlider.value = delay;
      if (tocDoValue) {
        tocDoValue.textContent = delay + "ms";
        tocDoValue.title = tenMucTocDo(delay);
      }
      veBadge("set-speed-state", tenMucTocDo(delay), true);
      veTomTat();
      if (tocDoState) {
        tocDoState.innerHTML = 'Nghỉ giữa 2 thao tác: <b style="color:#fff;">' + delay + 'ms</b> · vòng quét 400ms. Kéo thanh ở tab Xử lý để chỉnh từng 50ms.<br/>Số càng nhỏ chạy càng sát; mạng hoặc cổng chậm mà để dưới <b style="color:#fff;">200ms</b> thì dễ bấm lúc trang chưa dựng xong, auto gặp hộp thoại lạ rồi tự dừng.';
      }
    }
    function datTocDo(delay) {
      const d = Math.min(1e3, Math.max(100, Number(delay) || 500));
      ProcessModule.saveConfig({ delayOpen: d, delayAction: d, delayNext: d });
      veTocDo(d);
    }
    nhomTocDo.forEach((g) => g.querySelectorAll(".mplis-hauto-btn").forEach((b) => {
      b.onclick = () => {
        const muc = MUC_TOC_DO.find((m) => m.key === b.dataset.tocdo) || MUC_TOC_DO[0];
        datTocDo(muc.delay);
      };
    }));
    if (tocDoSlider) tocDoSlider.oninput = () => datTocDo(tocDoSlider.value);
    if (nhomTocDo.length || tocDoSlider) veTocDo(pCfg.delayAction || 500);
    function veBypassCardState() {
      const kg = (document.getElementById("chk-bypass-kg") || {}).checked;
      const dakyso = (document.getElementById("chk-bypass-dakyso") || {}).checked;
      const count = (kg ? 1 : 0) + (dakyso ? 1 : 0);
      veBadge("bypass-card-state", count === 0 ? "Tất cả tắt" : count === 1 ? "1 bypass bật" : "2 bypass bật", count > 0);
    }
    const chkBypassSpatialLink = document.getElementById("chk-bypass-kg");
    if (chkBypassSpatialLink) {
      chkBypassSpatialLink.onchange = (e) => {
        localStorage.setItem("mplis_bypass_spatial_link_enabled", e.target.checked ? "true" : "false");
        veBypassCardState();
      };
    }
    const chkBypassDaKySo = document.getElementById("chk-bypass-dakyso");
    if (chkBypassDaKySo) {
      chkBypassDaKySo.onchange = (e) => {
        localStorage.setItem("mplis_bypass_dakyso_enabled", e.target.checked ? "true" : "false");
        veBypassCardState();
      };
    }
    veBypassCardState();
    if (localStorage.getItem("mplis_auto_minimized") === "true") panel.classList.add("minimized");
    document.getElementById("mplis-btn-minimize").onclick = () => {
      panel.classList.add("minimized");
      localStorage.setItem("mplis_auto_minimized", "true");
    };
    document.getElementById("mplis-btn-maximize").onclick = () => {
      panel.classList.remove("minimized");
      localStorage.setItem("mplis_auto_minimized", "false");
    };
    const SIZE_KEY = "mplis_panel_size";
    const ZOOM_KEY = "mplis_panel_zoom";
    const SIZE_PRESETS = [null, { w: 560, h: 640 }, { w: 880, h: 820 }];
    let sizePreset = 0;
    function applySize(sz) {
      if (!sz) {
        panel.classList.remove("sized");
        panel.style.removeProperty("--mplis-w");
        panel.style.removeProperty("--mplis-h");
        return;
      }
      const w = Math.max(340, Math.min(sz.w, window.innerWidth - 32));
      const h = Math.max(300, Math.min(sz.h, window.innerHeight - 32));
      panel.classList.add("sized");
      panel.style.setProperty("--mplis-w", w + "px");
      panel.style.setProperty("--mplis-h", h + "px");
    }
    function saveSize(sz) {
      try {
        localStorage.setItem(SIZE_KEY, sz ? JSON.stringify(sz) : "");
      } catch (e) {
      }
    }
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
      if (saved && saved.w && saved.h) {
        applySize(saved);
        sizePreset = -1;
      }
    } catch (e) {
    }
    document.getElementById("mplis-btn-size").onclick = () => {
      sizePreset = (sizePreset + 1) % SIZE_PRESETS.length;
      applySize(SIZE_PRESETS[sizePreset]);
      saveSize(SIZE_PRESETS[sizePreset]);
    };
    const resizeHandle = document.getElementById("mplis-resize");
    resizeHandle.ondblclick = () => {
      sizePreset = 0;
      applySize(null);
      saveSize(null);
    };
    resizeHandle.onpointerdown = (e) => {
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY, startW = rect.width, startH = rect.height;
      resizeHandle.setPointerCapture(e.pointerId);
      let last = null;
      resizeHandle.onpointermove = (ev) => {
        last = { w: Math.round(startW + (startX - ev.clientX)), h: Math.round(startH + (startY - ev.clientY)) };
        applySize(last);
      };
      resizeHandle.onpointerup = () => {
        resizeHandle.onpointermove = null;
        resizeHandle.onpointerup = null;
        if (last) {
          sizePreset = -1;
          saveSize(last);
        }
      };
    };
    const ZOOM_MIN = 0.9, ZOOM_MAX = 1.6;
    let zoom = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1;
    function applyZoom(z) {
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
      panel.style.setProperty("--mplis-zoom", String(zoom));
      try {
        localStorage.setItem(ZOOM_KEY, String(zoom));
      } catch (e) {
      }
    }
    applyZoom(zoom);
    document.getElementById("mplis-btn-zoom-in").onclick = () => applyZoom(zoom + 0.1);
    document.getElementById("mplis-btn-zoom-out").onclick = () => applyZoom(zoom - 0.1);
    document.querySelectorAll(".mplis-tab").forEach((tab) => {
      tab.onclick = () => {
        const content = document.querySelector(".mplis-content");
        const startHeight = content.getBoundingClientRect().height;
        document.querySelectorAll(".mplis-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".mplis-panel-body").forEach((b) => b.classList.remove("active"));
        tab.classList.add("active");
        const targetId = tab.getAttribute("data-tab");
        document.getElementById(targetId).classList.add("active");
        content.style.transition = "none";
        content.style.minHeight = "0px";
        const endHeight = content.scrollHeight;
        content.style.minHeight = startHeight + "px";
        void content.offsetHeight;
        content.style.transition = "";
        requestAnimationFrame(() => {
          content.style.minHeight = endHeight + "px";
        });
      };
    });
    const extraTabs = document.querySelectorAll(".mplis-tab-extra");
    const btnToggleExtra = document.getElementById("mplis-btn-toggle-extra");
    function setExtraTabsVisible(visible) {
      extraTabs.forEach((t) => {
        t.style.display = visible ? "" : "none";
      });
      if (btnToggleExtra) {
        btnToggleExtra.classList.toggle("expanded", visible);
        btnToggleExtra.title = visible ? "Ẩn bớt tab" : "Hiện thêm tab";
      }
      localStorage.setItem("mplis_extra_tabs_visible", visible ? "true" : "false");
    }
    let extraTabsVisible = localStorage.getItem("mplis_extra_tabs_visible") === "true";
    setExtraTabsVisible(extraTabsVisible);
    if (btnToggleExtra) {
      btnToggleExtra.onclick = () => {
        extraTabsVisible = !extraTabsVisible;
        setExtraTabsVisible(extraTabsVisible);
        if (!extraTabsVisible) {
          const activeExtra = Array.from(extraTabs).find((t) => t.classList.contains("active"));
          if (activeExtra) document.querySelector('.mplis-tab[data-tab="tab-process"]').click();
        }
      };
    }
    document.getElementById("chk-qt5").onchange = (e) => {
      const checked = e.target.checked;
      document.getElementById("fw-user-group").style.display = checked ? "block" : "none";
      ProcessModule.saveConfig({ isQT5: checked });
      veTomTat();
    };
    document.getElementById("cfg-p-forwardUser").oninput = (e) => {
      const user = e.target.value.trim();
      const stateEl = document.getElementById("fw-user-state");
      stateEl.textContent = fwUserState(user);
      stateEl.classList.toggle("on", !!user);
      ProcessModule.saveConfig({ forwardUser: user });
      veTomTat();
    };
    const folderPickerEl = document.getElementById("mplis-folder-picker");
    const btnChonThuMuc = document.getElementById("btn-chon-thu-muc");
    const btnXoaThuMuc = document.getElementById("btn-xoa-thu-muc");
    const uploadStatusEl = document.getElementById("qt-upload-files-status");
    const uploadStateEl = document.getElementById("qt-upload-state");
    const soChuSoGroup = document.getElementById("qt-upload-sochuso-group");
    function veUploadState(files) {
      const n = files ? files.length : 0;
      if (n > 0) {
        const preview = files.slice(0, 3).map((f) => f.name).join(", ");
        if (uploadStatusEl) uploadStatusEl.textContent = n + " file: " + preview + (n > 3 ? " ... (+" + (n - 3) + ")" : "");
        if (uploadStateEl) {
          uploadStateEl.textContent = n + " file";
          uploadStateEl.classList.add("on");
        }
      } else {
        if (uploadStatusEl) uploadStatusEl.textContent = "";
        if (uploadStateEl) {
          uploadStateEl.textContent = "Chưa chọn";
          uploadStateEl.classList.remove("on");
        }
      }
    }
    function veSoChuSo(n) {
      if (!soChuSoGroup) return;
      soChuSoGroup.querySelectorAll(".mplis-hauto-btn").forEach((b) => {
        const on = parseInt(b.dataset.sochuso) === n;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.classList.toggle("on", on);
      });
    }
    veSoChuSo(pCfg.qt2SoChuSo || 3);
    if (soChuSoGroup) {
      soChuSoGroup.querySelectorAll(".mplis-hauto-btn").forEach((b) => {
        b.onclick = () => {
          const n = parseInt(b.dataset.sochuso);
          ProcessModule.saveConfig({ qt2SoChuSo: n });
          veSoChuSo(n);
        };
      });
    }
    async function docThuMuc(handle, prefix, out, depth) {
      for await (const [name, h] of handle.entries()) {
        if (h.kind === "file") {
          if (!/\.pdf$/i.test(name)) continue;
          const f = await h.getFile();
          try {
            Object.defineProperty(f, "webkitRelativePath", { value: prefix + name });
          } catch (e) {
          }
          out.push(f);
        } else if (depth < 3) {
          await docThuMuc(h, prefix + name + "/", out, depth + 1);
        }
      }
    }
    function gachChanThuMuc(ts, handle) {
      ts.uploadDirHandle = handle;
      ts.refreshUploadFolder = async () => {
        if (!ts.uploadDirHandle) return;
        const out = [];
        await docThuMuc(ts.uploadDirHandle, ts.uploadDirHandle.name + "/", out, 0);
        const cu = (ts.uploadFolderFiles || []).map((f) => f.name).join("|");
        ts.uploadFolderFiles = out;
        if (cu !== out.map((f) => f.name).join("|")) veUploadState(out);
      };
      return ts.refreshUploadFolder();
    }
    if (btnChonThuMuc && folderPickerEl) {
      btnChonThuMuc.onclick = async () => {
        const ts = ProcessModule.getTopState();
        if (ts && typeof window.showDirectoryPicker === "function") {
          try {
            const handle = await window.showDirectoryPicker({ mode: "read" });
            await gachChanThuMuc(ts, handle);
            return;
          } catch (e) {
            if (e && e.name === "AbortError") return;
            console.log("[MPLIS Upload] showDirectoryPicker lỗi, dùng cách chọn thư mục thường:", e);
          }
        }
        folderPickerEl.click();
      };
      folderPickerEl.onchange = () => {
        const files = Array.from(folderPickerEl.files || []);
        const ts = ProcessModule.getTopState();
        if (ts) {
          ts.uploadFolderFiles = files;
          ts.uploadDirHandle = null;
          ts.refreshUploadFolder = null;
        }
        veUploadState(files);
        folderPickerEl.value = "";
      };
    }
    const btnLamMoiThuMuc = document.getElementById("btn-lamoi-thu-muc");
    if (btnLamMoiThuMuc) {
      btnLamMoiThuMuc.onclick = async () => {
        const ts = ProcessModule.getTopState();
        if (ts && ts.refreshUploadFolder) {
          try {
            await ts.refreshUploadFolder();
          } catch (e) {
            console.log("[MPLIS Upload] Không đọc lại được thư mục:", e);
          }
        }
      };
    }
    if (btnXoaThuMuc) {
      btnXoaThuMuc.onclick = () => {
        const ts = ProcessModule.getTopState();
        if (ts) {
          ts.uploadFolderFiles = [];
          ts.uploadDirHandle = null;
          ts.refreshUploadFolder = null;
        }
        veUploadState(null);
      };
    }
    veUploadState(null);
    bindCollapse("proc-log-group", "proc-log-toggle", "mplis_proc_log_open");
    const chkProcLog = document.getElementById("chk-proc-log-enabled");
    const veProcLogBadge = () => {
      const b = document.getElementById("proc-log-count-process");
      const on = localStorage.getItem("mplis_proc_log_enabled") !== "false";
      if (b && !on) b.textContent = "Tắt";
    };
    if (chkProcLog) {
      chkProcLog.onchange = (e) => {
        localStorage.setItem("mplis_proc_log_enabled", e.target.checked ? "true" : "false");
        const b = document.getElementById("proc-log-count-process");
        const ts = ProcessModule.getTopState();
        if (b) b.textContent = e.target.checked ? String(ts && ts.logBuffer.length || 0) : "Tắt";
      };
      veProcLogBadge();
    }
    const copyNhatKy = (btnId, laBanGoc) => {
      const ts = ProcessModule.getTopState();
      const lines = (ts && ts.logBuffer || []).filter((e) => laBanGoc || e.nice !== null).map((e) => {
        const hh = new Date(e.t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return "[" + hh + "] " + (laBanGoc ? e.msg : e.nice);
      }).join("\n");
      if (!lines) return;
      try {
        GM_setClipboard(lines);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = lines;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      const btn = document.getElementById(btnId);
      if (btn) {
        const old = btn.textContent;
        btn.textContent = "Đã copy!";
        setTimeout(() => btn.textContent = old, 1800);
      }
    };
    document.getElementById("btn-proc-log-copy").onclick = () => copyNhatKy("btn-proc-log-copy", false);
    document.getElementById("btn-proc-log-copy-raw").onclick = () => copyNhatKy("btn-proc-log-copy-raw", true);
    document.getElementById("btn-proc-log-clear").onclick = () => {
      const ts = ProcessModule.getTopState();
      if (ts) ts.logBuffer = [];
      const area = document.getElementById("mplis-log-area-process");
      if (area) area.innerHTML = "";
      const badge = document.getElementById("proc-log-count-process");
      if (badge) badge.textContent = "0";
    };
    bindCollapse("bypass-card", "bypass-card-toggle", "mplis_bypass_card_open");
    bindCollapse("qt2-file-group", "qt2-file-toggle", "mplis_qt2_file_open");
    bindCollapse("qt-upload-group", "qt-upload-toggle", "mplis_qt_upload_open");
    bindCollapse("fw-user-group", "fw-user-toggle", "mplis_fw_user_open");
    bindCollapse("set-safe-group", "set-safe-toggle", "mplis_set_safe_open");
    bindCollapse("set-autofill-group", "set-autofill-toggle", "mplis_set_autofill_open");
    bindCollapse("set-tenfile-group", "set-tenfile-toggle", "mplis_set_tenfile_open");
    bindCollapse("set-speed-group", "set-speed-toggle", "mplis_set_speed_open");
    bindCollapse("set-keys-group", "set-keys-toggle", "mplis_set_keys_open");
    bindCollapse("set-log-group", "set-log-toggle", "mplis_set_log_open");
    function veLogState() {
      const n = getLogCount();
      const el = document.getElementById("set-log-state");
      if (el) {
        el.textContent = n + " mục";
        el.classList.toggle("on", n > 0);
      }
      const preview = document.getElementById("log-preview");
      if (preview) {
        if (n === 0) {
          preview.textContent = "Chưa có dữ liệu. Thao tác trên trang để ghi log.";
        } else {
          try {
            const all = JSON.parse(getLogJson());
            preview.textContent = all.slice(-8).map((e) => {
              const time = new Date(e.t).toLocaleTimeString("vi-VN");
              if (e.type === "fetch") return `[${time}] ${e.method} ${e.ep} → ${e.status}`;
              if (e.type === "jsError") return `[${time}] ERR ${e.msg}`;
              if (e.type === "rejection") return `[${time}] REJECT ${e.msg?.slice(0, 60)}`;
              return `[${time}] ${e.type} ${e.action || ""}`;
            }).join("\n");
          } catch {
          }
        }
      }
    }
    document.getElementById("btn-log-copy").onclick = () => {
      try {
        GM_setClipboard(getLogJson());
        const btn = document.getElementById("btn-log-copy");
        if (btn) {
          btn.textContent = "Đã copy!";
          setTimeout(() => {
            btn.textContent = "Copy log";
          }, 1800);
        }
      } catch (e) {
        alert("Copy thất bại: " + e.message);
      }
    };
    document.getElementById("btn-log-clear").onclick = () => {
      clearLog();
      veLogState();
    };
    const chkLogEnabled = document.getElementById("chk-log-enabled");
    if (chkLogEnabled) {
      chkLogEnabled.checked = isLogEnabled();
      chkLogEnabled.onchange = () => setLogEnabled(chkLogEnabled.checked);
    }
    document.getElementById("set-log-toggle")?.addEventListener("click", () => {
      setTimeout(veLogState, 50);
    });
    setInterval(() => {
      const settingsTab = document.getElementById("tab-settings");
      if (settingsTab && settingsTab.classList.contains("active")) veLogState();
    }, 5e3);
    document.getElementById("chk-qt2-selectall").onchange = (e) => {
      const checked = e.target.checked;
      document.getElementById("qt2-file-hint").textContent = qt2FileHint(checked);
      const stateEl = document.getElementById("qt2-file-state");
      stateEl.textContent = qt2FileState(checked);
      stateEl.classList.toggle("on", checked);
      ProcessModule.saveConfig({ qt2SelectAllFiles: checked });
    };
    document.querySelectorAll('input[name="mplis-workflow"]').forEach((cb) => {
      cb.onchange = () => {
        const checked = Array.from(document.querySelectorAll('input[name="mplis-workflow"]:checked')).map((c) => c.value);
        ProcessModule.saveConfig({ activeWorkflows: checked });
        veTomTat();
        const qt2Group = document.getElementById("qt2-file-group");
        if (qt2Group) qt2Group.style.display = checked.includes("QT2") ? "block" : "none";
        const hasQT2 = checked.includes("QT2"), hasQT4 = checked.includes("QT4");
        const bypassCard = document.getElementById("bypass-card");
        if (bypassCard) bypassCard.style.display = hasQT2 || hasQT4 ? "block" : "none";
        const rowDakyso = document.getElementById("bypass-row-dakyso");
        if (rowDakyso) rowDakyso.style.display = hasQT2 ? "flex" : "none";
        const rowKg = document.getElementById("bypass-row-kg");
        if (rowKg) rowKg.style.display = hasQT4 ? "flex" : "none";
      };
    });
    document.getElementById("btn-toggle-process").onclick = toggleProcess;
    LookupModule.init();
    NotifyModule.init();
    AlertModule.init();
    ExcelModule.init();
  }

  // src/run-toast.js
  var TASK_LABELS = {
    QT0: "Cập nhật tệp đính kèm",
    QT1: "Cập nhật dữ liệu pháp lý",
    QT2: "Lưu kho hồ sơ quét",
    QT3: "Ký số sổ địa chính",
    QT4: "Kết ISO",
    QT5: "Chuyển tiếp hồ sơ"
  };
  var HOLD_AFTER_STOP_MS = 8e3;
  var lastRunning = false;
  var stoppedAt = 0;
  var hiddenByUser = false;
  function buildToast() {
    const el = document.createElement("div");
    el.id = "mplis-run-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `
        <div class="mplis-toast-row">
            <span class="mplis-status-dot" id="mplis-toast-dot"></span>
            <span class="mplis-toast-step" id="mplis-toast-step">Đang chạy</span>
            <span class="mplis-toast-count" id="mplis-toast-count"></span>
            <button type="button" class="mplis-toast-close" id="mplis-toast-close" title="Ẩn bảng này" aria-label="Ẩn bảng tiến độ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        <div class="mplis-toast-bar"><i id="mplis-toast-fill"></i></div>
        <div class="mplis-toast-log" id="mplis-toast-log">Sẵn sàng</div>
    `;
    document.body.appendChild(el);
    el.onclick = () => {
      const btn = document.getElementById("mplis-btn-maximize");
      if (btn) btn.click();
    };
    el.querySelector("#mplis-toast-close").onclick = (e) => {
      e.stopPropagation();
      hiddenByUser = true;
      el.classList.remove("show");
    };
    return el;
  }
  function getWorkflowQueue(cfg) {
    const queue = (cfg.activeWorkflows || []).slice();
    if (cfg.isQT5 && cfg.forwardUser) queue.push("QT5");
    return queue;
  }
  function refresh() {
    const toast = document.getElementById("mplis-run-toast");
    const panel = document.getElementById("mplis-auto-panel");
    if (!toast || !panel) return;
    const state = ProcessModule.getTopState();
    if (!state) return;
    if (lastRunning && !state.isRunning) stoppedAt = Date.now();
    if (!lastRunning && state.isRunning) hiddenByUser = false;
    lastRunning = state.isRunning;
    const justStopped = stoppedAt && Date.now() - stoppedAt < HOLD_AFTER_STOP_MS;
    const dungViLoi = !state.isRunning && state.lastStopKind === "error";
    if (dungViLoi && !panel.classList.contains("minimized")) hiddenByUser = true;
    const shouldShow = !hiddenByUser && panel.classList.contains("minimized") && (state.isRunning || justStopped || dungViLoi);
    toast.classList.toggle("show", shouldShow);
    if (!shouldShow) return;
    const queue = getWorkflowQueue(state.config);
    const code = state.currentTaskCode || "";
    const idx = queue.indexOf(code);
    const stepEl = document.getElementById("mplis-toast-step");
    const countEl = document.getElementById("mplis-toast-count");
    const fillEl = document.getElementById("mplis-toast-fill");
    const logEl = document.getElementById("mplis-toast-log");
    const dotEl = document.getElementById("mplis-toast-dot");
    if (state.isRunning) {
      stepEl.textContent = code ? `${code} · ${TASK_LABELS[code] || ""}` : "Đang tìm hồ sơ...";
      countEl.textContent = idx >= 0 ? `${idx + 1}/${queue.length}` : `0/${queue.length}`;
      fillEl.style.width = (idx >= 0 && queue.length ? (idx + 1) / queue.length * 100 : 0) + "%";
      fillEl.classList.remove("done", "error");
    } else {
      stepEl.textContent = dungViLoi ? "Lỗi - auto đã dừng" : "Đã dừng";
      countEl.textContent = `${queue.length}/${queue.length}`;
      fillEl.style.width = "100%";
      fillEl.classList.toggle("done", !dungViLoi);
      fillEl.classList.toggle("error", dungViLoi);
    }
    const srcLog = document.getElementById("mplis-step-log-process");
    logEl.textContent = srcLog ? srcLog.textContent : "";
    const srcDot = document.getElementById("mplis-status-dot-process");
    dotEl.className = srcDot ? srcDot.className : "mplis-status-dot";
  }
  function initRunToast() {
    if (document.getElementById("mplis-run-toast")) return;
    buildToast();
    setInterval(refresh, 500);
  }

  // src/receipt-copy.js
  setInterval(() => {
    const listItems = document.querySelectorAll("li.info");
    listItems.forEach((li) => {
      const nameSpan = li.querySelector("span.name");
      if (nameSpan && nameSpan.textContent.includes("Số biên nhận")) {
        const valueSpan = li.querySelector("span.value");
        if (valueSpan && !li.querySelector(".btn-copy-receipt")) {
          const copyBtn = document.createElement("i");
          copyBtn.className = "fa fa-copy btn-copy-receipt";
          copyBtn.style.cssText = "cursor:pointer; color:#10b981; margin-left:8px; font-size:14px; pointer-events: auto; position: relative; z-index: 9999;";
          copyBtn.title = "Copy số biên nhận";
          copyBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const text = valueSpan.textContent.trim();
              fallbackCopyTextToClipboard(text).then(() => {
                copyBtn.className = "fa fa-check btn-copy-receipt";
                copyBtn.style.color = "#0ea5e9";
                setTimeout(() => {
                  copyBtn.className = "fa fa-copy btn-copy-receipt";
                  copyBtn.style.color = "#10b981";
                }, 1500);
              }).catch((err) => {
                unsafeWindow.alert("LỖI COPY: " + err.message + "\n\nNội dung cần copy là: " + text);
              });
            } catch (err) {
              unsafeWindow.alert("Lỗi khi lấy text: " + err.message);
            }
          }, true);
          valueSpan.appendChild(copyBtn);
        }
      }
    });
  }, 1500);

  // src/gioi-han.js
  function giuMoiNhat(obj, n) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length - n; i++) delete obj[keys[i]];
    return obj;
  }

  // src/bien-dong-capture.js
  function saveBienDongCode(maHS, code) {
    try {
      const stored = JSON.parse(localStorage.getItem("mplis_bien_dong_codes") || "{}");
      stored[maHS] = code;
      localStorage.setItem("mplis_bien_dong_codes", JSON.stringify(giuMoiNhat(stored, 300)));
    } catch (e) {
    }
  }
  setInterval(() => {
    const lbl = document.getElementById("lbThongTinBienDong");
    if (!lbl) return;
    try {
      if (lbl.getBoundingClientRect().width === 0) return;
    } catch (e) {
      return;
    }
    const text = lbl.textContent || "";
    const m = text.match(/Mã loại biến động:\s*([A-ZĐ]{1,4})/i);
    if (!m) return;
    const code = m[1].trim().toUpperCase();
    if (!code) return;
    const maHS = findCurrentMaHS();
    if (!maHS) return;
    saveBienDongCode(maHS, code);
  }, 1e3);

  // src/phaply-default.js
  var SCAN_INTERVAL_MS = 1e3;
  var DONE_ATTR = "data-mplis-phaply";
  var ENABLED_KEY = "mplis_phaply_autofill_enabled";
  function isPhapLyAutofillEnabled() {
    try {
      return localStorage.getItem(ENABLED_KEY) !== "false";
    } catch (e) {
      return true;
    }
  }
  var CHECKBOX_SELECTOR = '#chkdaCongNhanPhapLy, input[type="checkbox"][name="daCongNhanPhapLy"]';
  var SELECT_SELECTOR = '#ddlloaiGiayChungNhanId, select[name="loaiGiayChungNhanId"]';
  var NGUOI_KY_SELECTOR = '#txttenNguoiKy, input[name="tenNguoiKy"]';
  var NGAY_VAO_SO_SELECTOR = 'input[name="ngayVaoSo"]';
  var LOAI_GCN_VALUE = "98";
  var LOAI_GCN_NAM = "2024";
  var NGUOI_KY_FIXES = {
    "TRINH ĐÌNH THỞI": "Trịnh Đình Thởi"
  };
  function getJq() {
    return typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
  }
  function isFormVisible(el) {
    const box = el.closest(".form-group") || el.parentElement || el;
    try {
      const r = box.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (e) {
      return false;
    }
  }
  function tickCongNhanPhapLy() {
    const list = Array.from(document.querySelectorAll(CHECKBOX_SELECTOR));
    for (const cb of list) {
      if (cb.hasAttribute(DONE_ATTR) || !isFormVisible(cb)) continue;
      cb.setAttribute(DONE_ATTR, "true");
      if (cb.checked) return;
      const jq2 = getJq();
      if (jq2) jq2(cb).click();
      else cb.click();
      console.log('[MPLIS PhapLy] Đã tích "Chính thức có pháp lý".');
      return;
    }
  }
  function chonLoaiGiayChungNhan() {
    const list = Array.from(document.querySelectorAll(SELECT_SELECTOR));
    for (const sel of list) {
      if (sel.hasAttribute(DONE_ATTR) || !isFormVisible(sel)) continue;
      const opts = Array.from(sel.options);
      const target = opts.find((o) => o.value === LOAI_GCN_VALUE) || opts.find((o) => (o.textContent || "").includes(LOAI_GCN_NAM));
      if (!target) continue;
      sel.setAttribute(DONE_ATTR, "true");
      if (sel.value === target.value) return;
      const jq2 = getJq();
      sel.value = target.value;
      if (jq2) jq2(sel).val(target.value).trigger("change");
      else sel.dispatchEvent(new Event("change", { bubbles: true }));
      console.log("[MPLIS PhapLy] Đã chọn Loại giấy chứng nhận:", target.textContent.trim());
      return;
    }
  }
  function vietHoaChuDau(text) {
    return (text || "").toLowerCase().split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }
  function dangHien(el) {
    if (!el || !el.offsetParent) return false;
    try {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (e) {
      return false;
    }
  }
  function layKhoiBuoc(label) {
    const cot = label.closest(".col-md-3, .col-md-4, .col-md-6");
    return cot && cot.parentElement || label.closest(".row") || label.parentElement;
  }
  var MA_HS_DAY_DU_RE = /[A-Z0-9]+(?:\.[A-Z0-9]+)+-(\d{6})-(\d{3,})/i;
  function rutGonMaHS(text) {
    const m = MA_HS_DAY_DU_RE.exec(text || "");
    return m ? (m[1].slice(-2) + "-" + m[2]).toUpperCase() : "";
  }
  function layMocThoiGian(text) {
    const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/g;
    let m, max = 0;
    while ((m = re.exec(text)) !== null) {
      const t = new Date(
        Number(m[3]),
        Number(m[2]) - 1,
        Number(m[1]),
        Number(m[4] || 0),
        Number(m[5] || 0)
      ).getTime();
      if (t > max) max = t;
    }
    return max;
  }
  function layTatCaCbChuyen() {
    return Array.from(document.querySelectorAll("span")).filter((s) => (s.textContent || "").trim().toLowerCase().startsWith("cb chuyển")).map((label) => {
      const valueBox = label.parentElement && label.parentElement.nextElementSibling;
      const b = valueBox ? valueBox.querySelector("b") : null;
      const name = b ? b.textContent.trim() : "";
      if (!name) return null;
      const khoi = layKhoiBuoc(label);
      const chuBuoc = (khoi && khoi.textContent || "").replace(/\s+/g, " ").trim();
      return { label, name, chuBuoc, maHS: rutGonMaHS(chuBuoc), moc: layMocThoiGian(chuBuoc) };
    }).filter((c) => c && dangHien(c.label));
  }
  function chonKhoiMoiNhat(list) {
    const coMoc = list.filter((c) => c.moc > 0);
    if (!coMoc.length) return list[0];
    return coMoc.reduce((a, b) => b.moc > a.moc ? b : a);
  }
  function chonKhoiTheoHoSo(list, maHSHienTai) {
    if (maHSHienTai) {
      const khop = list.filter((c) => c.maHS && c.maHS === maHSHienTai);
      if (khop.length === 1) return { chon: khop[0], cach: "khớp mã hồ sơ " + maHSHienTai };
      if (khop.length > 1) {
        return { chon: chonKhoiMoiNhat(khop), cach: "khớp mã hồ sơ " + maHSHienTai + ", lấy bước mới nhất" };
      }
    }
    return {
      chon: chonKhoiMoiNhat(list),
      cach: maHSHienTai ? "⚠️ KHÔNG khối nào mang mã hồ sơ " + maHSHienTai + ", đành lấy bước mới nhất" : "⚠️ không đọc được mã hồ sơ đang mở, đành lấy bước mới nhất"
    };
  }
  function moTaViTri(el) {
    const parts = [];
    for (let node = el, i = 0; node && node.tagName && i < 6; node = node.parentElement, i++) {
      let s = node.tagName.toLowerCase();
      if (node.id) s += "#" + node.id;
      const cls = (node.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += "." + cls.join(".");
      parts.unshift(s);
    }
    return parts.join(" > ");
  }
  function dumpCbChuyen(list, chon) {
    console.log('[MPLIS PhapLy] === soi khối "CB chuyển" ===');
    list.forEach((c, i) => {
      let top = null;
      try {
        top = Math.round(c.label.getBoundingClientRect().top);
      } catch (e) {
      }
      const mocStr = c.moc ? new Date(c.moc).toLocaleString("vi-VN") : "(không đọc được ngày)";
      console.log("  [" + i + "]" + (c === chon ? " <== đang lấy" : "") + " " + c.name + " | hồ sơ=" + (c.maHS || "?") + " | moc=" + mocStr + " | top=" + top);
      console.log("      viTri: " + moTaViTri(c.label));
      console.log("      chuBuoc: " + c.chuBuoc.slice(0, 300));
    });
  }
  function layTenCbChuyen() {
    const list = layTatCaCbChuyen();
    if (!list.length) return "";
    const maHSHienTai = findCurrentMaHS();
    const { chon, cach } = chonKhoiTheoHoSo(list, maHSHienTai);
    console.log("[MPLIS PhapLy] Hồ sơ đang mở: " + (maHSHienTai || "(không đọc được)") + " | " + list.length + ' khối "CB chuyển" đang hiện (' + list.map((c) => c.name).join(" | ") + ") | lấy: " + chon.name + " (" + cach + ")");
    dumpCbChuyen(list, chon);
    return chon.name;
  }
  function dienNguoiKy() {
    const input = document.querySelector(NGUOI_KY_SELECTOR);
    if (!input || input.hasAttribute(DONE_ATTR) || !isFormVisible(input)) return;
    const raw = layTenCbChuyen();
    if (!raw) return;
    input.setAttribute(DONE_ATTR, "true");
    if (input.value.trim()) return;
    const name = NGUOI_KY_FIXES[raw.toUpperCase()] || vietHoaChuDau(raw);
    const jq2 = getJq();
    input.value = name;
    if (jq2) jq2(input).val(name).trigger("input").trigger("change");
    else {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    console.log("[MPLIS PhapLy] Đã điền Người ký:", name, "(từ CB chuyển:", raw + ")");
  }
  function dinhDangNgayVN(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  var AUTO_DATE_KEY = "mplis_phaply_autodate";
  var NGAY_CHON_KEY = "mplis_phaply_ngay_vao_so";
  function layNgayMucTieu() {
    let raw = "";
    try {
      raw = (localStorage.getItem(NGAY_CHON_KEY) || "").trim();
    } catch (e) {
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) {
        return d;
      }
    }
    return /* @__PURE__ */ new Date();
  }
  function getStoredAutoDate(maHS) {
    if (!maHS) return "";
    try {
      const stored = JSON.parse(localStorage.getItem(AUTO_DATE_KEY) || "{}");
      return stored[maHS] || "";
    } catch (e) {
      return "";
    }
  }
  function saveStoredAutoDate(maHS, value) {
    if (!maHS) return;
    try {
      const stored = JSON.parse(localStorage.getItem(AUTO_DATE_KEY) || "{}");
      stored[maHS] = value;
      localStorage.setItem(AUTO_DATE_KEY, JSON.stringify(giuMoiNhat(stored, 300)));
    } catch (e) {
    }
  }
  function dienNgayVaoO(input, ngay) {
    const jq2 = getJq();
    let daDien = "";
    if (jq2 && jq2.fn && jq2.fn.datepicker && input.classList.contains("hasDatepicker")) {
      try {
        jq2(input).datepicker("setDate", ngay);
        daDien = input.value.trim();
      } catch (e) {
      }
    }
    if (!daDien) {
      daDien = dinhDangNgayVN(ngay);
      input.value = daDien;
      if (jq2) jq2(input).val(daDien).trigger("input").trigger("change");
      else {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    return daDien;
  }
  function dienNgayVaoSo() {
    const input = document.querySelector(NGAY_VAO_SO_SELECTOR);
    if (!input || !isFormVisible(input)) return;
    const maHS = findCurrentMaHS();
    const ngayMucTieu = layNgayMucTieu();
    const mucTieuStr = dinhDangNgayVN(ngayMucTieu);
    const currentVal = input.value.trim();
    const lastAuto = getStoredAutoDate(maHS);
    if (lastAuto && currentVal === lastAuto && currentVal !== mucTieuStr) {
      input.setAttribute(DONE_ATTR, "true");
      const daDien2 = dienNgayVaoO(input, ngayMucTieu);
      saveStoredAutoDate(maHS, daDien2);
      console.log("[MPLIS PhapLy] Ngày vào sổ cũ (" + lastAuto + "), điền lại theo ngày mục tiêu:", daDien2);
      return;
    }
    if (input.hasAttribute(DONE_ATTR)) return;
    input.setAttribute(DONE_ATTR, "true");
    if (currentVal) return;
    const daDien = dienNgayVaoO(input, ngayMucTieu);
    saveStoredAutoDate(maHS, daDien);
    console.log("[MPLIS PhapLy] Đã điền Ngày vào sổ:", daDien);
  }
  function goDauKhiFormDong() {
    const marked = Array.from(document.querySelectorAll("[" + DONE_ATTR + "]"));
    for (const el of marked) {
      if (!isFormVisible(el)) el.removeAttribute(DONE_ATTR);
    }
  }
  function scan() {
    if (!isPhapLyAutofillEnabled()) return;
    try {
      goDauKhiFormDong();
      tickCongNhanPhapLy();
      chonLoaiGiayChungNhan();
      dienNguoiKy();
      dienNgayVaoSo();
    } catch (e) {
      console.error("[MPLIS PhapLy] Lỗi:", e);
    }
  }
  setInterval(scan, SCAN_INTERVAL_MS);

  // src/filename-copy.js
  var SCAN_INTERVAL_MS2 = 1e3;
  var BTN_CLASS = "mplis-btn-copy-tenfile";
  var BTN_MARK = "data-mplis-tenfile";
  var MA_HS_RE = /[A-Z0-9]+(?:\.[A-Z0-9]+)+-\d{6}-\d{3,}/i;
  var DUOI = "";
  var SPH_RE = /\b([A-ZĐ]{1,2})\s*(\d{5,})\b/;
  var GIAY_RE = /giấy\s+(in mới|thu hồi)/i;
  var GIAY_THU_HOI_RE = /thu hồi/i;
  var LOAI_GIAY_KEY = "mplis_tenfile_loai_giay";
  var HAU_TO_KEY = "mplis_tenfile_hau_to";
  var HAU_TO_HOP_LE = ["GT", "PT"];
  var BANG_DINH_KEM_SELECTOR = "#tbGiayToDinhKem, #tbDanhSachGiayToDinhKem";
  var THANH_NUT_ID = "mplis-tenfile-toolbar";
  var TU_TICH_KEY = "mplis_tenfile_tu_tich_dongbo";
  var DA_TICH_ATTR = "data-mplis-dongbo";
  function tuTichBat() {
    try {
      return localStorage.getItem(TU_TICH_KEY) === "true";
    } catch (e) {
      return false;
    }
  }
  function layHauTo() {
    let v = "";
    try {
      v = (localStorage.getItem(HAU_TO_KEY) || "").trim().toUpperCase();
    } catch (e) {
    }
    return HAU_TO_HOP_LE.includes(v) ? v : "GT";
  }
  function dangHien2(el) {
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (e) {
      return false;
    }
  }
  function layMaHoSoDayDu() {
    const nodes = Array.from(document.querySelectorAll("b, span, h4, .modal-title, div[title]"));
    let found = "";
    for (const node of nodes) {
      const text = (node.textContent || "").trim();
      if (!text || text.length > 200) continue;
      const m = MA_HS_RE.exec(text);
      if (m && dangHien2(node)) found = m[0].toUpperCase();
    }
    return found;
  }
  function layDongGiayInMoi() {
    return Array.from(document.getElementsByTagName("tr")).map((tr) => {
      const dau = tr.querySelector("td");
      if (!dau) return null;
      const loaiText = dau.textContent || "";
      if (!GIAY_RE.test(loaiText)) return null;
      const cells = Array.from(tr.querySelectorAll("td"));
      const loai = GIAY_THU_HOI_RE.test(loaiText) ? "THU HỒI" : "IN MỚI";
      for (const td of cells) {
        const m = SPH_RE.exec((td.textContent || "").trim().toUpperCase());
        if (m) return { tr, cells, loai, sph: m[1] + " " + m[2] };
      }
      return null;
    }).filter((r) => r && dangHien2(r.tr));
  }
  function nhoLoaiGiay(maHS, dong) {
    if (!maHS || !dong.length) return;
    try {
      const stored = JSON.parse(localStorage.getItem(LOAI_GIAY_KEY) || "{}");
      const cuaHoSo = stored[maHS] || {};
      let doi = false;
      for (const d of dong) {
        const khoa = d.sph.replace(/\s+/g, "").toUpperCase();
        if (cuaHoSo[khoa] !== d.loai) {
          cuaHoSo[khoa] = d.loai;
          doi = true;
        }
      }
      if (!doi) return;
      stored[maHS] = cuaHoSo;
      localStorage.setItem(LOAI_GIAY_KEY, JSON.stringify(giuMoiNhat(stored, 300)));
      console.log("[MPLIS TenFile] Ghi nhớ loại giấy của hồ sơ " + maHS + ": " + dong.map((d) => d.sph + "=" + d.loai).join(", "));
    } catch (e) {
    }
  }
  function baoNhanh(text, mau) {
    let el = document.getElementById("mplis-tenfile-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "mplis-tenfile-toast";
      el.style.cssText = 'position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:999999999; max-width:min(560px, calc(100vw - 32px)); padding:10px 14px; border-radius:10px; font:600 13px "Segoe UI", sans-serif; color:#fff; box-shadow:0 10px 28px rgba(0,0,0,0.45); pointer-events:none; opacity:0; transition:opacity 0.15s ease;';
      document.body.appendChild(el);
    }
    el.style.background = mau;
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(el._an);
    el._an = setTimeout(() => {
      el.style.opacity = "0";
    }, 2600);
  }
  function copyChuoi(ten, ghiChu) {
    fallbackCopyTextToClipboard(ten).then(() => {
      console.log("[MPLIS TenFile] Đã copy tên file:", ten, ghiChu || "");
      baoNhanh("Đã copy: " + ten + (ghiChu ? "  (" + ghiChu + ")" : ""), "#047857");
    }).catch((err) => {
      console.log("[MPLIS TenFile] Lỗi copy:", err);
      baoNhanh("Lỗi copy, xem console", "#b91c1c");
    });
  }
  function copyTen(sph) {
    const maHS = layMaHoSoDayDu();
    if (!maHS) {
      console.log('[MPLIS TenFile] Có Số phát hành "' + sph + '" nhưng không thấy mã hồ sơ đầy đủ trên trang (dạng H15.50.05.12-260917-0681). Chỉ copy Số phát hành.');
      fallbackCopyTextToClipboard(sph + DUOI);
      baoNhanh("Không thấy mã hồ sơ, đã copy: " + sph + DUOI, "#b45309");
      return;
    }
    copyChuoi(maHS + "-" + sph + DUOI, "giấy chứng nhận - TÍCH ô đồng bộ một cửa");
  }
  function copyTenGiayToKem() {
    const maHS = layMaHoSoDayDu();
    const hauTo = layHauTo();
    if (!maHS) {
      console.log("[MPLIS TenFile] Không thấy mã hồ sơ đầy đủ trên trang, không ghép được tên giấy tờ kèm (<mã hồ sơ>-" + hauTo + DUOI + ").");
      baoNhanh("Không thấy mã hồ sơ trên trang", "#b91c1c");
      return;
    }
    copyChuoi(maHS + "-" + hauTo + DUOI, "giấy tờ kèm - KHÔNG tích ô đồng bộ");
  }
  var SPH_NHO_KEY = "mplis_tenfile_sph_theo_hoso";
  function nhoSph(maHS, sphList) {
    if (!maHS || !sphList.length) return;
    try {
      const stored = JSON.parse(localStorage.getItem(SPH_NHO_KEY) || "{}");
      if (JSON.stringify(stored[maHS]) === JSON.stringify(sphList)) return;
      stored[maHS] = sphList;
      localStorage.setItem(SPH_NHO_KEY, JSON.stringify(giuMoiNhat(stored, 300)));
    } catch (e) {
    }
  }
  function themSphTay(maHS, sph) {
    if (!maHS || !sph) return [];
    const ds = doclaiSph(maHS);
    if (!ds.includes(sph)) ds.push(sph);
    nhoSph(maHS, ds);
    return ds;
  }
  function xoaSphNho(maHS, sph) {
    const ds = doclaiSph(maHS).filter((x) => x !== sph);
    try {
      const stored = JSON.parse(localStorage.getItem(SPH_NHO_KEY) || "{}");
      if (ds.length) stored[maHS] = ds;
      else delete stored[maHS];
      localStorage.setItem(SPH_NHO_KEY, JSON.stringify(stored));
    } catch (e) {
    }
    console.log('[MPLIS TenFile] Đã xoá "' + sph + '" khỏi danh sách nhớ của hồ sơ ' + maHS + ". Dòng đã tạo trong bảng (nếu có) KHÔNG bị xoá.");
    baoNhanh("Đã xoá số " + sph + " khỏi danh sách nhớ", "#b45309");
    const cu = document.getElementById(THANH_NUT_ID);
    if (cu) cu.remove();
  }
  function doclaiSph(maHS) {
    if (!maHS) return [];
    try {
      const stored = JSON.parse(localStorage.getItem(SPH_NHO_KEY) || "{}");
      return Array.isArray(stored[maHS]) ? stored[maHS] : [];
    } catch (e) {
      return [];
    }
  }
  var O_TEN_SELECTOR = 'input[placeholder*="tên tài liệu" i], input[placeholder*="Tên tài liệu" i]';
  function timODienTen() {
    return Array.from(document.querySelectorAll(O_TEN_SELECTOR)).find(dangHien2) || null;
  }
  function timNutThem(o) {
    const khung = o.closest(".input-group, .form-group, div") || o.parentElement;
    if (!khung) return null;
    const nut = Array.from(khung.querySelectorAll("button, a.btn, span.input-group-addon")).filter(dangHien2).filter((b) => !b.closest("#" + THANH_NUT_ID));
    if (!nut.length) return null;
    return nut.find((b) => /^\+?$/.test((b.textContent || "").trim()) && (/\+/.test(b.textContent || "") || b.querySelector(".fa-plus, .glyphicon-plus"))) || nut.find((b) => b.querySelector(".fa-plus, .glyphicon-plus")) || null;
  }
  function daCoDong(ten) {
    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien2);
    if (!bang) return false;
    const gon = ten.replace(/\s+/g, "").toUpperCase();
    return Array.from(bang.querySelectorAll("tbody tr")).some((tr) => (tr.textContent || "").replace(/\s+/g, "").toUpperCase().includes(gon));
  }
  var VUA_BAM_MS = 12e3;
  var _vuaBam = /* @__PURE__ */ new Map();
  function vuaBamRoi(ten) {
    const khoa = ten.replace(/\s+/g, "").toUpperCase();
    const luc = _vuaBam.get(khoa);
    return !!luc && Date.now() - luc < VUA_BAM_MS;
  }
  function themDong(ten) {
    if (!ten) return;
    if (vuaBamRoi(ten)) {
      console.log('[MPLIS TenFile] "' + ten + '" vừa bấm "+" xong, đợi bảng cập nhật - không bấm lại.');
      return;
    }
    if (daCoDong(ten)) {
      console.log('[MPLIS TenFile] Bảng đã có dòng "' + ten + '" - không thêm nữa.');
      baoNhanh("Đã có dòng: " + ten, "#b45309");
      return;
    }
    const o = timODienTen();
    const nut = o && timNutThem(o);
    if (!o || !nut) {
      console.log('[MPLIS TenFile] Không thấy ô "Tên tài liệu muốn thêm" hoặc nút "+" đang hiện. Ô tìm được: ' + (o ? "có" : "không") + ", nút: " + (nut ? "có" : "không"));
      baoNhanh("Không thấy ô thêm tài liệu trên trang", "#b91c1c");
      return;
    }
    const jq2 = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
    o.value = ten;
    if (jq2) jq2(o).val(ten).trigger("input").trigger("change");
    else {
      o.dispatchEvent(new Event("input", { bubbles: true }));
      o.dispatchEvent(new Event("change", { bubbles: true }));
    }
    _vuaBam.set(ten.replace(/\s+/g, "").toUpperCase(), Date.now());
    if (jq2) jq2(nut).click();
    else nut.click();
    console.log('[MPLIS TenFile] Đã điền "' + ten + '" và bấm "+" để tạo dòng.');
    baoNhanh("Đã tạo dòng: " + ten, "#047857");
  }
  var THEM_DELAY_MS = 1200;
  function themNhieuDong(dsTen, imLang) {
    const con = dsTen.filter(Boolean).filter((t) => !daCoDong(t) && !vuaBamRoi(t));
    if (!con.length) {
      console.log("[MPLIS TenFile] Mọi dòng cần thêm đều đã có trong bảng.");
      if (!imLang) baoNhanh("Bảng đã có đủ các dòng", "#b45309");
      return;
    }
    console.log("[MPLIS TenFile] Thêm " + con.length + " dòng, cách nhau " + THEM_DELAY_MS + "ms: " + con.join(" | "));
    con.forEach((ten, i) => setTimeout(() => themDong(ten), i * THEM_DELAY_MS));
  }
  function tenGiayChungNhan(sph) {
    const maHS = layMaHoSoDayDu();
    return maHS && sph ? maHS + "-" + sph + DUOI : "";
  }
  function tenGiayToKem() {
    const maHS = layMaHoSoDayDu();
    return maHS ? maHS + "-" + layHauTo() + DUOI : "";
  }
  function themDongTay(raw, maHS) {
    const text = (raw || "").trim().toUpperCase();
    if (!text) {
      baoNhanh("Chưa gõ số nào", "#b45309");
      return;
    }
    if (!maHS) {
      baoNhanh("Không thấy mã hồ sơ trên trang", "#b91c1c");
      return;
    }
    const m = SPH_RE.exec(text);
    const sph = m ? m[1] + " " + m[2] : text;
    const ten = maHS + "-" + sph + DUOI;
    if (m) {
      themSphTay(maHS, sph);
    } else {
      console.log('[MPLIS TenFile] Số tự nhập "' + text + '" không đúng dạng "2 chữ cái + số" nên tool sẽ KHÔNG tự tích ô gửi về một cửa cho dòng này.');
      baoNhanh("Tạo dòng nhưng không tự tích ô một cửa (số không đúng dạng)", "#b45309");
    }
    themDong(ten);
  }
  function ganThanhNut() {
    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien2);
    const cu = document.getElementById(THANH_NUT_ID);
    if (!bang) {
      if (cu) cu.remove();
      return;
    }
    const maHS = layMaHoSoDayDu();
    const tren = layDongGiayInMoi().map((d) => d.sph);
    const sphList = Array.from(new Set(tren.concat(doclaiSph(maHS))));
    const hauTo = layHauTo();
    const dauTay = sphList.join(",");
    if (cu && cu._sph === dauTay && cu._hauTo === hauTo && cu.parentElement) return;
    if (cu && cu.contains(document.activeElement)) return;
    if (cu) cu.remove();
    const thanh = document.createElement("div");
    thanh.id = THANH_NUT_ID;
    thanh._sph = dauTay;
    thanh._hauTo = hauTo;
    thanh.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:8px 0; padding:7px 9px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; font:12px "Segoe UI", sans-serif; color:#1e293b; max-height:84px; overflow-y:auto;';
    const themNut = (chu, mau, title, onClick, tat, hep) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = chu;
      b.title = title;
      b.disabled = !!tat;
      b.style.cssText = "min-height:30px; padding:" + (hep ? "5px 8px" : "5px 11px") + '; font:600 12px "Segoe UI", sans-serif; color:#fff; background:' + mau + "; border:none; border-radius:6px; cursor:" + (tat ? "not-allowed" : "pointer") + "; opacity:" + (tat ? "0.5" : "1") + ";";
      if (!tat) {
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        };
      }
      thanh.appendChild(b);
    };
    if (!sphList.length) {
      themNut(
        "+ Dòng giấy chứng nhận (chưa có Số phát hành)",
        "#4f46e5",
        "Chưa biết Số phát hành. Mở màn hình Cập nhật pháp lý giấy chứng nhận một lần để tool nhớ.",
        () => {
        },
        true
      );
    } else {
      const dsDay = sphList.map((x) => maHS + "-" + x + DUOI).concat(maHS + "-" + hauTo + DUOI);
      themNut(
        "⚡ Tạo đủ (" + sphList.length + " GCN + " + hauTo + ")",
        "#7c3aed",
        "Tạo lần lượt " + dsDay.length + " dòng: " + dsDay.join(", ") + ". Dòng đã có trong bảng thì bỏ qua.",
        () => themNhieuDong(sphList.map(tenGiayChungNhan).concat(tenGiayToKem())),
        !maHS
      );
    }
    for (const sph of sphList) {
      themNut(
        "+ " + sph,
        "#4f46e5",
        'Tạo dòng "' + (maHS || "<mã hồ sơ>") + "-" + sph + DUOI + '" rồi tích ô gửi về một cửa.',
        () => themDong(tenGiayChungNhan(sph)),
        !maHS
      );
      themNut(
        "⧉",
        "#475569",
        'Copy "' + (maHS || "<mã hồ sơ>") + "-" + sph + DUOI + '" để đổi tên file quét trên máy.',
        () => copyTen(sph),
        false,
        true
      );
      if (!tren.includes(sph)) {
        themNut(
          "✕",
          "#b91c1c",
          'Xoá "' + sph + '" khỏi danh sách nhớ của tool (gõ nhầm thì xoá ở đây). KHÔNG xoá dòng đã tạo trong bảng - dòng đó xoá bằng nút "Xóa" màu đỏ của cổng.',
          () => xoaSphNho(maHS, sph),
          !maHS,
          true
        );
      }
    }
    themNut(
      "+ " + hauTo,
      "#0f766e",
      'Tạo dòng "' + (maHS || "<mã hồ sơ>") + "-" + hauTo + DUOI + '", KHÔNG tích ô gửi về một cửa. Đổi GT/PT trong tab Cài đặt của tool.',
      () => themDong(tenGiayToKem()),
      !maHS
    );
    themNut(
      "⧉",
      "#475569",
      'Copy "' + (maHS || "<mã hồ sơ>") + "-" + hauTo + DUOI + '" để đổi tên file quét trên máy.',
      copyTenGiayToKem,
      false,
      true
    );
    const o = document.createElement("input");
    o.type = "text";
    o.id = "mplis-tenfile-input-tay";
    o.placeholder = "Số tự nhập, VD: BN 600374";
    o.title = 'Gõ số rồi bấm "+ Thêm": tạo dòng "' + (maHS || "<mã hồ sơ>") + "-<số>" + DUOI + '"';
    o.style.cssText = 'min-height:30px; width:150px; padding:4px 8px; font:12px "Segoe UI", sans-serif; color:#1e293b; background:#fff; border:1px solid #c7d2fe; border-radius:6px;';
    o.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        themDongTay(o.value, maHS);
      }
    };
    thanh.appendChild(o);
    themNut(
      "+",
      "#7c3aed",
      'Tạo dòng theo số vừa gõ. Số dạng "BN 600374" thì tool tích luôn ô gửi về một cửa.',
      () => themDongTay(o.value, maHS),
      !maHS
    );
    const nhac = document.createElement("span");
    nhac.style.cssText = "margin-left:auto; font-size:11px; color:#475569; white-space:nowrap;";
    nhac.title = 'Dòng tên theo Số phát hành thì tool tích ô "Giấy tờ gửi về một cửa"; dòng ' + hauTo + " thì bỏ tích.";
    nhac.textContent = sphList.length + " GCN · tích một cửa | " + hauTo + " · không tích";
    thanh.appendChild(nhac);
    const noi = bang.parentElement || bang;
    noi.insertBefore(thanh, bang);
  }
  var COT_MOT_CUA_RE = /một cửa/i;
  var COT_TEN_RE = /tên giấy tờ/i;
  var TEN_GCN_RE = /-[A-ZĐ]{1,2}\s*\d{5,}(\.PDF)?$/i;
  var TEN_KEM_RE = /-(GT|PT)(\.PDF)?$/i;
  function layChiSoCot(hang, re) {
    if (!hang) return -1;
    const o = Array.from(hang.children);
    for (let i = 0; i < o.length; i++) {
      if (re.test((o[i].textContent || "").trim())) return i;
    }
    return -1;
  }
  function timOMotCua(tr, cotMotCua, soOTieuDe) {
    const o = Array.from(tr.children);
    const layTrongO = (idx) => {
      const cell = idx >= 0 ? o[idx] : null;
      return cell ? cell.querySelector('input[type="checkbox"]') : null;
    };
    let cb = layTrongO(cotMotCua);
    if (cb) return { cb, cach: "đúng chỉ số cột tiêu đề" };
    const lech = o.length - soOTieuDe;
    if (lech > 0) {
      cb = layTrongO(cotMotCua + lech);
      if (cb) return { cb, cach: "bù lệch " + lech + " ô so với tiêu đề" };
    }
    const tatCa = Array.from(tr.querySelectorAll('input[type="checkbox"]'));
    const conLai = tatCa.filter((x) => x.closest("td") !== o[0] && x.closest("th") !== o[0]);
    if (conLai.length === 1) return { cb: conLai[0], cach: "ô tích duy nhất ngoài cột chọn dòng" };
    return {
      cb: null,
      cach: "không xác định được (dòng có " + o.length + " ô, tiêu đề " + soOTieuDe + " ô, " + tatCa.length + " ô tích)"
    };
  }
  var _daLogThieuCot = false;
  var _daLogBang = "";
  function tuTichDongBo() {
    if (!tuTichBat()) return;
    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien2);
    if (!bang) return;
    const hangTieuDe = bang.querySelector("thead tr") || bang.querySelector("tr");
    const soOTieuDe = hangTieuDe ? hangTieuDe.children.length : 0;
    const cotMotCua = layChiSoCot(hangTieuDe, COT_MOT_CUA_RE);
    const cotTen = layChiSoCot(hangTieuDe, COT_TEN_RE);
    if (cotMotCua < 0) {
      if (!_daLogThieuCot) {
        console.log('[MPLIS TenFile] Không thấy cột "một cửa" trong bảng giấy tờ đính kèm nên KHÔNG tích gì. Tiêu đề các cột đang có: ' + (hangTieuDe ? Array.from(hangTieuDe.children).map((x) => (x.textContent || "").trim() || "(trống)").join(" | ") : "(không đọc được)"));
        _daLogThieuCot = true;
      }
      return;
    }
    _daLogThieuCot = false;
    const dauBang = (bang.id || "") + "#" + cotMotCua + "#" + soOTieuDe;
    if (_daLogBang !== dauBang) {
      _daLogBang = dauBang;
      console.log('[MPLIS TenFile] Bảng "' + (bang.id || "(không id)") + '": cột "một cửa" ở vị trí ' + cotMotCua + ', cột "tên giấy tờ" ở vị trí ' + cotTen + ", tiêu đề " + soOTieuDe + " ô.");
    }
    for (const tr of Array.from(bang.querySelectorAll("tbody tr"))) {
      if (!dangHien2(tr)) continue;
      const o = Array.from(tr.children);
      const lech = Math.max(0, o.length - soOTieuDe);
      const ungVienTen = [o[cotTen], o[cotTen + lech]].filter(Boolean);
      const ungVienTenStr = ungVienTen.map((x) => (x.textContent || "").replace(/\s+/g, " ").trim());
      const ten = ungVienTenStr.find((t) => /\.PDF$/i.test(t)) || ungVienTenStr.find((t) => /-(GT|PT)$/i.test(t) || /-[A-ZĐ]{1,2}\s*\d{5,}$/i.test(t)) || (tr.textContent || "").replace(/\s+/g, " ").trim();
      const tenGon = ten.replace(/\s+/g, "").toUpperCase();
      const laGcn = TEN_GCN_RE.test(tenGon);
      const laKem = TEN_KEM_RE.test(tenGon);
      if (!laGcn && !laKem) continue;
      const { cb, cach } = timOMotCua(tr, cotMotCua, soOTieuDe);
      if (!cb) {
        if (tr.getAttribute(DA_TICH_ATTR) !== "bo-qua") {
          tr.setAttribute(DA_TICH_ATTR, "bo-qua");
          console.log('[MPLIS TenFile] Dòng "' + ten + '": không tìm được ô "gửi về một cửa" - ' + cach + ". Không đụng gì.");
        }
        continue;
      }
      const muon = laGcn;
      if (tr.getAttribute(DA_TICH_ATTR) === (muon ? "tich" : "bo-tich")) continue;
      tr.setAttribute(DA_TICH_ATTR, muon ? "tich" : "bo-tich");
      if (cb.checked === muon) continue;
      const jq2 = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
      if (jq2) jq2(cb).click();
      else cb.click();
      console.log("[MPLIS TenFile] " + (muon ? "Đã TÍCH" : "Đã BỎ TÍCH") + ' ô "gửi về một cửa" cho: ' + ten + " (tìm ô theo: " + cach + ")");
    }
  }
  function ganNut() {
    const dong = layDongGiayInMoi();
    if (dong.length) {
      const maHS = layMaHoSoDayDu();
      nhoSph(maHS, dong.map((d) => d.sph));
      nhoLoaiGiay(maHS, dong);
    }
    for (const d of dong) {
      if (d.tr.querySelector("." + BTN_CLASS)) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.setAttribute(BTN_MARK, d.sph);
      btn.textContent = "Copy tên file";
      btn.title = 'Copy "<mã hồ sơ>-' + d.sph + DUOI + '" (giấy ' + d.loai.toLowerCase() + ") để đổi tên file quét";
      btn.style.cssText = 'margin-left:6px; padding:3px 8px; font:600 11px "Segoe UI", sans-serif; color:#fff; background:#4f46e5; border:none; border-radius:5px; cursor:pointer;';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyTen(d.sph);
      };
      d.cells[d.cells.length - 1].appendChild(btn);
    }
  }
  var TU_THEM_KEY = "mplis_tenfile_tu_them";
  var TU_THEM_CHO_MS = 1500;
  var _bangThayLuc = 0;
  var _daTuThemCho = "";
  function autoDangChay() {
    try {
      const st2 = window.top.MPLIS_AUTO_STATE;
      return !!(st2 && st2.isRunning);
    } catch (e) {
      return false;
    }
  }
  function tuThemBat() {
    if (autoDangChay()) return true;
    try {
      return localStorage.getItem(TU_THEM_KEY) !== "false";
    } catch (e) {
      return true;
    }
  }
  var _bangMatLuc = 0;
  var BANG_MAT_RESET_MS = 5e3;
  function tuThemDong() {
    const bang = Array.from(document.querySelectorAll(BANG_DINH_KEM_SELECTOR)).find(dangHien2);
    if (!bang) {
      if (!_bangMatLuc) _bangMatLuc = Date.now();
      if (Date.now() - _bangMatLuc > BANG_MAT_RESET_MS) {
        _bangThayLuc = 0;
        _daTuThemCho = "";
      }
      return;
    }
    _bangMatLuc = 0;
    if (!tuThemBat()) return;
    if (!_bangThayLuc) _bangThayLuc = Date.now();
    if (Date.now() - _bangThayLuc < TU_THEM_CHO_MS) return;
    const maHS = layMaHoSoDayDu();
    if (!maHS || _daTuThemCho === maHS) return;
    const sphList = Array.from(new Set(layDongGiayInMoi().map((d) => d.sph).concat(doclaiSph(maHS))));
    if (!sphList.length) return;
    if (!timODienTen()) return;
    _daTuThemCho = maHS;
    console.log("[MPLIS TenFile] Tự tạo đủ dòng cho hồ sơ " + maHS + " (" + sphList.length + " GCN + " + layHauTo() + ").");
    themNhieuDong(sphList.map(tenGiayChungNhan).concat(tenGiayToKem()), true);
  }
  var _thieuDaLog = false;
  setInterval(() => {
    try {
      ganNut();
      tuThemDong();
      ganThanhNut();
      tuTichDongBo();
    } catch (e) {
      console.error("[MPLIS TenFile] Lỗi:", e);
    }
  }, SCAN_INTERVAL_MS2);
  window.addEventListener("keydown", (e) => {
    if (!e.altKey || e.key !== "d" && e.key !== "D") return;
    e.preventDefault();
    const dong = layDongGiayInMoi();
    if (!dong.length) {
      if (!_thieuDaLog) {
        console.log('[MPLIS TenFile] Không thấy dòng "Giấy in mới" nào đang hiện. Mở màn hình "Cập nhật pháp lý giấy chứng nhận" (sau bước 1) rồi bấm lại Alt+D.');
        _thieuDaLog = true;
      }
      baoNhanh("Không thấy giấy in mới trên trang", "#b91c1c");
      return;
    }
    _thieuDaLog = false;
    copyTen(dong[0].sph);
    if (dong.length > 1) {
      console.log("[MPLIS TenFile] Hồ sơ có " + dong.length + " giấy in mới (" + dong.map((d) => d.sph).join(", ") + '). Alt+D lấy giấy đầu; giấy còn lại bấm nút "Copy tên file" ngay trên dòng của nó.');
      baoNhanh("Có " + dong.length + " giấy in mới - đã copy giấy đầu, giấy khác bấm nút trên dòng", "#b45309");
    }
  });
  window.addEventListener("keydown", (e) => {
    if (!e.altKey || e.key !== "g" && e.key !== "G") return;
    e.preventDefault();
    copyTenGiayToKem();
  });

  // src/spatial-link-bypass.js
  var ENABLED_KEY2 = "mplis_bypass_spatial_link_enabled";
  var ENDPOINT = "ThucHienKetISO";
  function isSpatialLinkBypassEnabled() {
    try {
      return localStorage.getItem(ENABLED_KEY2) === "true";
    } catch (e) {
      return false;
    }
  }
  function patchJsonBody(bodyStr) {
    try {
      const obj = JSON.parse(bodyStr);
      if (obj.bypassWarning === true) return bodyStr;
      obj.bypassWarning = true;
      return JSON.stringify(obj);
    } catch (e) {
      return bodyStr;
    }
  }
  function installAjaxPatch() {
    const jq2 = typeof unsafeWindow !== "undefined" ? unsafeWindow.$ : null;
    if (!jq2 || !jq2.ajaxPrefilter) return;
    jq2.ajaxPrefilter((options) => {
      if (!isSpatialLinkBypassEnabled()) return;
      if (typeof options.url !== "string" || options.url.indexOf(ENDPOINT) === -1) return;
      if (typeof options.data === "string") {
        options.data = patchJsonBody(options.data);
      } else if (options.data && typeof options.data === "object") {
        options.data.bypassWarning = true;
      }
      console.log("[MPLIS] Đã tự chèn bypassWarning=true vào request " + ENDPOINT + " (qua $.ajax).");
    });
  }
  function installFetchPatch() {
    if (typeof unsafeWindow === "undefined" || typeof unsafeWindow.fetch !== "function") return;
    if (unsafeWindow.fetch.__mplisSpatialPatched) return;
    const originalFetch = unsafeWindow.fetch;
    const patchedFetch = function(input, init) {
      try {
        const url = typeof input === "string" ? input : input && input.url || "";
        if (isSpatialLinkBypassEnabled() && url.indexOf(ENDPOINT) !== -1 && init && typeof init.body === "string") {
          init = Object.assign({}, init, { body: patchJsonBody(init.body) });
          console.log("[MPLIS] Đã tự chèn bypassWarning=true vào request " + ENDPOINT + " (qua fetch).");
        }
      } catch (e) {
      }
      return originalFetch.call(this, input, init);
    };
    patchedFetch.__mplisSpatialPatched = true;
    unsafeWindow.fetch = patchedFetch;
  }
  installAjaxPatch();
  installFetchPatch();

  // src/dakyso-bypass.js
  var ENABLED_KEY3 = "mplis_bypass_dakyso_enabled";
  var ENDPOINT2 = "UpdateHoSoQuetExistFile";
  function isBypassEnabled() {
    try {
      return localStorage.getItem(ENABLED_KEY3) === "true";
    } catch (e) {
      return false;
    }
  }
  function patchInfoJson(jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      if (obj.laGiayChungNhan === true && obj.daKySo === false) {
        obj.daKySo = true;
        return { str: JSON.stringify(obj), changed: true };
      }
    } catch (e) {
    }
    return { str: jsonStr, changed: false };
  }
  function patchFormData(fd) {
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    let anyChanged = false;
    const entries = [];
    try {
      for (const pair of fd.entries()) {
        entries.push(pair);
      }
    } catch (e) {
      return null;
    }
    if (!entries.some(([k]) => /^infoHoSoQuet_\d+$/.test(k))) return null;
    const newFd = new win.FormData();
    for (const [key, value] of entries) {
      if (/^infoHoSoQuet_\d+$/.test(key) && typeof value === "string") {
        const { str, changed } = patchInfoJson(value);
        if (changed) anyChanged = true;
        newFd.append(key, str);
      } else {
        newFd.append(key, value);
      }
    }
    return anyChanged ? newFd : null;
  }
  function extractBoundary(headers) {
    let ct = "";
    try {
      if (headers && typeof headers.get === "function") {
        ct = headers.get("content-type") || "";
      } else if (headers && typeof headers === "object") {
        ct = headers["content-type"] || headers["Content-Type"] || "";
      }
    } catch (e) {
    }
    const m = ct.match(/boundary=([^\s;]+)/);
    return m ? m[1] : null;
  }
  function patchMultipartString(bodyStr, boundary) {
    const delim = "--" + boundary;
    const parts = bodyStr.split(delim);
    let anyChanged = false;
    const patched = parts.map((part) => {
      if (!/name="infoHoSoQuet_\d+"/.test(part)) return part;
      const sepIdx = part.indexOf("\r\n\r\n");
      if (sepIdx === -1) return part;
      const head = part.slice(0, sepIdx + 4);
      const tail = part.slice(sepIdx + 4);
      const jsonEnd = tail.lastIndexOf("\r\n");
      const jsonStr = jsonEnd !== -1 ? tail.slice(0, jsonEnd) : tail;
      const suffix = jsonEnd !== -1 ? tail.slice(jsonEnd) : "";
      const { str, changed } = patchInfoJson(jsonStr);
      if (changed) anyChanged = true;
      return head + str + suffix;
    });
    return anyChanged ? patched.join(delim) : null;
  }
  function installFetchPatch2() {
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (typeof win.fetch !== "function") return;
    if (win.fetch.__mplisKySoPatched) return;
    const FD = win.FormData;
    const orig = win.fetch;
    win.fetch = function(input, init) {
      try {
        const url = typeof input === "string" ? input : input && input.url || "";
        if (isBypassEnabled() && url.indexOf(ENDPOINT2) !== -1 && init) {
          if (FD && init.body instanceof FD) {
            const newFd = patchFormData(init.body);
            if (newFd) {
              init = Object.assign({}, init, { body: newFd });
              console.log("[MPLIS] Đã vá daKySo=true vào " + ENDPOINT2 + " (FormData).");
            }
          } else if (typeof init.body === "string") {
            const boundary = extractBoundary(init.headers);
            if (boundary) {
              const patchedStr = patchMultipartString(init.body, boundary);
              if (patchedStr) {
                init = Object.assign({}, init, { body: patchedStr });
                console.log("[MPLIS] Đã vá daKySo=true vào " + ENDPOINT2 + " (string body).");
              }
            }
          }
        }
      } catch (e) {
      }
      return orig.call(this, input, init);
    };
    win.fetch.__mplisKySoPatched = true;
  }
  function installAjaxPatch2() {
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const jq2 = win.$;
    if (!jq2 || !jq2.ajaxPrefilter) return;
    const FD = win.FormData;
    jq2.ajaxPrefilter((options) => {
      if (!isBypassEnabled()) return;
      if (typeof options.url !== "string" || options.url.indexOf(ENDPOINT2) === -1) return;
      if (FD && options.data instanceof FD) {
        const newFd = patchFormData(options.data);
        if (newFd) {
          options.data = newFd;
          console.log("[MPLIS] Đã vá daKySo=true vào " + ENDPOINT2 + " ($.ajax FormData).");
        }
      }
    });
  }
  installFetchPatch2();
  installAjaxPatch2();

  // src/main.js
  if (window === window.top) {
    if ("locks" in navigator) {
      navigator.locks.request("mplis-keepalive", { mode: "shared" }, () => new Promise(() => {
      }));
    }
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        injectPanel();
        initRunToast();
      }
    }, 300);
    topWin.MPLIS_AUTO_TOGGLE_FUNC = toggleProcess;
    try {
      ["mplis_notify_logged", "mplis_notify_resolved"].forEach((k) => localStorage.removeItem(k));
    } catch (e) {
    }
  }
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "s" || e.key === "S" || e.key === "đ" || e.key === "Đ")) {
      e.preventDefault();
      if (window === window.top) toggleProcess();
      else try {
        if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC();
      } catch (err) {
      }
    } else if (e.altKey && (e.key === "h" || e.key === "H")) {
      e.preventDefault();
      if (window === window.top) {
        const panel = document.getElementById("mplis-auto-panel");
        if (panel) {
          panel.style.display = panel.style.display === "none" ? "flex" : "none";
        }
      }
    }
  });
})();
