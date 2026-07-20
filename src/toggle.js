import { ProcessModule } from './process-module.js';
import { ReturnModule } from './return-module.js';

    function toggleProcess(customStopMessage) {
        const state = ProcessModule.getTopState();
        const btn = document.getElementById('btn-toggle-process');
        if (state.isRunning) {
            state.isRunning = false;
            btn.textContent = "Bắt đầu Xử Lý";
            btn.classList.remove('running');

            const isCustom = typeof customStopMessage === 'string';
            ProcessModule.getTopState().updateStatus(isCustom ? (customStopMessage.includes('LỖI') ? "Lỗi dừng" : "Hoàn thành") : "Đang dừng", "idle");
            ProcessModule.getTopState().writeLog(isCustom ? customStopMessage : "Đã dừng hoạt động.");

            if (isCustom) {
                const logEl = document.getElementById('mplis-step-log-process');
                if (logEl) {
                    logEl.style.color = customStopMessage.includes('LỖI') ? '#ef4444' : '#10b981';
                    logEl.style.fontWeight = 'bold';
                }
                setTimeout(() => { if (logEl) { logEl.style.color = ''; logEl.style.fontWeight = ''; } }, 10000);
            }
        } else {
            if (state.config.activeWorkflows.length === 0) return alert("Vui lòng chọn ít nhất 1 quy trình!");
            // Xóa toàn bộ bộ nhớ click cũ để chuẩn bị cho hồ sơ mới
            document.querySelectorAll('*[data-mplis-clicked="true"]').forEach(el => el.removeAttribute('data-mplis-clicked'));

            state.isRunning = true;
            btn.textContent = "Tạm dừng Xử Lý";
            btn.classList.add('running');
            ProcessModule.getTopState().updateStatus("Đang chạy", "active");
        }
    }

    function toggleReturn(customStopMessage) {
        const state = ReturnModule.getTopState();
        const btn = document.getElementById('btn-toggle-return');
        if (state.isRunning) {
            state.isRunning = false;
            btn.textContent = "Bắt đầu Trả Hồ Sơ";
            btn.classList.remove('running');

            const isCustom = typeof customStopMessage === 'string';
            ReturnModule.getTopState().updateStatus(isCustom ? "Hoàn thành" : "Đang dừng", "idle");
            ReturnModule.getTopState().writeLog(isCustom ? customStopMessage : "Đã dừng hoạt động.");

            if (isCustom) {
                const logEl = document.getElementById('mplis-step-log-return');
                if (logEl) { logEl.style.color = '#10b981'; logEl.style.fontWeight = 'bold'; }
                setTimeout(() => { if (logEl) { logEl.style.color = ''; logEl.style.fontWeight = ''; } }, 10000);
            }
        } else {
            state.isRunning = true;
            btn.textContent = "Tạm dừng Trả Hồ Sơ";
            btn.classList.add('running');
            ReturnModule.getTopState().updateStatus("Đang chạy", "active");
        }
    }

export { toggleProcess, toggleReturn };
