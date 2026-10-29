# Giải thích lựa chọn và giới hạn

## 1. Mô hình đã chọn: RBAC + ReBAC + ABAC, có tenant boundary

| Yêu cầu của bài | Mô hình | Vì sao |
| --- | --- | --- |
| Viewer / Member / Owner có tập quyền khác nhau | **RBAC** theo project | Số loại quyền ít và ổn định. Thêm người hay thêm task không cần sửa policy (slide 12: thêm thành viên = 1 mục, thêm task = 0 mục) |
| Người dùng chỉ thấy task của project mình | **ReBAC** user → project → task | Quyền suy ra từ quan hệ có sẵn trong DB (bảng thành viên, `task.projectId`), không phải ghi thêm dòng quyền cho từng task |
| Member chỉ sửa task được giao, còn Open | **ABAC** | Phụ thuộc thuộc tính thay đổi theo thời gian (assignee, status). Role không biểu diễn được điều kiện riêng của từng task |
| Admin tenant Alpha không chạm tenant Beta | **Tenant boundary** (thuộc tính tenant, kiểm đầu tiên) | Ranh giới cứng, không role nào được vượt |

**Không dùng ACL**: bài không có nhu cầu chia sẻ riêng một task cho một người. ACL cho task sẽ cần `số user × số task` mục và phải ghi lại khi thêm task mới. ACL là hướng mở rộng nếu sau này cần "chia sẻ riêng" (slide 14, tình huống 1).

**Không dùng policy engine (OPA, Casbin, OpenFGA)**: outline giới hạn không xây policy engine tổng quát. Với 4 action và 3 role, một hàm `decide()` thuần, có test đầy đủ, dễ đọc và dễ bảo vệ hơn. Cấu trúc PDP tách riêng giúp thay bằng engine sau này mà không sửa route.

## 2. Vị trí enforcement

- **PEP** nằm ở service (`taskService`, `projectService`). Mọi entry point (`GET /tasks/:id`, `GET /tasks`, `GET /projects/:id/tasks`, PATCH, DELETE, members) đi qua cùng một hàm `enforce` → `decide`.
- **PDP** là `policy.decide`: hàm thuần, không biết HTTP, test được độc lập.
- Kiểm tra trên **bản ghi đang lưu** trước khi áp dụng thay đổi từ body.
- Route không import `db`. Grep kiểm chứng: không có `req.body.role`, `req.headers['x-tenant-id']` hay tương tự trong `src/`.

## 3. Quy ước 401 / 403 / 404

| Mã | Khi nào |
| --- | --- |
| 401 | Không có token, token sai chữ ký, hết hạn, hoặc `sub` không tồn tại |
| 403 `insufficient_scope` | Token không được cấp scope cho loại thao tác này |
| 403 `forbidden` | Người gọi thấy resource (cùng project) nhưng role hoặc điều kiện không cho phép |
| 404 `not_found` | Resource không tồn tại **hoặc** người gọi không được biết nó tồn tại (khác project, khác tenant). Body giống hệt nhau (test E2) |

## 4. Cách kiểm chứng

- 73 automated tests (`npm test`), gồm 17 test oracle `[O1]`–`[O17]`, 12 ô permission matrix, các test bổ sung `[E*]`, test nhất quán `[C*]`, unit test PDP `[U*]` và test cô lập server demo `[S*]`. Coverage: 98.9% dòng toàn bộ `src/`, `policy.js` 100% nhánh.
- Mỗi phiên bản có evidence **đỏ trước khi sửa** (chạy test mới trên code của tag trước) và **xanh sau khi sửa**: `docs/evidence/v*-before.txt`, `v*-after.txt`.
- `docs/evidence/oracle-matrix.md`: số test oracle qua ở từng tag (6 → 7 → 12 → 14 → 15 → 17).
- Các test được phép (O2, O4, O8, O9, O11, O15, M1, M4–M7) chứng minh bản sửa không phải "từ chối hết".
- Test từ chối kiểm thêm dữ liệu **không bị thay đổi**, không chỉ kiểm mã lỗi.

## 5. Trường hợp chưa kiểm tra và giới hạn

| Giới hạn | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| Dữ liệu in-memory, không có DB thật | `readableProjectIds` mô phỏng JOIN, chưa đo hiệu năng | Dùng SQL `JOIN project_members` + index `(user_id, project_id)` |
| Không có cache quyền | Thu hồi có hiệu lực ngay (E5, C3) nhưng mỗi request đọc membership | Nếu cache: TTL ngắn + xóa cache khi đổi quyền (slide 19, 20) |
| Không kiểm concurrency | Đổi quyền đúng lúc PATCH đang chạy chưa được test | Kiểm quyền và ghi trong cùng transaction (Block 7) |
| Chưa có job nền, export CSV | Chưa có entry point ngoài HTTP | Các entry point mới phải gọi qua service, thêm vào test nhất quán |
| Chưa có ACL chia sẻ riêng task | Không chia sẻ một task cho người ngoài project | Thêm bảng `task_shares` như một quan hệ ReBAC |
| Không cho đổi `assignee` qua PATCH | Owner chưa giao lại task được | Thêm action `task:assign` chỉ cho Owner, có test riêng |
| JWT secret mặc định cho dev | Không dùng cho production | Lấy `JWT_SECRET` từ môi trường |
| Không có audit log khi bị từ chối | Khó phát hiện dò ID | Ghi log `reason` của quyết định deny |
