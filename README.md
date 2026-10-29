# Task Management API: Authorization và Access Control (Block 6)

API quản lý task có sẵn xác thực JWT. Bài làm bổ sung **kiểm quyền trên từng resource tại server**, chứng minh bằng automated tests.

## Chạy

```bash
npm install
npm test                         # 70 test, gồm 17 test oracle của bài
npx jest --coverage              # policy.js phủ 100% nhánh
npm start                        # http://localhost:3000
node scripts/token.js alice      # in token để gọi bằng curl
```

Demo nhanh lỗi IDOR (chạy server tạm, Alice đọc A1 và B1):

```bash
bash scripts/demo-idor.sh
```

Gọi tay:

```bash
TOKEN=$(node scripts/token.js alice)
curl -i localhost:3000/tasks/A1 -H "Authorization: Bearer $TOKEN"   # 200
curl -i localhost:3000/tasks/B1 -H "Authorization: Bearer $TOKEN"   # 404
```

## Dữ liệu mẫu

| User | Tenant | Quan hệ |
| --- | --- | --- |
| alice | alpha | Owner project Alpha |
| bob | alpha | Member project Alpha, assignee của A1 |
| vera | alpha | Viewer project Alpha |
| erin | alpha | Chưa thuộc project nào |
| dana | alpha | Admin của tenant Alpha |
| charlie | beta | Owner project Beta |

Task: A1 (Alpha, giao cho bob, Open), A2 (Alpha, chưa giao), B1 (Beta, giao cho charlie), B2 (Beta, chưa giao).

## API

| Endpoint | Scope | Action trong policy |
| --- | --- | --- |
| `GET /tasks` | `tasks:read` | lọc theo `readableProjectIds` |
| `GET /tasks/:id` | `tasks:read` | `task:read` |
| `PATCH /tasks/:id` | `tasks:write` | `task:edit` |
| `GET /projects/:id/tasks` | `tasks:read` | `task:read` |
| `DELETE /projects/:id` | `projects:manage` | `project:delete` |
| `POST /projects/:id/members` | `projects:manage` | `member:manage` |
| `DELETE /projects/:id/members/:userId` | `projects:manage` | `member:manage` |

## Kiến trúc kiểm quyền

```
request ─▶ authenticate (JWT: sub, scope) ─▶ requireScope ─▶ route ─▶ service (PEP) ─▶ policy.decide (PDP)
             401 nếu thiếu/sai/hết hạn          403 insufficient_scope        403 / 404 theo quyết định
```

- `src/policy.js`: **PDP**. `decide(user, action, { project, task })` theo thứ tự: tenant boundary → Admin của tenant → thành viên project (ReBAC) → permission của role (RBAC) → assignee + status (ABAC). Không khớp nhánh nào thì deny.
- `src/services/*.js`: **PEP**. Nạp resource từ DB, gọi `enforce`, rồi mới thao tác. Route không truy cập DB trực tiếp.
- Người gọi không được thấy resource (ngoài project hoặc ngoài tenant) → **404**. Thấy nhưng không được làm → **403**.

## Phiên bản (git tag)

| Tag | Nội dung |
| --- | --- |
| `starter` | Chỉ kiểm token và scope: lỗi IDOR/BOLA và BFLA có chủ đích |
| `v1` | Object-level authorization cho đọc task (thành viên project) |
| `v2` | RBAC theo project: Viewer / Member / Owner |
| `v3` | ABAC: Member chỉ sửa task được giao, còn Open |
| `v4-pre` | Thêm tenant + Admin nhưng chưa có boundary (tái hiện lỗi) |
| `v4` | Tenant boundary đứng trước mọi role |
| `final` | `GET /tasks` lọc trong truy vấn + test nhất quán check/list |

```bash
git diff starter v1 -- src       # nơi áp dụng authorization ở V1
bash scripts/test-against.sh starter test/v1.idor.test.js   # chạy test mới trên code cũ: thấy đỏ
node scripts/oracle-matrix.js    # bảng oracle theo từng tag
```

## Tài liệu

- [docs/policy-matrix.md](docs/policy-matrix.md): bảng chính sách quyền
- [docs/explanation.md](docs/explanation.md): lựa chọn mô hình, giới hạn, trường hợp chưa kiểm tra
- [docs/evidence/](docs/evidence/): output test trước/sau từng phiên bản, curl IDOR, bảng oracle, code diff
- [docs/thuyet-minh/](docs/thuyet-minh/): thuyết minh thiết kế và câu hỏi vấn đáp từng phần
- [docs/ke-hoach.md](docs/ke-hoach.md): kế hoạch làm bài ban đầu và các điểm đã thay đổi
