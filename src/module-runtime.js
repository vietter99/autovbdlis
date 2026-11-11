import { topWin } from './utils.js';
import { thanThien } from './log-friendly.js';

// Shared plumbing for the top-level automation modules (ProcessModule):
// per-module state lives on topWin (so every iframe reads/writes the same object),
// with config persisted to localStorage and UI hooks resolved by DOM id suffix.
function createModuleRuntime({ globalStateKey, configStorageKey, defaultConfig, logPrefix, domSuffix }) {
    function loadConfig() {
        const saved = localStorage.getItem(configStorageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.activeWorkflow && !parsed.activeWorkflows) parsed.activeWorkflows = [parsed.activeWorkflow];
                return { ...defaultConfig, ...parsed };
            } catch (e) { }
        }
        return defaultConfig;
    }

    if (window === window.top) {
        if (!topWin[globalStateKey]) {
            topWin[globalStateKey] = {
                isRunning: false, successCount: 0, lastActionTime: 0, currentLockDuration: 1200, config: loadConfig(),
                logBuffer: [],
                writeLog: function (text) {
                    console.log(logPrefix + text);
                    // Bản dễ hiểu cho người dùng; null = thao tác nhỏ, không cần hiện.
                    const nice = thanThien(text);
                    const el = document.getElementById('mplis-step-log-' + domSuffix);
                    if (el && nice !== null) el.textContent = nice;
                    // Tắt "Log chi tiết" thì không lưu/ghi thêm dòng nào (dòng trạng thái ở trên vẫn cập nhật).
                    try { if (localStorage.getItem('mplis_proc_log_enabled') === 'false') return; } catch (e) { }
                    const entry = { t: Date.now(), msg: text, nice };
                    this.logBuffer.push(entry);
                    if (this.logBuffer.length > 300) this.logBuffer.shift();
                    const area = document.getElementById('mplis-log-area-' + domSuffix);
                    if (area) {
                        if (nice !== null) {
                            const line = document.createElement('div');
                            const hh = new Date(entry.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            line.textContent = '[' + hh + '] ' + nice;
                            if (/⚠️|⛔|LỖI|lỗi|dừng|DỪNG/.test(nice)) line.style.color = '#f87171';
                            else if (/✅|🎉|Hoàn thành|Thành công/.test(nice)) line.style.color = '#4ade80';
                            area.appendChild(line);
                            if (area.children.length > 300) area.removeChild(area.firstChild);
                            area.scrollTop = area.scrollHeight;
                        }
                        const badge = document.getElementById('proc-log-count-' + domSuffix);
                        if (badge) badge.textContent = this.logBuffer.filter(x => x.nice !== null).length;
                    }
                },
                updateStatus: function (text, type) {
                    const statusText = document.getElementById('mplis-status-text-' + domSuffix);
                    const statusDot = document.getElementById('mplis-status-dot-' + domSuffix);
                    if (statusText) statusText.textContent = text;
                    if (statusDot) { statusDot.className = 'mplis-status-dot'; if (type === 'active') statusDot.classList.add('active'); if (type === 'waiting') statusDot.classList.add('waiting'); if (type === 'error') statusDot.classList.add('error'); }
                },
                incrementSuccess: function () { this.successCount++; const el = document.getElementById('mplis-counter-val-' + domSuffix); if (el) el.textContent = this.successCount; }
            };
        }
    }

    function getTopState() { return topWin[globalStateKey]; }
    function writeLog(text) { const s = getTopState(); if (s) s.writeLog(text); }
    function updateStatus(text, type) { const s = getTopState(); if (s) s.updateStatus(text, type); }
    function incrementSuccess() { const s = getTopState(); if (s) s.incrementSuccess(); }
    function setLastActionTime(time, lockDuration = 1200) { const s = getTopState(); if (s) { s.lastActionTime = time; s.currentLockDuration = lockDuration; } }
    function saveConfig(cfg) { const s = getTopState(); if (s) { s.config = { ...s.config, ...cfg }; localStorage.setItem(configStorageKey, JSON.stringify(s.config)); } }

    return { getTopState, writeLog, updateStatus, incrementSuccess, setLastActionTime, saveConfig };
}

export { createModuleRuntime };
