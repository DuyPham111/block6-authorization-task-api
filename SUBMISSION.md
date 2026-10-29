# Thông tin gói nộp

- Tên gói: `7-Block6-23127045-23127102-23127159-23127183-23127393.zip`
- Nhóm 07 · 23127045 · 23127102 · 23127159 · 23127183 · 23127393
- Repository: https://github.com/DuyPham111/block6-authorization-task-api
- Mã nguồn: tag `submit` của repository. Lịch sử phiên bản: `starter → v1 → v2 → v3 → v4-pre → v4 → final → submit`.
- Gói ZIP không kèm `node_modules`, `.git`, `.env`, `coverage`. Cài lại dependency bằng `npm ci`. Tái tạo `test-against.sh` và bảng oracle thì clone repository (cần lịch sử git).
- Evidence trong `docs/evidence/` là output của lượt chạy thật ngày 29/10/2026; không sửa tay số liệu khi đóng gói.
- `CHECKSUMS.sha256` liệt kê SHA-256 của mọi file trong gói (kiểm tra: `sha256sum -c CHECKSUMS.sha256`).

## Đọc gói theo thứ tự

1. [README.md](README.md): triển khai và chạy thử.
2. [REPORT.html](REPORT.html): bộ slide báo cáo (mở bằng trình duyệt, offline).
3. [REPORT.md](REPORT.md): giải thích chi tiết từng lựa chọn của nhóm.
4. [AUDIT.md](AUDIT.md): đối chiếu yêu cầu đề với nơi hiện thực và test.
5. [EVIDENCE.md](EVIDENCE.md): số liệu đo được.
