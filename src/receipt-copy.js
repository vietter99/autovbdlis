import { fallbackCopyTextToClipboard } from './utils.js';

    // Tự động quét và thêm nút copy cho "Số biên nhận"
    setInterval(() => {
        const listItems = document.querySelectorAll('li.info');
        listItems.forEach(li => {
            const nameSpan = li.querySelector('span.name');
            if (nameSpan && nameSpan.textContent.includes('Số biên nhận')) {
                const valueSpan = li.querySelector('span.value');
                if (valueSpan && !li.querySelector('.btn-copy-receipt')) {
                    const copyBtn = document.createElement('i');
                    copyBtn.className = 'fa fa-copy btn-copy-receipt';
                    copyBtn.style.cssText = 'cursor:pointer; color:#10b981; margin-left:8px; font-size:14px; pointer-events: auto; position: relative; z-index: 9999;';
                    copyBtn.title = 'Copy số biên nhận';

                    // Dùng mousedown thay vì click để bẻ khóa mọi sự kiện chặn click của VBDLIS
                    copyBtn.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            const text = valueSpan.textContent.trim(); // Lấy chữ
                            fallbackCopyTextToClipboard(text).then(() => {
                                copyBtn.className = 'fa fa-check btn-copy-receipt';
                                copyBtn.style.color = '#0ea5e9';
                                setTimeout(() => {
                                    copyBtn.className = 'fa fa-copy btn-copy-receipt';
                                    copyBtn.style.color = '#10b981';
                                }, 1500);
                            }).catch(err => {
                                unsafeWindow.alert("LỖI COPY: " + err.message + "\n\nNội dung cần copy là: " + text);
                            });
                        } catch (err) {
                            unsafeWindow.alert("Lỗi khi lấy text: " + err.message);
                        }
                    }, true); // useCapture = true để bắt sự kiện ưu tiên
                    valueSpan.appendChild(copyBtn);
                }
            }
        });
    }, 1500);
