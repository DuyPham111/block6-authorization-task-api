# Giải thích lựa chọn và giới hạn (tóm tắt)

Bản đầy đủ, theo khung "Nhóm chọn / Không chọn / Đánh đổi chấp nhận", nằm ở [../REPORT.md](../REPORT.md). File này giữ bản tóm tắt cho các tài liệu thuyết minh tham chiếu tới.

## 1. Mô hình đã chọn: RBAC + ReBAC + ABAC, có tenant boundary

| Yêu cầu của bài | Mô hình | Vì sao |
| --- | --- | --- |
| Viewer / Member / Owner có tập quyền khác nhau | **RBAC** theo project | Số loại quyền ít và ổn định; thêm người = 1 mục, thêm task = 0 mục (slide 12) |
| Người dùng chỉ thấy task của project mình | **ReBAC** user → project → task | Quyền suy ra từ quan hệ có sẵn trong DB, không phải ghi dòng quyền cho từng task |
| Member chỉ sửa task được giao, còn Open | **ABAC** | Phụ thuộc thuộc tính thay đổi theo thời gian (assignee, status) |
| Admin tenant Alpha không chạm tenant Beta | **Tenant boundary**, kiểm đầu tiên | Ranh giới cứng, không role nào được vượt |

Không dùng ACL (bài không cần chia sẻ riêng từng task) và không dùng policy engine (outline không yêu cầu; một hàm `decide()` thuần, phủ 100% nhánh, dễ bảo vệ hơn). Chi tiết: REPORT §4.4, §4.6.

## 2. Vị trí enforcement

- **PEP** ở service (`taskService`, `projectService`); mọi entry point đi qua `enforce` → `decide`.
- **PDP** là `policy.decide`: hàm thuần, không biết HTTP.
- Kiểm trên **bản ghi đang lưu** trước khi áp dụng body; route không import `db`.
- Mỗi quyết định ghi vào audit log (`src/audit.js`) kèm lý do; client không thấy lý do.

## 3. Quy ước 401 / 403 / 404

| Mã | Khi nào |
| --- | --- |
| 401 | Không có token, sai chữ ký, hết hạn, hoặc `sub` không tồn tại |
| 403 `insufficient_scope` | Token không được cấp scope cho loại thao tác này |
| 403 `forbidden` | Người gọi thấy resource (cùng project) nhưng role hoặc điều kiện không cho phép |
| 404 `not_found` | Không tồn tại **hoặc** người gọi không được biết nó tồn tại (khác project, khác tenant); body giống hệt nhau (E2) |

## 4. Cách kiểm chứng

- 84 automated tests (`npm test`): 17 oracle `[O*]`, 12 ô ma trận `[M*]`, bổ sung `[E*]`, nhất quán `[C*]`, unit PDP `[U*]`, server demo `[S*]`, vận hành `[P*]`, audit `[L*]`, tài liệu `[D*]`. Coverage `src/`: 98,5% dòng, `policy.js` 100% nhánh.
- Mỗi phiên bản có evidence **đỏ trước khi sửa** và **xanh sau khi sửa** (`docs/evidence/v*-before.txt`, `v*-after.txt`); bảng oracle theo tag 6 → 7 → 12 → 14 → 15 → 17.
- Bản "từ chối hết" trượt 51/70 test: các test được phép là bắt buộc.

## 5. Trường hợp chưa kiểm tra và giới hạn

| Giới hạn | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| Dữ liệu in-memory | Một replica; `readableProjectIds` mô phỏng JOIN, chưa đo hiệu năng | PostgreSQL + index `(user_id, project_id)`, Row-Level Security theo tenant |
| Không kiểm concurrency | Đổi quyền đúng lúc PATCH (TOCTOU) với DB thật | `UPDATE … WHERE` có điều kiện hoặc transaction (Block 7) |
| Không cache quyền | Thu hồi tức thì (E5, C3) nhưng mỗi request đọc membership | Cache TTL ngắn + xóa khi đổi quyền |
| Chưa có job nền, export CSV | Chưa có entry point ngoài HTTP | Entry point mới gọi qua service, thêm vào test nhất quán |
| Chưa chia sẻ riêng task | Không cho người ngoài project xem một task | Quan hệ `task_shares` (ACL/ReBAC) |
| PATCH không đổi `assignee` | Owner chưa giao lại task qua API | Action `task:assign` cho Owner |
| Không có rate limit | Dò ID tốc độ cao vẫn gửi được (dù chỉ nhận 404) | Rate limit theo user/IP, cảnh báo từ audit log |
| HTTP, HS256 một khóa | Không dùng cho production như hiện tại | HTTPS ở reverse proxy; ES256 + JWKS khi nhiều service; xoay khóa |
