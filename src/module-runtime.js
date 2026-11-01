import { topWin } from './utils.js';

// Shared plumbing for the top-level automation modules (ProcessModule, ReturnModule):
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
                    const el = document.getElementById('mplis-step-log-' + domSuffix);
                    if (el) el.textContent = text;
                    const entry = { t: Date.now(), msg: text };
                    this.logBuffer.push(entry);
                    if (this.logBuffer.length > 300) this.logBuffer.shift();
                    const area = document.getElementById('mplis-log-area-' + domSuffix);
                    if (area) {
                        const line = document.createElement('div');
                        const hh = new Date(entry.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        line.textContent = '[' + hh + '] ' + text;
                        if (/⚠️|LỖI|lỗi|dừng|DỪNG/.test(text)) line.style.color = '#f87171';
                        else if (/✅|Hoàn thành|Thành công/.test(text)) line.style.color = '#4ade80';
                        area.appendChild(line);
                        if (area.children.length > 300) area.removeChild(area.firstChild);
                        area.scrollTop = area.scrollHeight;
                        const badge = document.getElementById('proc-log-count-' + domSuffix);
                        if (badge) badge.textContent = this.logBuffer.length;
                    }
                },
                updateStatus: function (text, type) {
                    const statusText = document.getElementById('mplis-status-text-' + domSuffix);
                    const statusDot = document.getElementById('mplis-status-dot-' + domSuffix);
                    if (statusText) statusText.textContent = text;
                    if (statusDot) { statusDot.className = 'mplis-status-dot'; if (type === 'active') statusDot.classList.add('active'); if (type === 'waiting') statusDot.classList.add('waiting'); }
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
