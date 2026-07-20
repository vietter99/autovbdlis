// ==UserScript==
// @name         MPLIS Auto Tool
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Bản gộp Toàn Diện: Xử lý Quy trình (QT), Trả hồ sơ và Cảnh báo trễ hạn. Giao diện v8: thiết kế lại toàn bộ UI, thêm tab Cài đặt, escape dữ liệu hiển thị, và công tắc bật/tắt tự động xác nhận hộp thoại. TOÀN BỘ LOGIC TỰ ĐỘNG HÓA GIỮ NGUYÊN như bản 7.0.
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
      unsafeWindow.confirm = function(message) {
        console.log("[MPLIS Auto] Tự động chấp nhận confirm mặc định: " + message);
        return true;
      };
      unsafeWindow.alert = function(message) {
        console.log("[MPLIS Auto] Tự động bỏ qua alert: " + message);
        return true;
      };
    }
  } catch (e) {
  }
  var topWin = window.top || window;
  function clickElement(el) {
    if (!el) return;
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
            const text = (el.textContent || el.value || "").toLowerCase();
            if (text.includes(textMatch) && !results.includes(el)) results.push(el);
          });
        } catch (e) {
        }
      } else {
        try {
          const elements = Array.from(parent.querySelectorAll(selector));
          elements.forEach((el) => {
            if (!results.includes(el)) results.push(el);
          });
        } catch (e) {
        }
      }
    }
    return results;
  }

  // src/panel-style.js
  var panelStyle = `
        :root {
            --mplis-bg: #0b0f19;
            --mplis-bg-soft: #11172a;
            --mplis-surface: rgba(255,255,255,0.04);
            --mplis-surface-hover: rgba(255,255,255,0.08);
            --mplis-border: rgba(148,163,184,0.14);
            --mplis-text: #eef2f8;
            --mplis-text-dim: #8b95ad;
            --mplis-accent: #6366f1;
            --mplis-accent-2: #22d3ee;
            --mplis-good: #22c55e;
            --mplis-warn: #f59e0b;
            --mplis-bad: #f43f5e;
        }

        #mplis-auto-panel { position: fixed !important; bottom: 24px !important; right: 24px !important; width: 460px !important; max-height: 82vh !important; background: linear-gradient(180deg, var(--mplis-bg-soft), var(--mplis-bg)) !important; border: 1px solid var(--mplis-border) !important; border-radius: 20px !important; box-shadow: 0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06) !important; color: var(--mplis-text) !important; font-family: 'Segoe UI', 'Inter', sans-serif !important; z-index: 999999999 !important; user-select: none !important; box-sizing: border-box !important; transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important; display: flex; flex-direction: column; overflow: hidden; transform-origin: bottom right; }
        #mplis-auto-panel * { box-sizing: border-box; }
        #mplis-auto-panel.minimized { width: 58px !important; height: 58px !important; border-radius: 50% !important; background: linear-gradient(135deg, var(--mplis-accent), var(--mplis-accent-2)) !important; border: none !important; box-shadow: 0 10px 26px rgba(99,102,241,0.55) !important; cursor: pointer; transform: scale(0.92); }
        #mplis-auto-panel.minimized:hover { transform: scale(1); box-shadow: 0 14px 30px rgba(99,102,241,0.65) !important; }
        #mplis-auto-panel.minimized .mplis-panel-header,
        #mplis-auto-panel.minimized .mplis-shell { display: none !important; }

        /* ---- Header ---- */
        #mplis-auto-panel .mplis-panel-header { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 14px 16px !important; border-bottom: 1px solid var(--mplis-border) !important; flex-shrink: 0; }
        #mplis-auto-panel .mplis-panel-title { font-weight: 700 !important; font-size: 14px !important; color: var(--mplis-text) !important; display: flex !important; align-items: center !important; gap: 10px !important; }
        #mplis-auto-panel .mplis-panel-title .mplis-logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg, var(--mplis-accent), var(--mplis-accent-2)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
        #mplis-auto-panel .mplis-panel-title .mplis-author-tag { font-size: 10px; color: var(--mplis-text-dim); font-weight: 600; background: var(--mplis-surface); border: 1px solid var(--mplis-border); border-radius: 20px; padding: 2px 8px; }
        #mplis-auto-panel .mplis-btn-minimize { background: var(--mplis-surface) !important; border: 1px solid var(--mplis-border) !important; border-radius: 9px !important; color: var(--mplis-text-dim) !important; cursor: pointer !important; width: 30px !important; height: 30px !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.15s !important; padding: 0; margin: 0; }
        #mplis-auto-panel .mplis-btn-minimize:hover { color: var(--mplis-text) !important; background: var(--mplis-surface-hover) !important; }
        #mplis-auto-panel .mplis-minimized-trigger { display: none !important; width: 100% !important; height: 100% !important; align-items: center !important; justify-content: center !important; color: #fff !important; background: transparent !important; border: none !important; outline: none !important; padding: 0 !important; margin: 0 !important; cursor: pointer !important; }
        #mplis-auto-panel.minimized .mplis-minimized-trigger { display: flex !important; animation: mplis-float 3s ease-in-out infinite; }
        @keyframes mplis-float { 0% { transform: translateY(0); } 50% { transform: translateY(-3px); } 100% { transform: translateY(0); } }

        /* ---- Shell: nav rail (trái) + nội dung (phải) ---- */
        .mplis-shell { display: flex; flex: 1; min-height: 0; }

        .mplis-tabs { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 56px; flex-shrink: 0; padding: 12px 0; background: rgba(0,0,0,0.18); border-right: 1px solid var(--mplis-border); overflow-y: auto; }
        .mplis-tab { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 11px; color: var(--mplis-text-dim); font-size: 18px; cursor: pointer; transition: all 0.15s ease; position: relative; }
        .mplis-tab:hover { color: var(--mplis-text); background: var(--mplis-surface); }
        .mplis-tab.active { color: #fff; background: linear-gradient(135deg, var(--mplis-accent), #4f46e5); box-shadow: 0 4px 14px rgba(99,102,241,0.45); }
        .mplis-tab[title]:hover::after { content: attr(title); position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 10px; background: #1e293b; color: #f1f5f9; font-size: 11px; font-weight: 600; padding: 5px 9px; border-radius: 6px; white-space: nowrap; box-shadow: 0 6px 16px rgba(0,0,0,0.4); pointer-events: none; z-index: 10; }

        .mplis-content { flex: 1; min-width: 0; overflow-y: auto; padding: 18px; }
        .mplis-content::-webkit-scrollbar, .mplis-tabs::-webkit-scrollbar { width: 6px; }
        .mplis-content::-webkit-scrollbar-thumb, .mplis-tabs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

        .mplis-panel-body { display: none; }
        .mplis-panel-body.active { display: block; animation: mplis-fade-in 0.2s ease; }
        @keyframes mplis-fade-in { from { opacity: 0; transform: translateY(3px);} to { opacity: 1; transform: translateY(0);} }

        .mplis-section-label { font-size: 10px; color: var(--mplis-text-dim); text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 8px; display: block; }
        .mplis-card { background: var(--mplis-surface); border: 1px solid var(--mplis-border); border-radius: 12px; padding: 12px; margin-bottom: 14px; }
        .mplis-hint { font-size: 11px; color: var(--mplis-text-dim); line-height: 1.6; margin-bottom: 12px; }

        .mplis-checkbox-group { display: flex !important; flex-direction: column !important; gap: 6px !important; }
        .mplis-checkbox-group label { display: flex !important; align-items: center !important; gap: 10px !important; font-size: 12px !important; color: #e2e8f0 !important; cursor: pointer !important; padding: 9px 10px !important; background: var(--mplis-surface) !important; border-radius: 9px !important; border: 1px solid var(--mplis-border) !important; transition: background 0.15s; }
        .mplis-checkbox-group label:hover { background: var(--mplis-surface-hover) !important; }
        .mplis-checkbox-group input, #mplis-auto-panel input[type="checkbox"] { accent-color: var(--mplis-accent); width: 15px; height: 15px; cursor: pointer; }

        .mplis-btn-primary { width: 100% !important; background: linear-gradient(135deg, var(--mplis-accent), #4f46e5) !important; border: none !important; border-radius: 10px !important; padding: 12px 16px !important; color: #ffffff !important; font-weight: 700 !important; font-size: 13px !important; cursor: pointer !important; letter-spacing: 0.02em; transition: all 0.15s ease !important; box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
        .mplis-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .mplis-btn-primary:active { transform: translateY(0); }
        .mplis-btn-primary.running { background: linear-gradient(135deg, var(--mplis-bad), #be123c) !important; box-shadow: 0 4px 14px rgba(244,63,94,0.35); }
        .mplis-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; filter: none; }

        .mplis-btn-ghost { background: var(--mplis-surface) !important; border: 1px solid var(--mplis-border) !important; color: var(--mplis-text) !important; border-radius: 9px !important; cursor: pointer !important; transition: all 0.15s ease !important; }
        .mplis-btn-ghost:hover { background: var(--mplis-surface-hover) !important; }

        .mplis-status-bar { margin-top: 12px !important; background: rgba(0,0,0,0.22) !important; border-radius: 10px !important; padding: 10px 12px !important; border: 1px solid var(--mplis-border) !important; }
        .mplis-status-row { display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 11.5px !important; }
        .mplis-status-lbl { display: flex !important; align-items: center !important; gap: 7px !important; color: #cbd5e1 !important; }
        .mplis-status-dot { width: 8px !important; height: 8px !important; border-radius: 50% !important; background-color: #64748b !important; flex-shrink: 0; }
        .mplis-status-dot.active { background-color: var(--mplis-good) !important; box-shadow: 0 0 8px rgba(34,197,94,0.7) !important; animation: mplis-pulse 1.5s infinite !important; }
        .mplis-status-dot.waiting { background-color: var(--mplis-warn) !important; box-shadow: 0 0 8px rgba(245,158,11,0.7) !important; }
        @keyframes mplis-pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

        .mplis-log { margin-top: 8px !important; font-family: 'Consolas', monospace !important; font-size: 10.5px !important; color: var(--mplis-text-dim) !important; border-top: 1px solid var(--mplis-border) !important; padding-top: 8px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }

        .mplis-highlight-target { outline: 3px solid var(--mplis-good) !important; box-shadow: 0 0 15px rgba(34,197,94,0.8) !important; border-radius: 4px !important; }
        .tab-return-color .mplis-highlight-target { outline-color: var(--mplis-warn) !important; box-shadow: 0 0 15px rgba(245,158,11,0.8) !important; }
        .tab-return-color .mplis-btn-primary { background: linear-gradient(135deg, #eab308, #ca8a04) !important; color: #1e293b !important; box-shadow: 0 4px 14px rgba(234,179,8,0.35); }
        .tab-return-color .mplis-btn-primary.running { background: linear-gradient(135deg, var(--mplis-bad), #be123c) !important; color: #fff !important; }

        .mplis-filter-tab.active { background: rgba(99,102,241,0.35) !important; color: #fff !important; }

        @media print { #mplis-auto-panel { display: none !important; } }
    `;
  if (typeof GM_addStyle !== "undefined") GM_addStyle(panelStyle);
  else {
    const s = document.createElement("style");
    s.innerHTML = panelStyle;
    document.head.appendChild(s);
  }

  // src/process-module.js
  var ProcessModule = function() {
    const defaultConfig = {
      activeWorkflows: ["QT0", "QT1", "QT2", "QT3"],
      isQT5: false,
      forwardUser: "",
      delayOpen: 500,
      delayAction: 500,
      delayNext: 500,
      selectorMainProcess: "button:contains('Xử lý hồ sơ'), a:contains('Xử lý hồ sơ'), .btn-process",
      selectorExecute: "button:contains('Thực hiện'), button:contains('Cập nhật'), button:contains('Chấp nhận'), button:contains('Đồng ý'), a:contains('Thực hiện')",
      selectorConfirm: "button:contains('Đồng ý'), button:contains('Xác nhận'), button:contains('OK'), button:contains('Có')"
    };
    function loadConfig() {
      const saved = localStorage.getItem("mplis_auto_config_v4_1");
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
      if (!topWin.MPLIS_AUTO_STATE) {
        topWin.MPLIS_AUTO_STATE = {
          isRunning: false,
          successCount: 0,
          lastActionTime: 0,
          currentLockDuration: 1200,
          config: loadConfig(),
          writeLog: function(text) {
            console.log("[MPLIS QT] " + text);
            const el = document.getElementById("mplis-step-log-process");
            if (el) el.textContent = text;
          },
          updateStatus: function(text, type) {
            const statusText = document.getElementById("mplis-status-text-process");
            const statusDot = document.getElementById("mplis-status-dot-process");
            if (statusText) statusText.textContent = text;
            if (statusDot) {
              statusDot.className = "mplis-status-dot";
              if (type === "active") statusDot.classList.add("active");
              if (type === "waiting") statusDot.classList.add("waiting");
            }
          },
          incrementSuccess: function() {
            this.successCount++;
            const el = document.getElementById("mplis-counter-val-process");
            if (el) el.textContent = this.successCount;
          }
        };
      }
    }
    function getTopState() {
      return topWin.MPLIS_AUTO_STATE;
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
              if (!isDone) {
                const interactives = Array.from(row.querySelectorAll('a, button, [role="button"]'));
                const targetBtn = interactives.find((el) => {
                  const btnText = (el.textContent || el.value || "").trim().toLowerCase();
                  return btnText.includes("xử lý") || btnText.includes("tác vụ");
                });
                if (targetBtn) {
                  return { button: targetBtn, taskName: tName, isDone: false };
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
    async function scanAndExecute() {
      try {
        const topState = getTopState();
        if (!topState || !topState.isRunning) return;
        const now = Date.now();
        const lockDuration = topState.currentLockDuration || 1200;
        if (topState.lastActionTime && now - topState.lastActionTime < lockDuration) return;
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
            const isQT1Confirm = msgLower.includes("cập nhật dữ liệu pháp lý") || titleLower.includes("cập nhật dữ liệu pháp lý");
            const isQT4Confirm = msgLower.includes("bạn có thật sự muốn kết iso hồ sơ này hay không");
            const isQT5Confirm = msgLower.includes("chuyển bước") || msgLower.includes("chuyển tiếp") || msgLower.includes("chuyển tác vụ") || msgLower.includes("chuyển");
            if (isQT1Confirm || isQT4Confirm || isQT5Confirm) {
              const agreeBtn = jconfirmBox.querySelector(".jconfirm-buttons .btn-orange, .jconfirm-buttons button:first-child");
              if (agreeBtn && !agreeBtn.hasAttribute("data-mplis-clicked")) {
                setLastActionTime(now, topState.config.delayNext);
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
                const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
                if (jq) jq(agreeBtn).click();
                else clickElement(agreeBtn);
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
                  const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
                  if (jq) jq(okBtn).click();
                  else clickElement(okBtn);
                  setLastActionTime(now, 500);
                  return;
                }
              }
              writeLog("⚠️ Hộp thoại không mong đợi: '" + jcTitle.trim() + "'. DỪNG AUTO.");
              updateStatus("Hộp thoại lạ - Dừng", "idle");
              if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: PHÁT HIỆN HỘP THOẠI LẠ!");
              return;
            }
          }
        }
        const confirmBtns = querySelectorAllCustom(topState.config.selectorConfirm);
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
          writeLog("⚠️ Phát hiện thông báo lỗi lạ/sai hồ sơ. DỪNG AUTO!");
          updateStatus("Lỗi - Dừng Auto", "idle");
          if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC("⚠️ LỖI: PHÁT HIỆN THÔNG BÁO LẠ!");
          return;
        }
        if (visibleConfirmBtns.length > 0) {
          const confirmBtn = visibleConfirmBtns[visibleConfirmBtns.length - 1];
          if (!confirmBtn.hasAttribute("data-mplis-clicked")) {
            setLastActionTime(now, topState.config.delayNext);
            writeLog("Phát hiện popup xác nhận. Tự động bấm 'Đồng ý'...");
            confirmBtn.setAttribute("data-mplis-clicked", "true");
            setTimeout(() => {
              try {
                confirmBtn.removeAttribute("data-mplis-clicked");
              } catch (e) {
              }
            }, 3e3);
            const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
            if (jq) jq(confirmBtn).click();
            else clickElement(confirmBtn);
            incrementSuccess();
            updateStatus("Chờ lưu...", "waiting");
            return;
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
            if (!topState.qt0Phase || topState.qt0Phase === 0) {
              if (!btnUpdateAttactFile.hasAttribute("data-mplis-clicked")) {
                writeLog("Bấm 'Cập nhật' tệp đính kèm...");
                btnUpdateAttactFile.setAttribute("data-mplis-clicked", "true");
                clickElement(btnUpdateAttactFile);
                topState.qt0Phase = 1;
                setLastActionTime(now, 1e3);
                return;
              }
            } else if (topState.qt0Phase === 1) {
              const rows = Array.from(tbGiayToDinhKem.querySelectorAll("tbody tr"));
              const hasLoadedFiles = rows.some((tr) => {
                const text = tr.textContent.toUpperCase();
                return text.includes("NHẬP THÔNG TIN") && (text.includes(".PDF") || text.includes("GT.PDF"));
              });
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
                    setLastActionTime(now, 1e3);
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
                setLastActionTime(now, topState.config.delayAction);
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
                setLastActionTime(now, topState.config.delayAction);
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
                  sBtn.setAttribute("data-mplis-clicked", "true");
                  clickElement(sBtn);
                  setTimeout(() => {
                    try {
                      sBtn.removeAttribute("data-mplis-clicked");
                    } catch (e) {
                    }
                  }, 5e3);
                  setLastActionTime(now, topState.config.delayNext);
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
                setLastActionTime(now, 2e3);
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
          } else if (now - topState.lastActionTime > 15e3) {
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
              setLastActionTime(now, topState.config.delayAction);
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
                setLastActionTime(now, topState.config.delayNext);
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
            setLastActionTime(now, topState.config.delayOpen);
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
            setLastActionTime(now, 800);
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
        if (isInsideQT2) {
          if (!topState._qt2DebugLast || now - topState._qt2DebugLast > 5e3) {
            topState._qt2DebugLast = now;
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
            if (!chkSelectAll.hasAttribute("data-mplis-clicked")) {
              writeLog("Xử lý chống cache cho Checkbox Select All...");
              chkSelectAll.setAttribute("data-mplis-clicked", "true");
              try {
                chkSelectAll.classList.add("mplis-highlight-target");
                setTimeout(() => {
                  try {
                    chkSelectAll.classList.remove("mplis-highlight-target");
                  } catch (e) {
                  }
                }, 1200);
                const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
                if (chkSelectAll.checked) {
                  if (jq) jq("#chkSelectAll").click();
                  else chkSelectAll.click();
                }
                setTimeout(() => {
                  try {
                    if (jq) jq("#chkSelectAll").click();
                    else chkSelectAll.click();
                  } catch (err) {
                    chkSelectAll.click();
                  }
                  setTimeout(() => {
                    if (topState.qt2SoPhatHanhList && topState.qt2SoPhatHanhList.length > 0) {
                      const fileRows = Array.from(document.querySelectorAll("#tbDanhSachGiayToDinhKem tbody tr"));
                      for (const row of fileRows) {
                        const cb = row.querySelector('input[type="checkbox"]');
                        if (cb) {
                          const fileName = (row.textContent || "").toUpperCase();
                          if (fileName.includes(".PDF")) {
                            const matchSPH = fileName.match(/[A-Z]{2}\s*\d+/);
                            if (matchSPH) {
                              const sphFile = matchSPH[0].replace(/\s+/g, "").toUpperCase();
                              const totalDons = document.querySelectorAll("#lstDonDangKy ul.dondangky-item").length;
                              if (totalDons > 1 && !topState.qt2SoPhatHanhList.includes(sphFile) && cb.checked) {
                                if (jq) jq(cb).click();
                                else cb.click();
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
                setTimeout(() => {
                  chkSelectAll.click();
                }, 250);
              }
              setLastActionTime(now, 1200);
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
                setLastActionTime(now, topState.config.delayOpen);
                topState.qt2Phase = 1;
                chkSelectAll.removeAttribute("data-mplis-clicked");
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
                setLastActionTime(now, topState.config.delayOpen);
                return;
              }
            } else if (topState.qt2Phase === 1) {
              const rows = Array.from(document.querySelectorAll("#tbDanhSachFile tbody tr"));
              if (rows.length === 0 || rows.some((tr) => tr.textContent.includes("Không có dữ liệu") || tr.textContent.includes("đang tải"))) {
                updateStatus("Đợi file tải lên...", "waiting");
                return;
              }
              let targetRow = rows.find((tr) => {
                const t = tr.textContent.toUpperCase();
                return t.includes(".PDF") && t.includes("GIẤY TỜ HỒ SƠ") && !t.includes("GT.PDF");
              });
              if (targetRow) {
                const editBtn = targetRow.querySelector("#btnEditHoSoQuet");
                if (editBtn && !editBtn.hasAttribute("data-mplis-clicked")) {
                  topState.qt2SphIndex = topState.qt2SphIndex || 0;
                  let assignedSph = null;
                  if (topState.qt2SoPhatHanhList && topState.qt2SphIndex < topState.qt2SoPhatHanhList.length) {
                    assignedSph = topState.qt2SoPhatHanhList[topState.qt2SphIndex];
                  }
                  writeLog(`Bấm 'Chỉnh sửa' file đính kèm${assignedSph ? " (Gán: " + assignedSph + ")" : ""}...`);
                  editBtn.setAttribute("data-mplis-clicked", "true");
                  clickElement(editBtn);
                  const oldBtnLuu = document.querySelector("#btnLuuHoSoQuet");
                  if (oldBtnLuu) oldBtnLuu.removeAttribute("data-mplis-clicked");
                  topState.qt2Phase = 2;
                  topState.qt2EditingSph = assignedSph;
                  setLastActionTime(now, 500);
                  return;
                }
              } else {
                topState.qt2Phase = 3;
                return;
              }
            } else if (topState.qt2Phase === 2) {
              const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
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
                  if (jq) jq(selLoaiGiayTo).val("1").trigger("change");
                  selLoaiGiayTo.dispatchEvent(new Event("change", { bubbles: true }));
                  writeLog("Đã đổi Loại giấy tờ thành 'Giấy chứng nhận'");
                  setLastActionTime(now, 500);
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
                if (selMoTaList.length > 0) {
                  const selMoTa = selMoTaList[selMoTaList.length - 1];
                  const options = Array.from(selMoTa.options);
                  const targetOpt = options.find((opt) => opt.textContent.replace(/\s+/g, "").toUpperCase().includes(topState.qt2EditingSph));
                  if (targetOpt && selMoTa.value !== targetOpt.value) {
                    selMoTa.value = targetOpt.value;
                    if (jq) jq(selMoTa).val(targetOpt.value).trigger("change");
                    selMoTa.dispatchEvent(new Event("change", { bubbles: true }));
                    writeLog(`Đã gán Giấy chứng nhận: ${topState.qt2EditingSph}`);
                    setLastActionTime(now, 200);
                    return;
                  }
                }
              }
              const btnLuuSub = document.querySelector("#btnLuuHoSoQuet");
              if (btnLuuSub && !btnLuuSub.hasAttribute("data-mplis-clicked")) {
                writeLog("Bấm 'Lưu' chi tiết file...");
                btnLuuSub.setAttribute("data-mplis-clicked", "true");
                clickElement(btnLuuSub);
                if (topState.qt2EditingSph) {
                  topState.qt2SphIndex = (topState.qt2SphIndex || 0) + 1;
                }
                topState.qt2Phase = 1;
                setLastActionTime(now, topState.config.delayAction);
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
                const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
                if (jq) {
                  jq(unprocessedDon).click();
                  jq(unprocessedDon).trigger("click");
                }
              } catch (e) {
              }
              setLastActionTime(now, 1500);
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
                  topState.qt2SoPhatHanhList = [];
                  const activeTreeContainer = Array.from(document.querySelectorAll("#treeGiayChungNhan")).find((el) => {
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
                  setLastActionTime(now, topState.config.delayOpen);
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
            setLastActionTime(now, topState.config.delayAction);
            writeLog("Tìm thấy nút 'Thực hiện'. Đang click...");
            clickElement(execBtn);
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
                  setLastActionTime(now, topState.config.delayOpen);
                  return;
                } else if (fwdTable && (() => {
                  try {
                    return fwdTable.getBoundingClientRect().width > 0;
                  } catch (e) {
                    return false;
                  }
                })()) {
                } else if (btnChuyenTiep && btnChuyenTiep.hasAttribute("data-mplis-clicked")) {
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
                  setLastActionTime(now, topState.config.delayOpen);
                  if (targetRowData.taskName.toLowerCase().includes("địa chính")) {
                    topState.processedParcelIndexes = /* @__PURE__ */ new Set();
                  }
                  if (targetRowData.taskName.toLowerCase().includes("lưu kho") || targetRowData.taskName.toLowerCase().includes("hồ sơ quét")) {
                    topState.processedDonIndexes = /* @__PURE__ */ new Set();
                    topState.qt2FileSelected = false;
                  }
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
            setLastActionTime(now, topState.config.delayOpen);
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
    setInterval(scanAndExecute, 1200);
    return {
      getTopState,
      saveConfig: function(cfg) {
        const s = getTopState();
        if (s) {
          s.config = { ...s.config, ...cfg };
          localStorage.setItem("mplis_auto_config_v4_1", JSON.stringify(s.config));
        }
      }
    };
  }();

  // src/return-module.js
  var ReturnModule = function() {
    const defaultConfig = { delayOpen: 500, delayAction: 500, delayNext: 500 };
    function loadConfig() {
      const saved = localStorage.getItem("mplis_auto_trahoso_config");
      if (saved) {
        try {
          return { ...defaultConfig, ...JSON.parse(saved) };
        } catch (e) {
        }
      }
      return defaultConfig;
    }
    if (window === window.top) {
      if (!topWin.MPLIS_AUTO_TRAHOSO_STATE) {
        topWin.MPLIS_AUTO_TRAHOSO_STATE = {
          isRunning: false,
          successCount: 0,
          lastActionTime: 0,
          currentLockDuration: 1200,
          config: loadConfig(),
          writeLog: function(text) {
            console.log("[MPLIS TraHoSo] " + text);
            const el = document.getElementById("mplis-step-log-return");
            if (el) el.textContent = text;
          },
          updateStatus: function(text, type) {
            const statusText = document.getElementById("mplis-status-text-return");
            const statusDot = document.getElementById("mplis-status-dot-return");
            if (statusText) statusText.textContent = text;
            if (statusDot) {
              statusDot.className = "mplis-status-dot";
              if (type === "active") statusDot.classList.add("active");
              if (type === "waiting") statusDot.classList.add("waiting");
            }
          },
          incrementSuccess: function() {
            this.successCount++;
            const el = document.getElementById("mplis-counter-val-return");
            if (el) el.textContent = this.successCount;
          }
        };
      }
    }
    function getTopState() {
      return topWin.MPLIS_AUTO_TRAHOSO_STATE;
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
    async function scanAndExecute() {
      try {
        const topState = getTopState();
        if (!topState || !topState.isRunning) return;
        const now = Date.now();
        const lockDuration = topState.currentLockDuration || 1200;
        if (topState.lastActionTime && now - topState.lastActionTime < lockDuration) return;
        if (isSystemLoading()) {
          updateStatus("Hệ thống đang xử lý...", "waiting");
          return;
        }
        const jconfirmBox = document.querySelector(".jconfirm-box");
        if (jconfirmBox) {
          const jcRect = jconfirmBox.getBoundingClientRect();
          if (jcRect.width > 0 && jcRect.height > 0) {
            const jcMessage = (jconfirmBox.querySelector(".jconfirm-content, .jconfirm-message") || {}).textContent || "";
            if (jcMessage.toLowerCase().includes("thật sự muốn trả hồ sơ")) {
              const agreeBtn = jconfirmBox.querySelector(".jconfirm-buttons .btn-orange, .jconfirm-buttons button:first-child");
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
        const btnLuuTraHoSo = document.querySelector("#btnLuuTraHoSo");
        if (btnLuuTraHoSo && (() => {
          try {
            return btnLuuTraHoSo.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        })()) {
          if (!btnLuuTraHoSo.hasAttribute("data-mplis-clicked")) {
            setLastActionTime(now, topState.config.delayAction);
            btnLuuTraHoSo.setAttribute("data-mplis-clicked", "true");
            writeLog("Bấm 'Thực hiện' lưu trả hồ sơ...");
            clickElement(btnLuuTraHoSo);
            updateStatus("Chờ xác nhận...", "waiting");
            return;
          } else {
            updateStatus("Đợi xác nhận...", "waiting");
            return;
          }
        }
        const btnXuLyTacVuList = Array.from(document.querySelectorAll('.btnXuLyTacVu[data-actioncode="TraHoSo"]'));
        const visibleBtnXuLyTacVu = btnXuLyTacVuList.filter((el) => {
          try {
            return el.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        });
        if (visibleBtnXuLyTacVu.length > 0) {
          const btn = visibleBtnXuLyTacVu[0];
          const tr = btn.closest("tr");
          if (tr) {
            const checkbox = tr.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
              const closeBtn = document.querySelector('button.close, .modal-header .close, button[data-dismiss="modal"]');
              if (closeBtn && (() => {
                try {
                  return closeBtn.getBoundingClientRect().width > 0;
                } catch (e) {
                  return false;
                }
              })()) {
                if (!closeBtn.hasAttribute("data-mplis-clicked")) {
                  closeBtn.setAttribute("data-mplis-clicked", "true");
                  setLastActionTime(now, topState.config.delayNext);
                  writeLog("Đã xử lý xong tác vụ. Đóng bảng...");
                  clickElement(closeBtn);
                  return;
                }
              }
            } else if (!btn.hasAttribute("data-mplis-clicked")) {
              setLastActionTime(now, topState.config.delayAction);
              btn.setAttribute("data-mplis-clicked", "true");
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
        const isAnyModalOpen = Array.from(document.querySelectorAll(".modal.in, .modal.show, .k-window, .ui-dialog, .dx-popup-content")).some((el) => {
          try {
            return el.getBoundingClientRect().width > 0;
          } catch (e) {
            return false;
          }
        });
        if (isAnyModalOpen) {
          updateStatus("Đang mở bảng...", "waiting");
          return;
        }
        const rows = Array.from(document.querySelectorAll("tr"));
        let targetRow = null;
        let hasAnyTargetInTable = false;
        for (const row of rows) {
          if (row.querySelector("th")) continue;
          try {
            if (row.getBoundingClientRect().width === 0) continue;
          } catch (e) {
            continue;
          }
          const rowText = (row.textContent || "").toLowerCase();
          if (rowText.includes("5. trả kết quả hồ sơ") || rowText.includes("6. trả kết quả hồ sơ") || rowText.includes("9. trả kết quả hồ sơ")) {
            hasAnyTargetInTable = true;
            if (row.getAttribute("data-mplis-processed") !== "true") {
              targetRow = row;
              break;
            }
          }
        }
        if (targetRow) {
          if (targetRow.getAttribute("data-mplis-selected") !== "true") {
            targetRow.setAttribute("data-mplis-selected", "true");
            const firstTd = targetRow.querySelector("td");
            if (firstTd) clickElement(firstTd);
            clickElement(targetRow);
            const input = targetRow.querySelector('input[type="radio"], input[type="checkbox"]');
            if (input) {
              input.checked = true;
              try {
                input.dispatchEvent(new Event("change", { bubbles: true }));
              } catch (e) {
              }
              clickElement(input);
            }
            try {
              const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
              if (win.$) {
                const $row = win.$(targetRow);
                $row.click();
              }
            } catch (e) {
            }
            setLastActionTime(now, 800);
            writeLog("Đã chọn hồ sơ (5/6/9). Chờ bấm Xử lý hồ sơ...");
            updateStatus("Chọn hồ sơ...", "waiting");
            return;
          } else {
            const btnXuly = document.querySelector("#btnXuly") || Array.from(document.querySelectorAll("button, a")).find((el) => {
              const text = (el.textContent || "").trim().toLowerCase();
              return text === "xử lý hồ sơ";
            });
            if (btnXuly && (() => {
              try {
                return btnXuly.getBoundingClientRect().width > 0;
              } catch (e) {
                return false;
              }
            })()) {
              setLastActionTime(now, topState.config.delayOpen);
              writeLog("Bấm 'Xử lý hồ sơ'...");
              clickElement(btnXuly);
              targetRow.setAttribute("data-mplis-processed", "true");
              updateStatus("Chờ mở bảng...", "waiting");
              return;
            } else {
              updateStatus("Đợi nút Xử lý hồ sơ...", "waiting");
            }
          }
        } else {
          if (!hasAnyTargetInTable) {
            writeLog("Không có hồ sơ Trả kết quả (5, 6, 9) nào. Dừng Auto.");
            updateStatus("Hoàn thành", "idle");
            if (typeof topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC("🎉 KHÔNG TÌM THẤY HỒ SƠ ĐỂ TRẢ!");
            return;
          } else {
            const hasDone = rows.some((r) => r.getAttribute("data-mplis-processed") === "true");
            if (hasDone) {
              writeLog("Hoàn thành! Đã quét hết hồ sơ Trả kết quả (5, 6, 9).");
              updateStatus("Hoàn thành", "idle");
              if (typeof topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC("🎉 ĐÃ HOÀN THÀNH TOÀN BỘ!");
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
      getTopState,
      saveConfig: function(cfg) {
        const s = getTopState();
        if (s) {
          s.config = { ...s.config, ...cfg };
          localStorage.setItem("mplis_auto_trahoso_config", JSON.stringify(s.config));
        }
      }
    };
  }();

  // src/update-parcel-module.js
  var UpdateParcelModule = function() {
    const state = {
      isRunning: false,
      excelData: [],
      currentIndex: 0,
      logBuffer: [],
      config: {
        delayAction: 1500,
        delayPageLoad: 3e3
      }
    };
    function writeLog(msg) {
      const logContent = document.getElementById("vbdlis-logs");
      if (!logContent) return;
      const time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      logContent.innerHTML += `[${time}] ${msg}
`;
      logContent.scrollTop = logContent.scrollHeight;
    }
    function parseExcelInput() {
      const rawText = document.getElementById("update-excel-input").value.trim();
      if (!rawText) {
        writeLog("⚠️ Chưa có dữ liệu Excel được dán vào!");
        return;
      }
      const lines = rawText.split("\n");
      const parsed = [];
      const groupCounts = {};
      lines.forEach((line, idx) => {
        const cols = line.split("	").map((c) => c.trim());
        if (line.toLowerCase().includes("số phát hành") || line.toLowerCase().includes("tham chiếu")) {
          return;
        }
        if (cols.length >= 4) {
          let sph = "";
          let newTo, rawNewThua, oldTo, oldThua;
          if (cols.length >= 5) {
            sph = cols[0].toUpperCase();
            newTo = cols[1];
            rawNewThua = cols[2];
            oldTo = cols[3];
            oldThua = cols[4];
          } else {
            sph = "";
            newTo = cols[0];
            rawNewThua = cols[1];
            oldTo = cols[2];
            oldThua = cols[3];
          }
          let thuaList = rawNewThua.split(/[,;.]+/).map((x) => x.trim()).filter((x) => x);
          if (thuaList.length === 0) thuaList = [rawNewThua];
          let groupKey = `${sph}_${newTo}_${rawNewThua}`;
          groupCounts[groupKey] = (groupCounts[groupKey] || 0) + 1;
          const extractNum = (str) => {
            const match = str.match(/\d+/);
            return match ? match[0] : str;
          };
          parsed.push({
            sph,
            newTo,
            newThuaList: thuaList,
            newThua: thuaList[0],
            // Lấy số đầu tiên
            newThuaIndex: 0,
            oldTo: extractNum(oldTo),
            oldThua: extractNum(oldThua),
            groupKey
          });
        }
      });
      if (parsed.length === 0) {
        writeLog("❌ Không thể phân tích dữ liệu. Vui lòng kiểm tra lại cấu trúc cột!");
        return;
      }
      parsed.forEach((t) => {
        t.isGroup = groupCounts[t.groupKey] > 1;
      });
      state.excelData = parsed;
      state.groupSuccess = {};
      state.currentIndex = 0;
      document.getElementById("stat-total").textContent = parsed.length;
      document.getElementById("stat-current").textContent = "1";
      document.getElementById("btn-update-start").removeAttribute("disabled");
      writeLog(`✅ Đã phân tích xong ${parsed.length} dòng dữ liệu!`);
      console.log("Parsed Excel Data:", parsed);
    }
    function startAuto() {
      if (state.excelData.length === 0) return;
      state.isRunning = true;
      document.getElementById("stat-status").textContent = "Đang chạy...";
      document.getElementById("stat-status").className = "status-running";
      document.getElementById("btn-update-start").style.display = "none";
      document.getElementById("btn-update-stop").style.display = "block";
      writeLog("▶️ Bắt đầu tiến trình tự động...");
    }
    function stopAuto() {
      state.isRunning = false;
      document.getElementById("stat-status").textContent = "Tạm dừng";
      document.getElementById("stat-status").className = "status-paused";
      document.getElementById("btn-update-start").style.display = "block";
      document.getElementById("btn-update-stop").style.display = "none";
      writeLog("⏸️ Đã tạm dừng tiến trình Auto.");
    }
    function isPageLoading() {
      try {
        const commonLoaders = Array.from(document.querySelectorAll(".loading, .loader, #loading, #loader, .k-loading-mask, .blockUI.blockOverlay, .blockUI.blockMsg, .dx-loadpanel, #AjaxLoader, .dataTables_processing"));
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
    function getVisibleElement(selector) {
      const els = Array.from(document.querySelectorAll(selector));
      return els.find((el) => el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).display !== "none");
    }
    setInterval(() => {
      if (!state.isRunning) return;
      if (isPageLoading()) {
        return;
      }
      if (state.currentIndex >= state.excelData.length) {
        writeLog("🎉 Hoàn thành cập nhật toàn bộ danh sách Excel!");
        stopAuto();
        return;
      }
      const task = state.excelData[state.currentIndex];
      document.getElementById("stat-current").textContent = state.currentIndex + 1;
      if (!state.step) {
        state.step = "OPEN_SEARCH";
      }
      const jq = typeof unsafeWindow !== "undefined" && unsafeWindow.$ ? unsafeWindow.$ : null;
      switch (state.step) {
        case "OPEN_SEARCH":
          if (task.isGroup && state.groupSuccess[task.groupKey]) {
            writeLog(`⏭️ Nhóm gộp thửa đã có 1 thửa đại diện thành công. Bỏ qua thửa cũ ${task.oldThua} (Đã ứng đại diện).`);
            task.resultStatus = "Đã ứng đại diện";
            state.step = "NEXT_TASK";
            break;
          }
          const btnSearch = getVisibleElement("#btnChonDonDangKy");
          if (btnSearch) {
            writeLog("Bước 1: Bấm nút 'Tra cứu'...");
            if (jq) jq(btnSearch).click();
            else btnSearch.click();
            state.step = "WAIT_OPEN_SEARCH";
            state.lastOpenSearchTime = Date.now();
          }
          break;
        case "WAIT_OPEN_SEARCH":
          if (Date.now() - state.lastOpenSearchTime > 400) {
            const btnRefresh = getVisibleElement("#btnKhoiTaoTraCuuTinhHinhDangKyChiTiet");
            if (btnRefresh) {
              writeLog("Làm mới form tra cứu để xóa kết quả cũ...");
              if (jq) jq(btnRefresh).click();
              else btnRefresh.click();
            }
            task.searchAttempt = task.searchAttempt || 0;
            if (task.sph) {
              state.step = "SEARCH_SPH";
            } else {
              writeLog(`⚠️ Đơn này KHÔNG CÓ Số Phát Hành. Tự động chuyển thẳng sang tìm bằng Tờ/Thửa cũ...`);
              task.searchAttempt = 1;
              state.step = "SEARCH_FALLBACK";
            }
          }
          break;
        case "SEARCH_SPH":
          const inputSPH = getVisibleElement('input[name="soPhatHanh"]');
          const btnSubmitSearch = getVisibleElement("#btnTraCuuTinhHinhDangKy");
          if (inputSPH && btnSubmitSearch) {
            writeLog(`Bước 2: Nhập SPH [${task.sph}] và tìm kiếm...`);
            state.step = "WAIT_SEARCH";
            setTimeout(() => {
              inputSPH.value = task.sph;
              inputSPH.dispatchEvent(new Event("input", { bubbles: true }));
              inputSPH.dispatchEvent(new Event("change", { bubbles: true }));
              setTimeout(() => {
                if (jq) jq(btnSubmitSearch).click();
                else btnSubmitSearch.click();
                state.step = "WAIT_SEARCH_RESULT";
                state.lastSearchTime = Date.now();
              }, 200);
            }, 200);
          }
          break;
        case "SEARCH_FALLBACK":
          const inputToCu = getVisibleElement('input[name="soHieuToBanDoCu"]');
          const inputThuaCu = getVisibleElement('input[name="soThuTuThuaCu"]');
          const btnSubmitSearch2 = getVisibleElement("#btnTraCuuTinhHinhDangKy");
          if (inputToCu && inputThuaCu && btnSubmitSearch2) {
            writeLog(`Bước 2 (Dự phòng 1): Nhập Tờ cũ [${task.oldTo}] & Thửa cũ [${task.oldThua}] và tìm kiếm...`);
            state.step = "WAIT_SEARCH";
            setTimeout(() => {
              inputToCu.value = task.oldTo;
              inputToCu.dispatchEvent(new Event("input", { bubbles: true }));
              inputToCu.dispatchEvent(new Event("change", { bubbles: true }));
              inputThuaCu.value = task.oldThua;
              inputThuaCu.dispatchEvent(new Event("input", { bubbles: true }));
              inputThuaCu.dispatchEvent(new Event("change", { bubbles: true }));
              setTimeout(() => {
                if (jq) jq(btnSubmitSearch2).click();
                else btnSubmitSearch2.click();
                state.step = "WAIT_SEARCH_RESULT";
                state.lastSearchTime = Date.now();
              }, 200);
            }, 200);
          } else {
            writeLog(`⚠️ Lỗi giao diện: Không tìm thấy ô nhập Tờ/Thửa cũ.`);
            task.resultStatus = "Lỗi giao diện (thiếu ô Tờ/Thửa cũ)";
            state.step = "NEXT_TASK";
            const btnCloseSearch2 = getVisibleElement("#TraCuuTinhHinhDangKy .close") || getVisibleElement('button[data-dismiss="modal"].close');
            if (btnCloseSearch2) {
              if (jq) jq(btnCloseSearch2).click();
              else btnCloseSearch2.click();
            }
          }
          break;
        case "SEARCH_FALLBACK_2":
          const inputToMacDinh = getVisibleElement('input[name="soHieuToBanDo"]');
          const inputThuaMacDinh = getVisibleElement('input[name="soThuTuThua"]');
          const btnSubmitSearch3 = getVisibleElement("#btnTraCuuTinhHinhDangKy");
          if (inputToMacDinh && inputThuaMacDinh && btnSubmitSearch3) {
            writeLog(`Bước 2 (Dự phòng 2): Nhập Tờ mặc định [${task.oldTo}] & Thửa mặc định [${task.oldThua}] và tìm kiếm...`);
            state.step = "WAIT_SEARCH";
            setTimeout(() => {
              inputToMacDinh.value = task.oldTo;
              inputToMacDinh.dispatchEvent(new Event("input", { bubbles: true }));
              inputToMacDinh.dispatchEvent(new Event("change", { bubbles: true }));
              inputThuaMacDinh.value = task.oldThua;
              inputThuaMacDinh.dispatchEvent(new Event("input", { bubbles: true }));
              inputThuaMacDinh.dispatchEvent(new Event("change", { bubbles: true }));
              setTimeout(() => {
                if (jq) jq(btnSubmitSearch3).click();
                else btnSubmitSearch3.click();
                state.step = "WAIT_SEARCH_RESULT";
                state.lastSearchTime = Date.now();
              }, 200);
            }, 200);
          } else {
            writeLog(`⚠️ Lỗi giao diện: Không tìm thấy ô nhập Tờ/Thửa mặc định.`);
            task.resultStatus = "Lỗi giao diện (thiếu ô Tờ/Thửa mặc định)";
            state.step = "NEXT_TASK";
            const btnCloseSearch3 = getVisibleElement("#TraCuuTinhHinhDangKy .close") || getVisibleElement('button[data-dismiss="modal"].close');
            if (btnCloseSearch3) {
              if (jq) jq(btnCloseSearch3).click();
              else btnCloseSearch3.click();
            }
          }
          break;
        case "WAIT_SEARCH":
          break;
        case "WAIT_SEARCH_RESULT":
          if (Date.now() - state.lastSearchTime > 1200) {
            state.step = "SELECT_DOSSIER";
          }
          break;
        case "SELECT_DOSSIER":
          const visibleTable = getVisibleElement("#tblTraCuuTinhHinhDangKy");
          if (!visibleTable) {
            if (Date.now() - state.lastSearchTime > 8e3) {
              writeLog(`⚠️ Không tìm thấy bảng kết quả tra cứu. Bỏ qua.`);
              task.resultStatus = "Lỗi giao diện (không thấy bảng)";
              state.step = "NEXT_TASK";
            }
            break;
          }
          const tbody = visibleTable.querySelector("tbody");
          const emptyCell = tbody ? tbody.querySelector("td.dataTables_empty") : null;
          if (emptyCell && emptyCell.textContent.toLowerCase().includes("không tìm thấy")) {
            task.searchAttempt = task.searchAttempt || 0;
            if (task.searchAttempt === 0) {
              writeLog(`⚠️ Không tìm thấy SPH [${task.sph}]. Chuyển sang tìm dự phòng (1) bằng Tờ/Thửa cũ...`);
              task.searchAttempt = 1;
              const btnRefresh = getVisibleElement("#btnKhoiTaoTraCuuTinhHinhDangKyChiTiet");
              if (btnRefresh) {
                if (jq) jq(btnRefresh).click();
                else btnRefresh.click();
              }
              state.step = "SEARCH_FALLBACK";
            } else if (task.searchAttempt === 1) {
              writeLog(`⚠️ Không tìm thấy bằng Tờ/Thửa cũ. Chuyển sang tìm dự phòng (2) bằng Tờ/Thửa mặc định...`);
              task.searchAttempt = 2;
              const btnRefresh = getVisibleElement("#btnKhoiTaoTraCuuTinhHinhDangKyChiTiet");
              if (btnRefresh) {
                if (jq) jq(btnRefresh).click();
                else btnRefresh.click();
              }
              state.step = "SEARCH_FALLBACK_2";
            } else {
              writeLog(`⚠️ Đã thử tìm bằng CẢ 3 CÁCH (SPH, Tờ/Thửa cũ, Tờ/Thửa mặc định) nhưng vẫn KHÔNG CÓ ĐƠN. Bỏ qua.`);
              task.resultStatus = "Không tìm thấy đơn (thử cả 3 cách)";
              const btnCloseSearch = getVisibleElement("#TraCuuTinhHinhDangKy .close") || getVisibleElement('button[data-dismiss="modal"].close');
              if (btnCloseSearch) {
                if (jq) jq(btnCloseSearch).click();
                else btnCloseSearch.click();
              }
              state.step = "NEXT_TASK";
            }
            break;
          }
          const rawRows = tbody ? Array.from(tbody.querySelectorAll("tr:not(.dataTables_empty)")) : [];
          const rows = rawRows.filter((r) => r.offsetWidth > 0 && r.parentElement === tbody);
          const btnSelect = getVisibleElement("#btnLuuChonTinhHinhDangKy");
          if (rows.length > 1) {
            console.log("CHI TIẾT LỖI TRÙNG ĐƠN - Các dòng thu được:", rows.map((r) => r.outerHTML));
            writeLog(`⚠️ SPH [${task.sph}] có ${rows.length} đơn (Trùng đơn) → Bỏ qua và đóng tìm kiếm.`);
            task.resultStatus = `Trùng đơn (${rows.length} kết quả)`;
            const btnCloseSearch = getVisibleElement("#TraCuuTinhHinhDangKy .close") || getVisibleElement('button[data-dismiss="modal"].close');
            if (btnCloseSearch) {
              if (jq) jq(btnCloseSearch).click();
              else btnCloseSearch.click();
            }
            state.step = "NEXT_TASK";
            break;
          }
          if (rows.length === 1 && btnSelect) {
            const row = rows[0];
            writeLog("Bước 3: Tìm thấy Đơn. Tiến hành chọn đơn...");
            const cb = row.querySelector("td.select-checkbox");
            if (jq) {
              if (cb) jq(cb).click();
              jq(row).click();
              jq(row).addClass("selected");
            } else {
              if (cb) cb.click();
              row.click();
              row.classList.add("selected");
            }
            setTimeout(() => {
              writeLog("Bấm 'Đồng ý' chọn đơn...");
              if (jq) jq(btnSelect).click();
              else btnSelect.click();
            }, 800);
            state.step = "OPEN_PARCEL";
            state.lastOpenParcelTime = Date.now();
          } else {
            if (Date.now() - state.lastSearchTime > 8e3) {
              writeLog(`⚠️ Không tìm thấy Đơn cho SPH: ${task.sph}. Bỏ qua.`);
              task.resultStatus = "Không tìm thấy Đơn";
              state.step = "NEXT_TASK";
            }
          }
          break;
        case "OPEN_PARCEL":
          const tree = document.getElementById("treeTaiSan");
          if (tree) {
            const anchors = Array.from(tree.querySelectorAll("a.jstree-anchor"));
            writeLog(`🔍 Đang tìm thửa cũ: Thửa ${task.oldThua}, Tờ ${task.oldTo} (Dạng hiển thị: ${task.oldThua} (${task.oldTo}))`);
            console.log("Danh sách thửa trên VBDLIS:", anchors.map((a) => (a.textContent || "").trim()));
            const cleanOldThua = parseInt(task.oldThua, 10).toString();
            const cleanOldTo = parseInt(task.oldTo, 10).toString();
            const targetAnchor = anchors.find((a) => {
              const txt = (a.textContent || "").trim();
              const cleanTxt = txt.replace(/\s+/g, "");
              const cleanTarget1 = `${cleanOldThua}(${cleanOldTo})`;
              const cleanTarget2 = `cũ:${cleanOldThua}(${cleanOldTo})`;
              return cleanTxt.includes(cleanTarget1) || cleanTxt.includes(cleanTarget2);
            });
            if (targetAnchor) {
              writeLog(`🎯 Đã tìm thấy thửa cũ khớp trên cây tài sản! Đang chọn...`);
              if (!targetAnchor.classList.contains("jstree-clicked")) {
                if (jq) jq(targetAnchor).click();
                else targetAnchor.click();
              }
              const btnSua = document.getElementById("btnSuaTaiSan");
              if (btnSua) {
                setTimeout(() => {
                  writeLog("Bấm nút 'Sửa' thửa đất...");
                  if (jq) jq(btnSua).click();
                  else btnSua.click();
                }, 500);
                state.step = "EDIT_PARCEL";
                state.lastEditParcelTime = Date.now();
              }
            } else {
              const cleanNewTo = parseInt(task.newTo, 10).toString();
              const alreadyUpdatedAnchor = anchors.find((a) => {
                const txt = (a.textContent || "").trim();
                const cleanTxt = txt.replace(/\s+/g, "");
                return task.newThuaList.some((newTh) => {
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
                state.step = "REMOVE_DOSSIER";
                state.lastRemoveTime = Date.now();
              } else {
                if (Date.now() - state.lastOpenParcelTime > 1e4) {
                  writeLog(`⚠️ Không tìm thấy thửa cũ [Thửa ${task.oldThua} (Tờ ${task.oldTo})] → Bỏ đơn ra danh sách.`);
                  task.resultStatus = `Không tìm thấy thửa ${task.oldThua} (${task.oldTo})`;
                  state.step = "REMOVE_DOSSIER";
                  state.lastRemoveTime = Date.now();
                }
              }
            }
          }
          break;
        case "EDIT_PARCEL":
          const formThuaDat = getVisibleElement('div[id^="frmThuaDat-"]');
          const inputTo = formThuaDat ? formThuaDat.querySelector('input[name="soHieuToBanDo"]') : null;
          const inputThua = formThuaDat ? formThuaDat.querySelector('input[name="soThuTuThua"]') : null;
          const btnSaveThua = formThuaDat ? formThuaDat.parentElement.querySelector('button[id^="btnSaveThuaDat-"]') || document.querySelector('button[id^="btnSaveThuaDat-"]') : null;
          if (formThuaDat && inputTo && inputThua && btnSaveThua) {
            writeLog(`📝 Form thửa đất đã mở! Đang chờ giao diện ổn định...`);
            state.step = "WAIT_PARCEL_EDITING";
            setTimeout(() => {
              writeLog(`Tiến hành điền Thửa mới [${task.newThua}], Tờ mới [${task.newTo}]...`);
              const fillInput = (el, val) => {
                if (!el) return;
                el.focus();
                el.value = val;
                el.setAttribute("value", val);
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
                el.blur();
                if (jq) jq(el).val(val).trigger("input").trigger("change").trigger("keyup");
              };
              fillInput(inputThua, task.newThua);
              fillInput(inputTo, task.newTo);
              if (task.newThuaIndex > 0) {
                writeLog("🔁 Đang thử lại Thửa mới, bỏ qua kiểm tra Nguồn gốc đất.");
                setTimeout(() => {
                  writeLog("💾 Bấm lưu Thửa Đất (Thử lại)...");
                  if (jq) jq(btnSaveThua).click();
                  else btnSaveThua.click();
                  state.step = "WAIT_PARCEL_SAVE";
                  state.lastSaveTime = Date.now();
                }, 500);
              } else {
                const formMdsdContainer = getVisibleElement('div[id^="frmMucDichSuDung-"]');
                const mdsdForms = formMdsdContainer ? Array.from(formMdsdContainer.querySelectorAll('form[data-duplicate="mucdichsudung"]')) : [];
                writeLog(`Tìm thấy ${mdsdForms.length} loại đất cần kiểm tra Nguồn gốc.`);
                let mdsdDelay = 500;
                mdsdForms.forEach((mdsdForm, idx) => {
                  const preSelectNguonGoc = mdsdForm.querySelector('select[name="loaiNguonGocSuDungDatId"]');
                  if (preSelectNguonGoc && preSelectNguonGoc.value && preSelectNguonGoc.value !== "0") {
                    setTimeout(() => {
                      writeLog(`✅ MĐSD thứ ${idx + 1} đã có sẵn nguồn gốc (mã ${preSelectNguonGoc.value}), khỏi mở form.`);
                    }, mdsdDelay);
                    return;
                  }
                  setTimeout(() => {
                    const stringWrapper = mdsdForm.querySelector(".string-wrapper");
                    if (stringWrapper) {
                      if (jq) jq(stringWrapper).click();
                      else stringWrapper.click();
                    }
                    if (jq) {
                      jq(mdsdForm).addClass("item-selected expanded");
                    } else {
                      mdsdForm.classList.add("item-selected", "expanded");
                    }
                    setTimeout(() => {
                      const selectMdsd = mdsdForm.querySelector('select[name="loaiMucDichSuDungId"]');
                      const selectNguonGoc = mdsdForm.querySelector('select[name="loaiNguonGocSuDungDatId"]');
                      if (!selectMdsd || !selectNguonGoc) {
                        writeLog(`⚠️ MĐSD thứ ${idx + 1}: Không tìm thấy select Nguồn gốc.`);
                        return;
                      }
                      const mdsdText = selectMdsd.options[selectMdsd.selectedIndex]?.text || selectMdsd.value || "";
                      const nguonGocVal = selectNguonGoc.value;
                      if (nguonGocVal && nguonGocVal !== "0") {
                        writeLog(`✅ MĐSD [${mdsdText}] thứ ${idx + 1} đã có nguồn gốc (mã ${nguonGocVal}), bỏ qua.`);
                        return;
                      }
                      const upperMdsd = mdsdText.toUpperCase();
                      const isDatO = upperMdsd.includes("ODT") || upperMdsd.includes("ONT");
                      const targetVal = isDatO ? "2" : "3";
                      const targetName = isDatO ? "Có thu tiền" : "Không thu tiền";
                      writeLog(`👉 MĐSD [${mdsdText}] thứ ${idx + 1} → Chọn Nguồn gốc '${targetName}'`);
                      selectNguonGoc.value = targetVal;
                      selectNguonGoc.dispatchEvent(new Event("change", { bubbles: true }));
                      if (jq) {
                        jq(selectNguonGoc).val(targetVal).trigger("change").trigger("change.select2");
                      }
                    }, 500);
                  }, mdsdDelay);
                  mdsdDelay += 1e3;
                });
                setTimeout(() => {
                  writeLog("💾 Bấm lưu Thửa Đất...");
                  if (jq) jq(btnSaveThua).click();
                  else btnSaveThua.click();
                  state.step = "WAIT_PARCEL_SAVE";
                  state.lastSaveTime = Date.now();
                }, mdsdDelay + 800);
              }
            }, 800);
          } else {
            if (Date.now() - state.lastEditParcelTime > 8e3) {
              writeLog("⚠️ Không mở được form chỉnh sửa thửa đất (timeout 8s). Bỏ đơn ra danh sách.");
              task.resultStatus = "Lỗi mở form thửa";
              state.step = "REMOVE_DOSSIER";
              state.lastRemoveTime = Date.now();
            } else {
              writeLog("⏳ Đang chờ form thửa đất mở...");
            }
          }
          break;
        case "WAIT_PARCEL_EDITING":
          break;
        case "WAIT_PARCEL_SAVE":
          const errorConfirm = document.querySelector(".jconfirm-box");
          if (errorConfirm) {
            const msgEl = errorConfirm.querySelector(".jconfirm-content, .jconfirm-message");
            const msgText = msgEl ? msgEl.textContent.trim().toLowerCase() : "";
            if (msgText.includes("đã tồn tại") || msgText.includes("tồn tại") || msgText.includes("trùng")) {
              writeLog(`⚠️ Phát hiện: "${msgText}" → Thửa [${task.newThua}] bị trùng.`);
              const btnOk = errorConfirm.querySelector(".btn-orange");
              if (btnOk) {
                if (jq) jq(btnOk).click();
                else btnOk.click();
              }
              state.step = "WAIT_DIALOG_CLOSE";
              state.nextStepAfterDialog = "CHECK_NEXT_THUA";
              state.lastDialogCloseTime = Date.now();
            } else {
              const btnOk = errorConfirm.querySelector(".btn-orange");
              if (btnOk) {
                if (jq) jq(btnOk).click();
                else btnOk.click();
              }
              state.step = "WAIT_DIALOG_CLOSE";
              state.nextStepAfterDialog = "SAVE_REGISTRATION";
              state.lastDialogCloseTime = Date.now();
            }
          } else {
            if (Date.now() - state.lastSaveTime > 3e3) {
              state.step = "SAVE_REGISTRATION";
            }
          }
          break;
        case "CHECK_NEXT_THUA":
          task.newThuaIndex++;
          if (task.newThuaIndex < task.newThuaList.length) {
            task.newThua = task.newThuaList[task.newThuaIndex];
            writeLog(`🔁 Thử lại với Số thửa mới: ${task.newThua} (Thửa ${task.newThuaIndex + 1}/${task.newThuaList.length})...`);
            state.step = "EDIT_PARCEL";
          } else {
            writeLog(`⚠️ Đã thử hết ${task.newThuaList.length} số thửa nhưng đều bị TRÙNG. Bỏ đơn ra danh sách.`);
            task.resultStatus = `Trùng thửa (đã thử ${task.newThuaList.length} số)`;
            state.step = "CLOSE_PARCEL_FORM_ERROR";
          }
          break;
        case "CLOSE_PARCEL_FORM_ERROR":
          const btnCloseForm = document.querySelector('button.btn-blue[data-dismiss="modal"]');
          if (btnCloseForm) {
            writeLog("Bấm 'Đóng' form sửa thửa đất...");
            if (jq) jq(btnCloseForm).click();
            else btnCloseForm.click();
          }
          state.step = "REMOVE_DOSSIER";
          state.lastRemoveTime = Date.now();
          break;
        case "SAVE_REGISTRATION":
          const btnSaveDangKy = document.getElementById("btnLuuDangKyThongTinDangKy");
          if (btnSaveDangKy) {
            writeLog("Bước 6: Bấm 'Lưu thông tin đăng ký'...");
            if (jq) jq(btnSaveDangKy).click();
            else btnSaveDangKy.click();
            state.step = "WAIT_REGISTRATION_SAVE";
            state.lastSaveRegTime = Date.now();
          } else {
            if (!state.lastSaveRegSearch) state.lastSaveRegSearch = Date.now();
            if (Date.now() - state.lastSaveRegSearch > 3e3) {
              writeLog("⚠️ Không tìm thấy nút Lưu đăng ký, bỏ qua.");
              state.step = "REMOVE_DOSSIER";
              state.lastRemoveTime = Date.now();
              state.lastSaveRegSearch = 0;
            }
          }
          break;
        case "WAIT_REGISTRATION_SAVE":
          const regConfirm = document.querySelector(".jconfirm-box");
          if (regConfirm) {
            const btnOk = regConfirm.querySelector(".btn-orange") || regConfirm.querySelector(".btn-blue");
            if (btnOk) {
              writeLog("Xác nhận 'Đồng ý' đã lưu thông tin đăng ký...");
              if (jq) jq(btnOk).click();
              else btnOk.click();
            }
            state.step = "WAIT_DIALOG_CLOSE";
            state.nextStepAfterDialog = "REMOVE_DOSSIER";
            state.lastDialogCloseTime = Date.now();
          } else {
            if (Date.now() - state.lastSaveRegTime > 3e3) {
              state.step = "REMOVE_DOSSIER";
              state.lastRemoveTime = Date.now();
            }
          }
          break;
        case "REMOVE_DOSSIER":
          const btnBoDon = document.getElementById("btnBoDonDangKy");
          if (btnBoDon) {
            writeLog("Bước 7: Bấm 'Bỏ đơn khỏi danh sách'...");
            if (jq) jq(btnBoDon).click();
            else btnBoDon.click();
            state.step = "CONFIRM_REMOVE";
            state.lastRemoveTime = Date.now();
          } else {
            if (Date.now() - state.lastRemoveTime > 3e3) {
              writeLog("⚠️ Không tìm thấy nút Bỏ đơn. Tiếp tục sang đơn mới.");
              state.step = "NEXT_TASK";
            }
          }
          break;
        case "CONFIRM_REMOVE":
          const confirmBox = document.querySelector(".jconfirm-box");
          if (confirmBox) {
            const btnAgree = confirmBox.querySelector(".btn-orange");
            if (btnAgree) {
              writeLog("Xác nhận 'Đồng ý' bỏ đơn...");
              if (jq) jq(btnAgree).click();
              else btnAgree.click();
              state.step = "WAIT_DIALOG_CLOSE";
              state.nextStepAfterDialog = "NEXT_TASK";
              state.lastDialogCloseTime = Date.now();
            }
          } else {
            if (Date.now() - state.lastRemoveTime > 4e3) {
              state.step = "NEXT_TASK";
            }
          }
          break;
        case "WAIT_DIALOG_CLOSE":
          if (!document.querySelector(".jconfirm-box")) {
            state.step = state.nextStepAfterDialog;
          } else {
            if (Date.now() - state.lastDialogCloseTime > 3e3) {
              state.step = state.nextStepAfterDialog;
            }
          }
          break;
        case "NEXT_TASK":
          if (!task.resultStatus || task.resultStatus === "Cập nhật thành công") {
            if (task.isGroup) {
              task.resultStatus = "Ứng đại diện";
              state.groupSuccess[task.groupKey] = true;
            } else {
              task.resultStatus = "Cập nhật thành công";
            }
          }
          writeLog(`✅ Dòng thứ ${state.currentIndex + 1}: ${task.resultStatus}`);
          state.currentIndex++;
          updateResultBox();
          state.step = "OPEN_SEARCH";
          break;
      }
    }, 700);
    function updateResultBox() {
      const tbody = document.getElementById("result-table-body");
      if (!tbody) return;
      let done = 0, fail = 0, pending = 0;
      let html = "";
      state.excelData.forEach((d, i) => {
        let status, cssClass, rowClass;
        if (i < state.currentIndex) {
          const raw = d.resultStatus || "Cập nhật thành công";
          const isOk = raw === "Cập nhật thành công" || raw === "Ứng đại diện" || raw === "Đã ứng đại diện" || raw === "Đã cập nhật trước đó";
          if (isOk) {
            status = raw === "Cập nhật thành công" ? "✅ OK" : "✅ " + raw;
            cssClass = "status-ok";
            rowClass = "row-success";
            done++;
          } else {
            status = "❌ " + raw;
            cssClass = "status-err";
            rowClass = "row-fail";
            fail++;
          }
        } else if (i === state.currentIndex && state.isRunning) {
          status = "🔄";
          cssClass = "status-run";
          rowClass = "row-current";
          pending++;
        } else {
          status = "—";
          cssClass = "status-wait";
          rowClass = "";
          pending++;
        }
        html += `<tr class="${rowClass}">
                <td>${i + 1}</td>
                <td title="${escapeHtml(d.sph)}">${escapeHtml(d.sph)}</td>
                <td>${escapeHtml(d.oldThua)}(${escapeHtml(d.oldTo)}) → ${escapeHtml(d.newThua)}(${escapeHtml(d.newTo)})</td>
                <td class="${cssClass}" title="${escapeHtml(d.resultStatus || "")}">${escapeHtml(status)}</td>
            </tr>`;
      });
      tbody.innerHTML = html;
      const elDone = document.getElementById("stat-current");
      const elFail = document.getElementById("result-fail");
      const elPending = document.getElementById("result-pending");
      if (elDone) elDone.textContent = `✅ ${done}`;
      if (elFail) elFail.textContent = `❌ ${fail}`;
      if (elPending) elPending.textContent = `⏳ ${pending}`;
      const wrapper = document.querySelector(".result-table-wrapper");
      const currentRow = tbody.querySelector(".row-current");
      if (wrapper && currentRow) {
        currentRow.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    function init() {
      const btnParse = document.getElementById("btn-update-parse");
      if (btnParse) btnParse.addEventListener("click", parseExcelInput);
      const btnStart = document.getElementById("btn-update-start");
      if (btnStart) btnStart.addEventListener("click", () => {
        const dot = document.getElementById("update-dot");
        if (dot) {
          dot.style.background = "#10b981";
          dot.style.boxShadow = "0 0 8px #10b981";
        }
        startAuto();
      });
      const btnStop = document.getElementById("btn-update-stop");
      if (btnStop) btnStop.addEventListener("click", () => {
        const dot = document.getElementById("update-dot");
        if (dot) {
          dot.style.background = "#ef4444";
          dot.style.boxShadow = "0 0 8px #ef4444";
        }
        stopAuto();
      });
      const btnCopy = document.getElementById("btn-update-copy");
      if (btnCopy) btnCopy.addEventListener("click", () => {
        const lines = state.excelData.map((d) => d.resultStatus || "Chưa xử lý");
        const text = lines.join("\n");
        navigator.clipboard.writeText(text).then(() => {
          writeLog("📋 Đã copy Trạng Thái Gốc vào clipboard!");
        }).catch(() => {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          writeLog("📋 Đã copy (fallback)");
        });
      });
    }
    return { init };
  }();

  // src/excel-module.js
  var ExcelModule = /* @__PURE__ */ function() {
    let state = {
      records: []
    };
    function init() {
      loadState();
      renderTable();
      window.addEventListener("mousedown", (e) => {
        const btnClear = e.target.closest("#btn-excel-clear");
        if (btnClear) {
          e.preventDefault();
          e.stopPropagation();
          if (unsafeWindow.confirm("Xóa toàn bộ hồ sơ đã lưu?")) {
            state.records = [];
            saveState();
            renderTable();
          }
          return;
        }
        const btnCopyAll = e.target.closest("#btn-excel-copy");
        if (btnCopyAll) {
          e.preventDefault();
          e.stopPropagation();
          copyToExcel(true);
          return;
        }
        const btnCopyRow = e.target.closest(".btn-copy-row");
        if (btnCopyRow) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btnCopyRow.getAttribute("data-idx"));
          copyRowToExcel(idx, btnCopyRow, true);
          return;
        }
      }, true);
      setInterval(scanTree, 1e3);
    }
    function loadState() {
      try {
        const stored = localStorage.getItem("mplis_excel_cart");
        if (stored) state.records = JSON.parse(stored);
      } catch (e) {
      }
    }
    function saveState() {
      localStorage.setItem("mplis_excel_cart", JSON.stringify(state.records));
    }
    function renderTable() {
      const tbody = document.querySelector("#table-excel-cart tbody");
      const count = document.getElementById("excel-count");
      if (!tbody || !count) return;
      count.textContent = state.records.length;
      tbody.innerHTML = state.records.map((r, idx) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05); color:#fde047; font-weight:bold;">${escapeHtml(r.maHS || "---")}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.gcn)}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.thua)}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.to)}</td>
                    <td style="padding:4px; border:1px solid rgba(255,255,255,0.05);">${escapeHtml(r.dt)}</td>
                    <td style="padding:2px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
                        <i class="fa fa-copy btn-copy-row" data-idx="${idx}" style="cursor:pointer; color:#0ea5e9; font-size:12px; padding:2px; pointer-events:auto; position:relative; z-index:9999;" title="Copy dòng này"></i>
                    </td>
                </tr>
            `).join("");
    }
    function getRowText(r, isFull = false) {
      if (isFull) {
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
      } else {
        return [
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
    }
    function copyRowToExcel(idx, btn, isFull = false) {
      const r = state.records[idx];
      if (!r) return;
      const text = getRowText(r, isFull);
      fallbackCopyTextToClipboard(text).then(() => {
        btn.className = "fa fa-check btn-copy-row";
        btn.style.color = "#10b981";
        setTimeout(() => {
          btn.className = "fa fa-copy btn-copy-row";
          btn.style.color = "#0ea5e9";
        }, 1500);
      });
    }
    function copyToExcel(isFull = false) {
      if (state.records.length === 0) {
        unsafeWindow.alert("Không có dữ liệu!");
        return;
      }
      let lines = [];
      state.records.forEach((r) => {
        lines.push(getRowText(r, isFull));
      });
      const text = lines.join("\n");
      fallbackCopyTextToClipboard(text).then(() => {
        const btn = document.getElementById("btn-excel-copy");
        const oldText = btn.innerHTML;
        btn.innerHTML = "ĐÃ COPY ✅";
        setTimeout(() => btn.innerHTML = oldText, 2e3);
      });
    }
    function scanTree() {
      const tree = document.getElementById("treeGiayChungNhan");
      if (!tree) return;
      let maHS = "";
      const allNodes = Array.from(document.querySelectorAll("b, span, .modal-title, h4"));
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
      if (validNodes.length > 0) {
        let targetNode = null;
        targetNode = validNodes.find((item) => item.node.closest(".modal-title"));
        if (!targetNode) {
          const notInTable = validNodes.filter((item) => !item.node.closest("tr"));
          if (notInTable.length > 0) {
            targetNode = notInTable[notInTable.length - 1];
          }
        }
        if (!targetNode) {
          targetNode = validNodes[validNodes.length - 1];
        }
        if (targetNode) {
          const full = targetNode.text;
          const parts = full.split("-");
          if (parts.length >= 3) {
            maHS = parts[1].slice(-2) + "-" + parts[2];
          } else {
            maHS = full.slice(-7);
          }
        }
      }
      if (maHS) maHS = maHS.toUpperCase();
      let loaiHS = "", nguoiNop = "", diaChi = "";
      if (maHS) {
        const trs = Array.from(document.querySelectorAll('tr[role="row"]'));
        for (let tr of trs) {
          if (tr.textContent.includes(maHS)) {
            const col1 = tr.querySelector(".col-md-3:nth-child(1)");
            if (col1) {
              const titleDiv = col1.querySelector("div[title]");
              const titleStr = titleDiv ? titleDiv.getAttribute("title").toLowerCase() : col1.textContent.toLowerCase();
              if (titleStr.includes("xóa đăng ký thế chấp") || titleStr.includes("xóa đăng ký biện pháp bảo đảm")) loaiHS = "XTC";
              else if (titleStr.includes("đăng ký thế chấp") || titleStr.includes("đăng ký biện pháp bảo đảm")) loaiHS = "TC";
              else if (titleStr.includes("tách thửa")) loaiHS = "TT";
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
              if (bElements.length > 0) nguoiNop = bElements[0].textContent.trim().toUpperCase();
            }
            break;
          }
        }
      }
      const gcnNodes = Array.from(tree.querySelectorAll("li.jstree-node")).filter((li) => {
        const a = li.querySelector(":scope > a.jstree-anchor");
        return a && (a.textContent.includes("Giấy chứng nhận") || a.textContent.includes("Số phát hành:"));
      });
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
          if (!thua) return;
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
          const exists = state.records.some((r) => r.gcn === gcn && r.thua === thua && r.to === to);
          if (!exists) {
            state.records.push({
              maHS,
              loaiHS,
              nguoiNop,
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
              dtSKC: datSKC
            });
            saveState();
            renderTable();
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
      alertThresholdMinutes: 30,
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
    const TONGHOP_PROCS = [
      "tách thửa hoặc hợp thửa đất - trường hợp không thay đổi người sử dụng đất",
      "tách thửa hoặc hợp thửa đất - trường hợp có thay đổi người sử dụng đất",
      "trường hợp cấp đổi giấy chứng nhận đã cấp theo quy định tại điểm h mục 1 phần vii"
    ];
    function isTongHop(dos) {
      const isLuuTru = /^5\./.test(dos.buocXl) || /^8\./.test(dos.buocXl);
      if (!isLuuTru) return false;
      const rowText = (dos.element.textContent || "").toLowerCase();
      return TONGHOP_PROCS.some((p) => rowText.includes(p));
    }
    function applyFilters() {
      let visibleCount = 0;
      state.allDossiers.forEach((dos) => {
        let isMatch = true;
        if (state.currentTab === "tonghop") {
          isMatch = isTongHop(dos);
        } else {
          if (state.currentTab !== "iso" && dos.isKetIso) isMatch = false;
          if (isMatch && state.currentTab !== "all") {
            if (state.currentTab === "iso") {
              if (!dos.isKetIso) isMatch = false;
            } else {
              const regex = new RegExp("(^|[^0-9])" + state.currentTab + "\\.");
              if (!regex.test(dos.buocXl)) isMatch = false;
            }
          }
        }
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
      const now = /* @__PURE__ */ new Date();
      state.alertThresholdMinutes = parseFloat(document.getElementById("cfg-alert-minutes").value) || 30;
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
        let nguoiNop = "";
        if (col4) {
          const bElements = col4.querySelectorAll("b");
          if (bElements.length > 0) nguoiNop = bElements[0].textContent.trim().toUpperCase();
        }
        if (maHoSoFull) {
          if ((buocXl.includes("4.") || buocXl.includes("5.")) && col1 && !col1.querySelector(".mplis-btn-copy")) {
            const copyBtn = document.createElement("a");
            copyBtn.className = "mplis-btn-copy";
            copyBtn.innerHTML = '<span style="font-size:10px; font-weight:bold;">COPY</span>';
            copyBtn.style.cssText = "margin-left:8px; cursor:pointer; color:#0ea5e9; font-size:14px; transition: color 0.2s;";
            copyBtn.title = "Copy nhanh: Loại HS | Mã HS | Người Nộp | Địa Chỉ";
            copyBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const textToCopy = `${loaiHoSo}	${maHoSoRutGon}	${nguoiNop}	${diaChi}`;
              fallbackCopyTextToClipboard(textToCopy).then(() => {
                copyBtn.innerHTML = '<span style="color:#10b981; font-size:10px; font-weight:bold;">OK</span>';
                setTimeout(() => {
                  copyBtn.innerHTML = '<span style="font-size:10px; font-weight:bold;">COPY</span>';
                }, 2e3);
              });
            };
            if (maHoSoEl) maHoSoEl.parentNode.appendChild(copyBtn);
          }
          const dossier = { maHoSo: maHoSoFull, maHoSoRutGon, loaiHoSo, diaChi, tiepNhanStr, henTraStr, buocXl, nguoiNop, isPaused, isKetIso, element: tr };
          state.allDossiers.push(dossier);
          tr.style.backgroundColor = "";
          tr.style.borderLeft = "";
          if (isPaused) {
            tr.style.backgroundColor = "#f1f5f9";
            tr.style.borderLeft = "4px solid #94a3b8";
          } else if (henTraStr && !isKetIso) {
            const henTra = parseDateVn(henTraStr);
            if (henTra) {
              const diffMs = henTra - now;
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
        document.querySelectorAll(".mplis-filter-tab").forEach((tab) => {
          tab.onclick = (e) => {
            document.querySelectorAll(".mplis-filter-tab").forEach((t) => {
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

  // src/toggle.js
  function toggleProcess(customStopMessage) {
    const state = ProcessModule.getTopState();
    const btn = document.getElementById("btn-toggle-process");
    if (state.isRunning) {
      state.isRunning = false;
      btn.textContent = "Bắt đầu Xử Lý";
      btn.classList.remove("running");
      const isCustom = typeof customStopMessage === "string";
      ProcessModule.getTopState().updateStatus(isCustom ? customStopMessage.includes("LỖI") ? "Lỗi dừng" : "Hoàn thành" : "Đang dừng", "idle");
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
      state.isRunning = true;
      btn.textContent = "Tạm dừng Xử Lý";
      btn.classList.add("running");
      ProcessModule.getTopState().updateStatus("Đang chạy", "active");
    }
  }
  function toggleReturn(customStopMessage) {
    const state = ReturnModule.getTopState();
    const btn = document.getElementById("btn-toggle-return");
    if (state.isRunning) {
      state.isRunning = false;
      btn.textContent = "Bắt đầu Trả Hồ Sơ";
      btn.classList.remove("running");
      const isCustom = typeof customStopMessage === "string";
      ReturnModule.getTopState().updateStatus(isCustom ? "Hoàn thành" : "Đang dừng", "idle");
      ReturnModule.getTopState().writeLog(isCustom ? customStopMessage : "Đã dừng hoạt động.");
      if (isCustom) {
        const logEl = document.getElementById("mplis-step-log-return");
        if (logEl) {
          logEl.style.color = "#10b981";
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
      state.isRunning = true;
      btn.textContent = "Tạm dừng Trả Hồ Sơ";
      btn.classList.add("running");
      ReturnModule.getTopState().updateStatus("Đang chạy", "active");
    }
  }

  // src/inject-panel.js
  function injectPanel() {
    if (document.getElementById("mplis-auto-panel")) return;
    const panel = document.createElement("div");
    panel.id = "mplis-auto-panel";
    panel.classList.add("minimized");
    const pCfg = ProcessModule.getTopState().config;
    const rCfg = ReturnModule.getTopState().config;
    const isQT0 = pCfg.activeWorkflows.includes("QT0") ? "checked" : "";
    const isQT1 = pCfg.activeWorkflows.includes("QT1") ? "checked" : "";
    const isQT2 = pCfg.activeWorkflows.includes("QT2") ? "checked" : "";
    const isQT3 = pCfg.activeWorkflows.includes("QT3") ? "checked" : "";
    const isQT4 = pCfg.activeWorkflows.includes("QT4") ? "checked" : "";
    const isAutoConfirmChecked = isAutoConfirmEnabled() ? "checked" : "";
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
                    <button class="mplis-tab" data-tab="tab-return" title="Trả hồ sơ">📬</button>
                    <button class="mplis-tab" data-tab="tab-update" title="Auto sửa Thửa/Tờ">🔄</button>
                    <button class="mplis-tab" data-tab="tab-settings" title="Cài đặt">🛠️</button>
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
                            <label><input type="checkbox" id="chk-qt5" ${pCfg.isQT5 ? "checked" : ""}> QT5 · Chuyển tiếp hồ sơ</label>
                        </div>

                        <div class="mplis-card" id="fw-user-group" style="display: ${pCfg.isQT5 ? "block" : "none"};">
                            <span class="mplis-section-label">Chuyển tiếp (sau khi Kết ISO)</span>
                            <input type="text" id="cfg-p-forwardUser" value="${pCfg.forwardUser || ""}" placeholder="Tên tài khoản, VD: dla.thoitd" style="background: rgba(0,0,0,0.25); border: 1px solid var(--mplis-border); border-radius: 8px; padding: 8px 10px; color: #f8fafc; width: 100%; font-size: 12px;">
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
                            <div style="display:flex; align-items:center; gap:6px;">Báo trước (phút): <input type="number" id="cfg-alert-minutes" value="30" step="1" style="width:48px; padding:4px; background:rgba(0,0,0,0.25); border:1px solid var(--mplis-border); border-radius:6px; color:#fff; text-align:center;"></div>
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
                        <div style="font-size:11px; color:var(--mplis-text-dim); margin-bottom:10px;">Hồ sơ đã lưu: <b id="excel-count" style="color:#fde047;">0</b> · tự động quét khi mở QT</div>
                        <div style="max-height:150px; overflow-y:auto; margin-bottom:10px; border:1px solid var(--mplis-border); border-radius:10px;">
                            <table id="table-excel-cart" style="width:100%; font-size:10px; color:#f8fafc; border-collapse:collapse; text-align:center;">
                                <thead>
                                    <tr style="background:rgba(255,255,255,0.06);">
                                        <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">MÃ HS</th>
                                        <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">GCN</th>
                                        <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">THỬA</th>
                                        <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">TỜ</th>
                                        <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);">D.TÍCH</th>
                                        <th style="padding:6px 4px; border-bottom:1px solid var(--mplis-border);"><i class="fa fa-bolt"></i></th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button id="btn-excel-copy" class="mplis-btn-primary" style="flex:1; background:linear-gradient(135deg,#8b5cf6,#7c3aed);" title="Copy ĐẦY ĐỦ từ Loại HS">COPY</button>
                            <button id="btn-excel-clear" class="mplis-btn-primary" style="flex:0.35; background:linear-gradient(135deg,#f43f5e,#e11d48);" title="Xóa">XÓA</button>
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
    const chkAutoConfirm = document.getElementById("chk-auto-confirm");
    if (chkAutoConfirm) {
      chkAutoConfirm.onchange = (e) => {
        localStorage.setItem("mplis_auto_confirm_override", e.target.checked ? "true" : "false");
        const settingsTab = document.getElementById("tab-settings");
        let notice = document.getElementById("auto-confirm-notice");
        if (!notice && settingsTab) {
          notice = document.createElement("div");
          notice.id = "auto-confirm-notice";
          notice.style.cssText = "margin-top:8px; font-size:11px; color:#f59e0b; font-weight:600;";
          settingsTab.insertBefore(notice, settingsTab.children[1]);
        }
        if (notice) notice.textContent = "⚠️ Đã lưu. Tải lại trang (F5) để áp dụng thay đổi.";
      };
    }
    if (localStorage.getItem("mplis_auto_minimized") === "true") panel.classList.add("minimized");
    document.getElementById("mplis-btn-minimize").onclick = () => {
      panel.classList.add("minimized");
      localStorage.setItem("mplis_auto_minimized", "true");
    };
    document.getElementById("mplis-btn-maximize").onclick = () => {
      panel.classList.remove("minimized");
      localStorage.setItem("mplis_auto_minimized", "false");
    };
    document.querySelectorAll(".mplis-tab").forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll(".mplis-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".mplis-panel-body").forEach((b) => b.classList.remove("active"));
        tab.classList.add("active");
        const targetId = tab.getAttribute("data-tab");
        document.getElementById(targetId).classList.add("active");
        if (targetId === "tab-process") {
          if (ReturnModule.getTopState()?.isRunning) toggleReturn();
        } else if (targetId === "tab-return") {
          if (ProcessModule.getTopState()?.isRunning) toggleProcess();
        }
      };
    });
    document.getElementById("chk-qt5").onchange = (e) => {
      const checked = e.target.checked;
      document.getElementById("fw-user-group").style.display = checked ? "block" : "none";
      ProcessModule.saveConfig({ isQT5: checked });
    };
    document.getElementById("cfg-p-forwardUser").oninput = (e) => {
      ProcessModule.saveConfig({ forwardUser: e.target.value.trim() });
    };
    document.querySelectorAll('input[name="mplis-workflow"]').forEach((cb) => {
      cb.onchange = () => {
        const checked = Array.from(document.querySelectorAll('input[name="mplis-workflow"]:checked')).map((c) => c.value);
        ProcessModule.saveConfig({ activeWorkflows: checked });
      };
    });
    document.getElementById("btn-toggle-process").onclick = toggleProcess;
    document.getElementById("btn-toggle-return").onclick = toggleReturn;
    AlertModule.init();
    ExcelModule.init();
    UpdateParcelModule.init();
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

  // src/main.js
  if (window === window.top) {
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        injectPanel();
      }
    }, 300);
    topWin.MPLIS_AUTO_TOGGLE_FUNC = toggleProcess;
    topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC = toggleReturn;
  }
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "s" || e.key === "S" || e.key === "đ" || e.key === "Đ")) {
      e.preventDefault();
      const processTab = document.getElementById("tab-process");
      if (processTab && processTab.classList.contains("active")) {
        if (window === window.top) toggleProcess();
        else try {
          if (typeof topWin.MPLIS_AUTO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TOGGLE_FUNC();
        } catch (err) {
        }
      } else {
        if (window === window.top) toggleReturn();
        else try {
          if (typeof topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC === "function") topWin.MPLIS_AUTO_TRAHOSO_TOGGLE_FUNC();
        } catch (err) {
        }
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
