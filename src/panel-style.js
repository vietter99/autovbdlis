    const panelStyle = `
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
        #mplis-auto-panel { position: fixed !important; bottom: 24px !important; right: 24px !important; width: min(392px, calc(100vw - 32px)) !important; max-height: 82vh !important; background: linear-gradient(160deg, #0e1428 0%, #070b16 60%) !important; border: 1px solid rgba(99,102,241,0.22) !important; border-radius: 18px !important; box-shadow: 0 28px 70px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07) !important; color: var(--mplis-text) !important; font-family: 'Segoe UI', 'Inter', sans-serif !important; z-index: 999999999 !important; user-select: none !important; box-sizing: border-box !important; transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important; display: flex; flex-direction: column; overflow: hidden; transform-origin: bottom right; }
        #mplis-auto-panel * { box-sizing: border-box; }
        #mplis-auto-panel.minimized { width: 58px !important; height: 58px !important; border-radius: 50% !important; background: linear-gradient(135deg, var(--mplis-accent), var(--mplis-accent-2)) !important; border: none !important; box-shadow: 0 10px 28px rgba(99,102,241,0.6), 0 0 0 2px rgba(99,102,241,0.2) !important; cursor: pointer; transform: scale(0.92); }
        #mplis-auto-panel.minimized:hover { transform: scale(1); box-shadow: 0 14px 34px rgba(99,102,241,0.7), 0 0 0 2px rgba(99,102,241,0.3) !important; }
        #mplis-auto-panel.minimized .mplis-panel-header,
        #mplis-auto-panel.minimized .mplis-shell { display: none !important; }

        /* ---- Header ---- */
        #mplis-auto-panel .mplis-panel-header { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 10px 13px !important; border-bottom: 1px solid rgba(99,102,241,0.18) !important; flex-shrink: 0; background: rgba(99,102,241,0.05); }
        #mplis-auto-panel .mplis-panel-title { font-weight: 700 !important; font-size: 13px !important; letter-spacing: -0.02em; color: var(--mplis-text) !important; display: flex !important; align-items: center !important; gap: 9px !important; }
        #mplis-auto-panel .mplis-panel-title .mplis-logo { width: 26px; height: 26px; border-radius: 8px; background: linear-gradient(135deg, var(--mplis-accent), var(--mplis-accent-2)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 12px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2); }
        #mplis-auto-panel .mplis-btn-minimize { background: transparent !important; border: 1px solid transparent !important; border-radius: 8px !important; color: var(--mplis-text-dim) !important; cursor: pointer !important; width: 28px !important; height: 28px !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.15s !important; padding: 0; margin: 0; }
        #mplis-auto-panel .mplis-btn-minimize:hover { color: var(--mplis-text) !important; background: rgba(255,255,255,0.1) !important; border-color: var(--mplis-border) !important; }
        #mplis-auto-panel .mplis-minimized-trigger { display: none !important; width: 100% !important; height: 100% !important; align-items: center !important; justify-content: center !important; color: #fff !important; background: transparent !important; border: none !important; outline: none !important; padding: 0 !important; margin: 0 !important; cursor: pointer !important; }
        #mplis-auto-panel.minimized .mplis-minimized-trigger { display: flex !important; animation: mplis-float 3s ease-in-out infinite; }
        @keyframes mplis-float { 0% { transform: translateY(0); } 50% { transform: translateY(-3px); } 100% { transform: translateY(0); } }

        /* ---- Shell: nav rail (trái) + nội dung (phải) ---- */
        .mplis-shell { display: flex; flex: 1; min-height: 0; }

        .mplis-tabs { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 48px; flex-shrink: 0; padding: 10px 0; background: rgba(0,0,0,0.25); border-right: 1px solid rgba(99,102,241,0.14); overflow-y: auto; overflow-x: visible; }
        .mplis-tab { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 10px; color: var(--mplis-text-dim); cursor: pointer; transition: all 0.18s ease; position: relative; flex-shrink: 0; }
        /* Icon tab dùng SVG (không dùng emoji) - khóa cùng 1 cỡ để nhịp thị giác đều nhau. */
        .mplis-tab svg, .mplis-tab-toggle svg { width: 18px; height: 18px; display: block; }
        .mplis-tab:hover { color: var(--mplis-text); background: rgba(99,102,241,0.12); }
        .mplis-tab.active { color: #fff; background: linear-gradient(135deg, var(--mplis-accent), #4338ca); box-shadow: 0 4px 16px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15); }
        .mplis-tab[title]:hover::after { content: attr(title); position: absolute; left: 100%; top: 50%; transform: translateY(-50%); margin-left: 10px; background: #1a2035; color: #f1f5f9; font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 7px; white-space: nowrap; box-shadow: 0 6px 18px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07); pointer-events: none; z-index: 10; border: 1px solid var(--mplis-border); }

        .mplis-tab-toggle { width: 38px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-top: 1px dashed rgba(148,163,184,0.2); margin-top: 6px; color: var(--mplis-text-dim); cursor: pointer; transition: color 0.15s ease; }
        .mplis-tab-toggle:hover { color: var(--mplis-text); }
        .mplis-tab-toggle.expanded { color: var(--mplis-accent-2); }

        .mplis-content { flex: 1; min-width: 0; min-height: 240px; overflow-y: auto; padding: 10px; transition: min-height 0.22s ease; }
        .mplis-content::-webkit-scrollbar, .mplis-tabs::-webkit-scrollbar { width: 4px; }
        .mplis-content::-webkit-scrollbar-thumb, .mplis-tabs::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }
        .mplis-content::-webkit-scrollbar-thumb:hover, .mplis-tabs::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }

        .mplis-panel-body { display: none; }
        .mplis-panel-body.active { display: block; animation: mplis-fade-in 0.2s ease; }
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
        .mplis-collapse-caret { flex-shrink: 0; color: var(--mplis-text-dim); transition: transform 0.22s cubic-bezier(0.4,0,0.2,1); }
        .mplis-collapse.open .mplis-collapse-caret { transform: rotate(180deg); }
        .mplis-collapse-body { max-height: 0; opacity: 0; overflow: hidden; padding: 0 10px; transition: max-height 0.24s ease, opacity 0.18s ease, padding-bottom 0.24s ease; }
        .mplis-collapse.open .mplis-collapse-body { max-height: 420px; overflow-y: auto; opacity: 1; padding-bottom: 10px; }
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
        #mplis-run-toast .mplis-toast-close { flex-shrink: 0; width: 20px; height: 20px; margin: -3px -3px -3px 2px; display: flex; align-items: center; justify-content: center; padding: 0; background: transparent; border: none; border-radius: 6px; color: var(--mplis-text-dim); cursor: pointer; transition: all 0.15s ease; }
        #mplis-run-toast .mplis-toast-close:hover { background: var(--mplis-surface-hover); color: var(--mplis-text); }
        #mplis-run-toast .mplis-toast-close:focus-visible { outline: 2px solid var(--mplis-accent-2); outline-offset: 1px; }
        #mplis-run-toast .mplis-toast-bar { height: 4px; border-radius: 3px; background: rgba(255,255,255,0.09); overflow: hidden; }
        #mplis-run-toast .mplis-toast-bar i { display: block; height: 100%; width: 0; border-radius: 3px; background: linear-gradient(90deg, var(--mplis-accent), var(--mplis-accent-2)); transition: width 0.3s ease; }
        #mplis-run-toast .mplis-toast-bar i.done { background: var(--mplis-good); }
        #mplis-run-toast .mplis-toast-log { margin-top: 8px; font-size: 11.5px; color: var(--mplis-text-dim); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        @media print { #mplis-run-toast { display: none !important; } }

        .mplis-checkbox-group { display: flex !important; flex-direction: column !important; gap: 4px !important; }
        /* 6 quy trình xếp dọc chiếm gần 200px; xếp 2 cột còn 3 hàng, tab Xử lý ngắn lại hẳn. */
        .mplis-checkbox-group.cols2 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 4px !important; }
        .mplis-checkbox-group label { display: flex !important; align-items: center !important; gap: 7px !important; min-height: 32px !important; font-size: 11.5px !important; color: #dde4f0 !important; cursor: pointer !important; padding: 5px 9px !important; background: rgba(255,255,255,0.04) !important; border-radius: 8px !important; border: 1px solid var(--mplis-border) !important; transition: background 0.15s, border-color 0.15s; }
        .mplis-checkbox-group label:hover { background: rgba(99,102,241,0.1) !important; border-color: rgba(99,102,241,0.3) !important; }
        .mplis-checkbox-group input, #mplis-auto-panel input[type="checkbox"] { accent-color: var(--mplis-accent); width: 14px; height: 14px; cursor: pointer; }

        .mplis-btn-primary { width: 100% !important; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%) !important; border: none !important; border-radius: 10px !important; padding: 9px 14px !important; color: #ffffff !important; font-weight: 700 !important; font-size: 12.5px !important; cursor: pointer !important; letter-spacing: 0.01em; transition: all 0.18s ease !important; box-shadow: 0 4px 15px rgba(99,102,241,0.38), inset 0 1px 0 rgba(255,255,255,0.15); }
        .mplis-btn-primary:hover { filter: brightness(1.12); transform: translateY(-1.5px); box-shadow: 0 7px 22px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2) !important; }
        .mplis-btn-primary:active { transform: translateY(0); filter: brightness(0.97); box-shadow: 0 2px 8px rgba(99,102,241,0.3) !important; }
        .mplis-btn-primary.running { background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%) !important; box-shadow: 0 4px 15px rgba(244,63,94,0.4), inset 0 1px 0 rgba(255,255,255,0.15) !important; }
        .mplis-btn-primary.running:hover { box-shadow: 0 7px 22px rgba(244,63,94,0.55), inset 0 1px 0 rgba(255,255,255,0.2) !important; }
        .mplis-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; filter: none; box-shadow: none !important; }

        /* Chọn hậu tố GT/PT - 2 nút kiểu segmented, nút đang chọn đổi màu + đậm để nhìn là biết. */
        .mplis-hauto-btn { padding: 7px 10px !important; font: 650 12.5px 'Segoe UI', sans-serif !important; color: var(--mplis-text-dim) !important; background: rgba(255,255,255,0.05) !important; border: 1px solid var(--mplis-border) !important; border-radius: 8px !important; cursor: pointer !important; transition: all 0.15s ease !important; }
        .mplis-hauto-btn:hover { background: rgba(99,102,241,0.12) !important; color: var(--mplis-text) !important; border-color: rgba(99,102,241,0.3) !important; }
        .mplis-hauto-btn.on { color: #fff !important; background: linear-gradient(135deg, #6366f1, #4338ca) !important; border-color: transparent !important; box-shadow: 0 3px 12px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15) !important; }

        /* Thanh kéo tốc độ: nền tối cho khớp panel, cao 4px, núm 14px đủ to để kéo. */
        #mplis-auto-panel input[type="range"] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 3px; background: rgba(255,255,255,0.12); outline: none; }
        #mplis-auto-panel input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: var(--mplis-accent-2); border: 2px solid #070b16; cursor: pointer; box-shadow: 0 0 0 2px rgba(34,211,238,0.3), 0 2px 8px rgba(34,211,238,0.4); }
        #mplis-auto-panel input[type="range"]::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; background: var(--mplis-accent-2); border: 2px solid #070b16; cursor: pointer; }

        .mplis-btn-ghost { background: rgba(255,255,255,0.05) !important; border: 1px solid var(--mplis-border) !important; color: var(--mplis-text) !important; border-radius: 9px !important; cursor: pointer !important; transition: all 0.15s ease !important; }
        .mplis-btn-ghost:hover { background: rgba(255,255,255,0.09) !important; border-color: var(--mplis-border-strong) !important; }

        .mplis-status-bar { margin-top: 8px !important; background: linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018)) !important; border-radius: 10px !important; padding: 7px 10px !important; border: 1px solid var(--mplis-border) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04); }
        .mplis-status-row { display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 12px !important; }
        .mplis-status-lbl { display: flex !important; align-items: center !important; gap: 7px !important; color: #c8d3e8 !important; }
        .mplis-status-dot { width: 8px !important; height: 8px !important; border-radius: 50% !important; background-color: #4a5568 !important; flex-shrink: 0; }
        .mplis-status-dot.active { background-color: var(--mplis-good) !important; box-shadow: 0 0 0 2px rgba(34,197,94,0.2), 0 0 10px rgba(34,197,94,0.6) !important; animation: mplis-pulse 1.5s infinite !important; }
        .mplis-status-dot.waiting { background-color: var(--mplis-warn) !important; box-shadow: 0 0 0 2px rgba(245,158,11,0.2), 0 0 10px rgba(245,158,11,0.6) !important; }
        @keyframes mplis-pulse { 0% { opacity: 0.55; } 50% { opacity: 1; } 100% { opacity: 0.55; } }

        .mplis-log { margin-top: 8px !important; font-family: 'Consolas', 'Cascadia Code', monospace !important; font-size: 11.5px !important; color: var(--mplis-text-dim) !important; border-top: 1px solid rgba(148,163,184,0.1) !important; padding-top: 7px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }

        .mplis-highlight-target { outline: 2px solid var(--mplis-good) !important; box-shadow: 0 0 0 4px rgba(34,197,94,0.15), 0 0 18px rgba(34,197,94,0.6) !important; border-radius: 4px !important; }
        .tab-return-color .mplis-highlight-target { outline-color: var(--mplis-warn) !important; box-shadow: 0 0 0 4px rgba(245,158,11,0.15), 0 0 18px rgba(245,158,11,0.6) !important; }
        .tab-return-color .mplis-btn-primary { background: linear-gradient(135deg, #f59e0b, #b45309) !important; color: #0a0c10 !important; box-shadow: 0 4px 15px rgba(245,158,11,0.38), inset 0 1px 0 rgba(255,255,255,0.2) !important; }
        .tab-return-color .mplis-btn-primary.running { background: linear-gradient(135deg, var(--mplis-bad), #be123c) !important; color: #fff !important; }

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

        @media print { #mplis-auto-panel { display: none !important; } }
    `;

    if (typeof GM_addStyle !== 'undefined') GM_addStyle(panelStyle);
    else { const s = document.createElement('style'); s.innerHTML = panelStyle; document.head.appendChild(s); }

export { panelStyle };
