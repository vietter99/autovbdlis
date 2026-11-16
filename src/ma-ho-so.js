// Mã hồ sơ đầy đủ: "H15.50.05.12-260826-1077" hoặc "H15 50 05 12-260826-1077" (nhóm cách nhau bằng
// dấu chấm HOẶC dấu cách; số nhóm không cố định). Bắt đầu bằng chữ+số để không nuốt chữ đứng trước.
export const MA_HS_SRC = '\\b[A-Z]\\d+(?:[. \\u00a0][A-Z0-9]+)+-\\d{6}-\\d{3,}';
// Tên file dùng dấu cách thay dấu chấm (dấu chấm trong tên file làm cổng báo lỗi).
export const maHoSoTenFile = (ma) => String(ma || '').replace(/[.  ]/g, ' ');
