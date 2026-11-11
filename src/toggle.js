import { ProcessModule } from './process-module.js';
import { findCurrentMaHS } from './utils.js';

    function toggleProcess(customStopMessage) {
        const state = ProcessModule.getTopState();
        const btn = document.getElementById('btn-toggle-process');
        if (!state.isRunning && typeof customStopMessage === 'string') return;
        if (state.isRunning) {
            state.isRunning = false;
            btn.textContent = "Bắt đầu Xử Lý";
            btn.classList.remove('running');

            const isCustom = typeof customStopMessage === 'string';
            // Có "LỖI" hoặc ⚠️ trong thông điệp = dừng vì sự cố, không phải hoàn thành.
            const laLoi = isCustom && /LỖI|⚠️/.test(customStopMessage);
            state.lastStopKind = laLoi ? 'error' : (isCustom ? 'done' : 'user');
            ProcessModule.getTopState().updateStatus(laLoi ? "Lỗi - đã dừng" : (isCustom ? "Hoàn thành" : "Đang dừng"), laLoi ? "error" : "idle");
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

            state.lastStopKind = null;
            state._qt5Done = false; state.tacVuDaXuLy = null; // danh sách tác vụ đã xử lý sẽ do server báo lại cho lượt này
            state.qt1ConfirmStreak = 0; // lượt mới thì xoá đếm lặp của lượt trước
            state.isRunning = true;
            btn.textContent = "Tạm dừng Xử Lý";
            btn.classList.add('running');
            ProcessModule.getTopState().updateStatus("Đang chạy", "active");
            let maHS = '';
            try { maHS = findCurrentMaHS() || ''; } catch (e) { }
            ProcessModule.getTopState().writeLog('▶ Bắt đầu xử lý hồ sơ' + (maHS ? ' ' + maHS : ''));
        }
    }

export { toggleProcess };
