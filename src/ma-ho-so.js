// Mã hồ sơ đầy đủ trên cổng: "H15.50.05.12-260826-1077" hoặc "H15 50 05 12-260826-1077" (nhóm cách nhau bằng
// dấu chấm HOẶC dấu cách; số nhóm không cố định). Bắt đầu bằng chữ+số để không nuốt chữ đứng trước.
export const MA_HS_SRC = '\\b[A-Z]\\d+(?:[. \\u00a0][A-Z0-9]+)+-\\d{6}-\\d{3,}';
// Phần mã dùng đặt tên file (bỏ mã đơn vị "H15.50.05.12-"): "261104-0342".
export const MA_NGAN_SRC = '\\b\\d{6}-\\d{3,}';
export const maHoSoTenFile = (ma) => {
    const m = new RegExp(MA_NGAN_SRC).exec(String(ma || ''));
    return m ? m[0] : String(ma || '').replace(/[.  ]/g, ' ');
};
// Cắt phần đầu trước mã ngắn để so tên cũ ("H15 50 05 12-261104-0342-GT") với tên mới ("261104-0342-GT").
export const boTienTo = (s) => String(s || '').replace(/^.*?(?=\b\d{6}-\d{3,})/, '');
