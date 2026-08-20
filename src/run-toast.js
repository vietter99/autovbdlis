import { ProcessModule } from './process-module.js';

// Bảng nổi báo tiến độ khi panel đang thu nhỏ thành icon tia sét. Thu nhỏ xong thì toàn bộ
// khung nội dung (.mplis-shell) bị ẩn, không còn thấy dòng log lẫn tên bước - trước đây phải
// mở panel ra mới biết tool chạy tới đâu.
//
// Bảng này KHÔNG tự sinh dữ liệu: nó đọc lại chính các phần tử mà writeLog/updateStatus đang
// ghi vào (#mplis-step-log-process, #mplis-status-text-process, #mplis-status-dot-process).
// Các phần tử đó vẫn nằm trong DOM lúc thu nhỏ (chỉ bị CSS ẩn đi) nên đọc được bình thường,
// và cách này không phải sửa vòng quét trong process-module.

const TASK_LABELS = {
    QT0: 'Cập nhật tệp đính kèm',
    QT1: 'Cập nhật dữ liệu pháp lý',
    QT2: 'Lưu kho hồ sơ quét',
    QT3: 'Ký số sổ địa chính',
    QT4: 'Kết ISO',
    QT5: 'Chuyển tiếp hồ sơ'
};

// Giữ dòng kết quả trên màn hình thêm 8 giây sau khi auto dừng, đủ để ngẩng lên đọc.
const HOLD_AFTER_STOP_MS = 8000;

let lastRunning = false;
let stoppedAt = 0;
// Người dùng bấm X tắt bảng. Chỉ tắt cho lần chạy hiện tại - bấm "Bắt đầu Xử Lý" lần sau thì
// bảng hiện lại, khỏi phải nhớ đi bật lại ở đâu.
let hiddenByUser = false;

function buildToast() {
    const el = document.createElement('div');
    el.id = 'mplis-run-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
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
    // Bấm vào bảng nổi thì mở lại panel - đỡ phải nhắm đúng icon tia sét 58px
    el.onclick = () => {
        const btn = document.getElementById('mplis-btn-maximize');
        if (btn) btn.click();
    };
    // stopPropagation để bấm X không kích hoạt luôn onclick mở panel ở dòng trên
    el.querySelector('#mplis-toast-close').onclick = (e) => {
        e.stopPropagation();
        hiddenByUser = true;
        el.classList.remove('show');
    };
    return el;
}

// Danh sách quy trình đang bật, kèm QT5 (lưu ở cờ riêng chứ không nằm trong activeWorkflows)
function getWorkflowQueue(cfg) {
    const queue = (cfg.activeWorkflows || []).slice();
    if (cfg.isQT5 && cfg.forwardUser) queue.push('QT5');
    return queue;
}

function refresh() {
    const toast = document.getElementById('mplis-run-toast');
    const panel = document.getElementById('mplis-auto-panel');
    if (!toast || !panel) return;

    const state = ProcessModule.getTopState();
    if (!state) return;

    if (lastRunning && !state.isRunning) stoppedAt = Date.now();
    // Bắt đầu lượt chạy mới thì bỏ trạng thái đã tắt, cho bảng hiện lại
    if (!lastRunning && state.isRunning) hiddenByUser = false;
    lastRunning = state.isRunning;

    const justStopped = stoppedAt && (Date.now() - stoppedAt < HOLD_AFTER_STOP_MS);
    const shouldShow = !hiddenByUser && panel.classList.contains('minimized') && (state.isRunning || justStopped);
    toast.classList.toggle('show', shouldShow);
    if (!shouldShow) return;

    const queue = getWorkflowQueue(state.config);
    const code = state.currentTaskCode || '';
    const idx = queue.indexOf(code);

    const stepEl = document.getElementById('mplis-toast-step');
    const countEl = document.getElementById('mplis-toast-count');
    const fillEl = document.getElementById('mplis-toast-fill');
    const logEl = document.getElementById('mplis-toast-log');
    const dotEl = document.getElementById('mplis-toast-dot');

    if (state.isRunning) {
        stepEl.textContent = code ? `${code} · ${TASK_LABELS[code] || ''}` : 'Đang tìm hồ sơ...';
        // idx = -1 khi chưa nhận ra bước nào (vừa bấm chạy) - hiện thanh rỗng thay vì đoán bừa
        countEl.textContent = idx >= 0 ? `${idx + 1}/${queue.length}` : `0/${queue.length}`;
        fillEl.style.width = (idx >= 0 && queue.length ? ((idx + 1) / queue.length) * 100 : 0) + '%';
        fillEl.classList.remove('done');
    } else {
        stepEl.textContent = 'Đã dừng';
        countEl.textContent = `${queue.length}/${queue.length}`;
        fillEl.style.width = '100%';
        fillEl.classList.add('done');
    }

    const srcLog = document.getElementById('mplis-step-log-process');
    logEl.textContent = srcLog ? srcLog.textContent : '';

    const srcDot = document.getElementById('mplis-status-dot-process');
    dotEl.className = srcDot ? srcDot.className : 'mplis-status-dot';
}

function initRunToast() {
    if (document.getElementById('mplis-run-toast')) return;
    buildToast();
    setInterval(refresh, 500);
}

export { initRunToast };
