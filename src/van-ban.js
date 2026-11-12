// Chuyển tin soạn cho Telegram (có thẻ HTML) sang chữ thường cho Zalo, và cắt theo giới hạn độ dài.
// Hàm thuần, không đụng trang / mạng để test được.

const THAY_THE = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' };

// <b>x</b> -> x ; <a href="u">x</a> -> "x (u)" ; <br> -> xuống dòng ; &lt; &amp;... -> ký tự thật.
export function htmlSangChu(html) {
    return String(html == null ? '' : html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, url, nhan) => nhan + ' (' + url.replace(/&amp;/g, '&') + ')')
        .replace(/<[^>]+>/g, '')
        .replace(/&(lt|gt|quot|#39|amp);/g, (m) => THAY_THE[m]);
}

// Gom từng dòng vào các khúc không quá toiDa ký tự; dòng dài hơn toiDa thì cắt cứng. Mất dòng nào = bug.
export function chiaTheoDo(text, toiDa) {
    const khuc = [];
    let cur = '';
    const day = (s) => { if (s) khuc.push(s); };
    String(text || '').split('\n').forEach((dong) => {
        while (dong.length > toiDa) { day(cur); cur = ''; day(dong.slice(0, toiDa)); dong = dong.slice(toiDa); }
        if ((cur ? cur.length + 1 : 0) + dong.length > toiDa) { day(cur); cur = dong; }
        else cur += (cur ? '\n' : '') + dong;
    });
    day(cur);
    return khuc;
}
