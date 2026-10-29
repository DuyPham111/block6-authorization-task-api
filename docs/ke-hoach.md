# Kế hoạch làm bài Block 6: Task Management API (Authorization)

> **Trạng thái: đã hoàn thành** trong repo này ([README](../README.md), git tag `starter → v1 → v2 → v3 → v4-pre → v4 → final`, 70/70 test, 17/17 oracle).
> Khác với kế hoạch ban đầu: token chứa `sub` + `scope` (vẫn không có role/tenant) để minh họa lớp OAuth2 scope; thêm user `erin` (cùng tenant, chưa thuộc project) để test thêm thành viên; thêm tag `v4-pre` (Admin toàn cục, cố ý sai) để có evidence đỏ cho V4; thêm `GET /tasks` + test nhất quán check/list và unit test PDP.
> Thuyết minh + câu hỏi vấn đáp: [docs/thuyet-minh/](thuyet-minh/README.md).

> Dựa trên outline Block 6 và slide bài giảng của môn (tài liệu môn học, không đưa vào repo).
> Ưu tiên: V1 → V2 → V3 (bắt buộc), V4 (mở rộng).

## 0. Quyết định kỹ thuật

| Hạng mục | Lựa chọn | Lý do |
| --- | --- | --- |
| Starter | Dùng starter của GV nếu có; nếu không, tự dựng starter tối giản (Phase 0) | Bài yêu cầu starter chỉ kiểm token, có lỗi IDOR sẵn |
| Stack | Node.js 20 + Express | Slide dùng Express trong ví dụ mã |
| Test | Jest + Supertest | Gọi HTTP thật vào app, chạy bằng một lệnh `npm test` |
| Dữ liệu | In-memory seed, có hàm `resetDb()` gọi trong `beforeEach` | Đủ cho lab; test độc lập nhau |
| Auth | JWT HS256, payload **chỉ có `sub`** | Role/tenant lấy từ DB mỗi request, tránh lỗi "role trong JWT 15 phút" khi thu hồi quyền (slide 20) |
| Mã từ chối | Không nhìn thấy resource → **404**; nhìn thấy nhưng không được làm → **403** | Che sự tồn tại với người ngoài project; người trong project nhận lý do rõ. Oracle chấp nhận 403 hoặc 404 |
| Nơi kiểm quyền | Business layer (`TaskService`, `ProjectService`) gọi một PDP chung (`policy.js`) | Mọi entry point đi qua cùng một điểm kiểm (slide 17, 18) |

Nếu dùng starter của GV với stack khác, giữ nguyên các quyết định trên, chỉ đổi tên file/thư viện.

## 1. Cấu trúc dự án

```
task-api/
  package.json            # scripts: start, test
  src/
    app.js                # tạo express app, gắn routes
    server.js             # app.listen (tách để Supertest dùng app.js)
    auth.js               # middleware: verify JWT -> req.user = db.users[sub]; lỗi -> 401
    db.js                 # seed + resetDb() + helper truy vấn (membership, task, project)
    policy.js             # PDP: decide(user, action, resource) -> { allow, visible, reason }
    services/
      taskService.js      # PEP: getTask, updateTask, listProjectTasks
      projectService.js   # PEP: deleteProject, addMember, removeMember
    routes/
      tasks.js
      projects.js
  test/
    helpers.js            # tokenFor(userId), expiredTokenFor(userId), api()
    v1.idor.test.js
    v2.rbac.test.js
    v3.rebac-abac.test.js
    v4.tenant.test.js
  docs/
    policy-matrix.md      # bảng chính sách quyền
    explanation.md        # lựa chọn mô hình, giới hạn, trả lời câu hỏi kết thúc
    evidence/             # output test trước/sau, curl IDOR
```

## 2. Dữ liệu mẫu (seed)

**Users**

| id | tenant | Ghi chú |
| --- | --- | --- |
| alice | alpha | Owner project Alpha |
| bob | alpha | Member project Alpha |
| vera | alpha | Viewer project Alpha (cần cho test "Viewer sửa A1") |
| charlie | beta | Owner project Beta |
| dana | alpha | `tenantRole = Admin` của tenant Alpha (V4) |

**Projects**: `alpha` (tenant alpha), `beta` (tenant beta).

**project_members**: (alice, alpha, Owner), (bob, alpha, Member), (vera, alpha, Viewer), (charlie, beta, Owner).

**Tasks**

| id | project | assignee | status |
| --- | --- | --- | --- |
| A1 | alpha | bob | Open |
| A2 | alpha | null (chưa giao) | Open |
| B1 | beta | charlie | Open |
| B2 | beta | null | Open |

Test "A1 Closed" tự đổi status trong phần setup của test đó, không đổi seed.

## 3. API

| Endpoint | Action trong policy | Ghi chú |
| --- | --- | --- |
| `GET /tasks/:id` | `task:read` | Có sẵn trong starter (lỗi IDOR) |
| `PATCH /tasks/:id` | `task:edit` | Body: title, description, status |
| `DELETE /projects/:id` | `project:delete` | |
| `POST /projects/:id/members` | `member:manage` | Body: `{ userId, role }` (role của **người được thêm**, không phải người gọi) |
| `DELETE /projects/:id/members/:userId` | `member:manage` | |
| `GET /projects/:id/tasks` | `task:read` | Entry point thứ hai cho cùng dữ liệu, chứng minh kiểm quyền nhất quán |

## 4. Thiết kế policy (PDP)

```js
// policy.js
const ROLE_PERMS = {
  Viewer: ['task:read'],
  Member: ['task:read', 'task:edit'],
  Owner:  ['task:read', 'task:edit', 'project:delete', 'member:manage'],
}
```

Thứ tự kiểm trong `decide(user, action, resource)`; mọi nhánh không khớp đều **deny**:

1. **Tenant boundary (V4)**: `user.tenantId !== project.tenantId` → deny, `visible: false` (404).
2. **Tenant Admin (V4)**: `user.tenantRole === 'Admin'` → allow mọi action trong tenant của mình.
3. **ReBAC**: tìm membership của `user` trong project chứa resource. Không có → deny, `visible: false` (404).
4. **RBAC**: `ROLE_PERMS[membership.role]` không chứa action → deny, `visible: true` (403).
5. **ABAC (V3)**: action `task:edit` và role là `Member` → yêu cầu `task.assignee === user.id` và `task.status === 'Open'`; sai → 403.
6. Allow.

Nguyên tắc:

- `user` lấy từ `req.user` do middleware nạp từ DB theo `sub`. **Không** đọc `userId`, `role`, `tenantId` từ body, query hay header.
- `assignee`, `status`, `projectId` đọc từ bản ghi trong DB **trước khi** áp dụng thay đổi của PATCH.
- Service nạp resource → gọi `decide` → không cho phép thì ném lỗi `NotFound`/`Forbidden` → route map sang 404/403.
- `GET /projects/:id/tasks` lọc theo membership ngay khi truy vấn (tương đương JOIN `project_members`), không gọi `decide` cho từng task (slide 18).

## 5. Các giai đoạn thực hiện

Mỗi giai đoạn theo vòng: **viết test → chạy thấy đỏ → lưu evidence → sửa → chạy thấy xanh → commit**.

### Phase 0. Dựng starter (~25 phút)

- [ ] `npm init`, cài `express jsonwebtoken`, dev: `jest supertest`.
- [ ] Viết `db.js` (seed, `resetDb`), `auth.js` (401 khi thiếu/sai/hết hạn token).
- [ ] Viết routes ở trạng thái **lỗi có chủ đích**: chỉ kiểm token, không kiểm quyền (giống starter của bài).
- [ ] `test/helpers.js`: `tokenFor`, `expiredTokenFor`.
- [ ] `git init` và commit, tag `starter`.

### Phase 1. V1: sửa IDOR/BOLA (~25 phút)

- [ ] Chạy server, dùng token Alice gọi `GET /tasks/B1`, lưu request và response 200 vào `docs/evidence/v1-idor-curl.txt`.
- [ ] Viết `v1.idor.test.js` (test 1–4 ở mục 6), chạy trên starter, lưu output đỏ vào `docs/evidence/v1-before.txt`.
- [ ] Tạo `policy.js` (bước 3 của mục 4) và `taskService.getTask`; route gọi service.
- [ ] Áp dụng cùng kiểm tra cho `GET /projects/:id/tasks`.
- [ ] Chạy lại test, lưu output xanh vào `docs/evidence/v1-after.txt`. Commit, tag `v1`.

### Phase 2. V2: RBAC theo project (~30 phút)

- [ ] Viết `docs/policy-matrix.md` (mục 7).
- [ ] Viết `v2.rbac.test.js` bằng `test.each` cho **đủ 12 ô** ma trận (3 role × 4 action), cộng test `role=Admin` trong body.
- [ ] Chạy thấy đỏ, lưu `docs/evidence/v2-before.txt`.
- [ ] Thêm `ROLE_PERMS` (bước 4), `projectService` cho delete và quản lý thành viên, route PATCH.
- [ ] Xanh, lưu `v2-after.txt`. Commit, tag `v2`.

### Phase 3. V3: ReBAC + ABAC (~30 phút)

- [ ] Viết `v3.rebac-abac.test.js` (test 11–14, cộng test bổ sung E3).
- [ ] Đỏ, lưu `v3-before.txt`.
- [ ] Thêm bước 5 vào policy. PATCH đọc task từ DB, kiểm quyền **trước** khi merge body; chặn client tự đổi `assignee`.
- [ ] Xanh, lưu `v3-after.txt`. Commit, tag `v3`.

### Phase 4. V4: tenant boundary (~20 phút, mở rộng)

- [ ] Thêm `tenantId` cho users/projects, `tenantRole` cho dana.
- [ ] Viết `v4.tenant.test.js` (test 15–17, gửi `X-Tenant-Id: beta` và `tenantId` trong body).
- [ ] Đỏ, lưu `v4-before.txt`. Thêm bước 1–2 vào policy. Xanh, lưu `v4-after.txt`. Commit, tag `v4`.

### Phase 5. Rà soát và viết tài liệu (~25 phút)

- [ ] Grep để chắc chắn không route nào đọc `req.body.role`, `req.body.userId`, `req.headers['x-tenant-id']` khi kiểm quyền.
- [ ] Chắc chắn mọi route đều đi qua service, không truy cập `db` trực tiếp.
- [ ] Chạy toàn bộ `npm test`, lưu `docs/evidence/final.txt`.
- [ ] Viết `docs/explanation.md` (mục 8).
- [ ] Tạo code diff: `git diff starter v3` (và `v3 v4`), lưu vào `docs/evidence/`.

**Tổng cộng khoảng 2,5 giờ.** Nếu thiếu thời gian, dừng sau Phase 3 và ghi V4 vào phần "chưa làm".

## 6. Test oracle (17 test bắt buộc + bổ sung)

| # | Ver | Tình huống | Kỳ vọng |
| --- | --- | --- | --- |
| 1 | V1 | Anonymous `GET /tasks/A1` | 401 |
| 2 | V1 | Alice `GET /tasks/A1` | 200 |
| 3 | V1 | Alice `GET /tasks/B1` | 404 (không lộ nội dung) |
| 4 | V1 | Charlie `GET /tasks/B1` | 200 |
| 5 | V2 | Vera (Viewer) `PATCH /tasks/A1` | 403 |
| 6 | V2 | Bob (Member) `DELETE /projects/alpha` | 403 |
| 7 | V2 | Bob (Member) `POST /projects/alpha/members` | 403 |
| 8 | V2 | Alice (Owner) `DELETE /projects/alpha` | 2xx |
| 9 | V2 | Alice (Owner) `POST /projects/alpha/members` | 2xx |
| 10 | V2 | Bob `DELETE /projects/alpha` với body `{ "role": "Admin" }` | 403 |
| 11 | V3 | Bob `PATCH /tasks/A1` (giao cho Bob, Open) | 200 |
| 12 | V3 | Bob `PATCH /tasks/A2` (chưa giao) | 403 |
| 13 | V3 | Bob `PATCH /tasks/A1` khi A1 Closed | 403 |
| 14 | V3 | Bob `PATCH /tasks/B1` (project khác) | 404 |
| 15 | V4 | Dana (Admin tenant Alpha) `GET /tasks/A1` | 200 |
| 16 | V4 | Dana `GET /tasks/B1` | 404 |
| 17 | V4 | Dana `GET /tasks/B1` với header `X-Tenant-Id: beta` | 404 |

Test bổ sung nên có:

| # | Tình huống | Kỳ vọng |
| --- | --- | --- |
| E1 | Token Alice hết hạn `GET /tasks/A1` | 401 |
| E2 | Alice `GET /tasks/Z9` (không tồn tại) | 404, cùng dạng body với test 3 |
| E3 | Bob `PATCH /tasks/A2` với body `{ "assignee": "bob" }` | 403, A2 vẫn chưa giao |
| E4 | Alice `GET /projects/beta/tasks` | 404 (entry point thứ hai cũng được bảo vệ) |
| E5 | Owner gỡ Bob khỏi Alpha, ngay sau đó Bob `GET /tasks/A1` | 404 (thu hồi có hiệu lực ngay, không cache) |
| E6 | Bob `GET /tasks/B1` với body `{ "userId": "charlie" }` | 404 |

**Kiểm tra chống "deny-all"**: test 2, 4, 8, 9, 11, 15 là các test được phép. Bản sửa chỉ đúng khi các test này vẫn xanh.

## 7. Bảng chính sách quyền (nội dung cho `docs/policy-matrix.md`)

| Role (trong project) | Đọc task | Sửa task | Xóa project | Quản lý thành viên |
| --- | --- | --- | --- | --- |
| Viewer | ✅ | ❌ | ❌ | ❌ |
| Member | ✅ | ✅ nếu `assignee = mình` **và** `status = Open` | ❌ | ❌ |
| Owner | ✅ | ✅ mọi task trong project | ✅ | ✅ |
| Tenant Admin | ✅ mọi project **cùng tenant** | ✅ cùng tenant | ✅ cùng tenant | ✅ cùng tenant |
| Không phải thành viên / khác tenant | ❌ (404) | ❌ (404) | ❌ (404) | ❌ (404) |

Điều kiện chung: role và tenant lấy từ DB; `assignee` và `status` lấy từ bản ghi task đang lưu.

## 8. Nội dung `docs/explanation.md`

1. **Mô hình đã chọn**: kết hợp RBAC (role theo project), ReBAC (membership user → project → task), ABAC (assignee, status) và tenant boundary. Không dùng ACL vì bài không có chia sẻ riêng từng task; ghi rõ ACL là hướng mở rộng nếu cần.
2. **Vị trí enforcement**: PEP ở service, PDP là `policy.js`; liệt kê các entry point đã đi qua (`GET /tasks/:id`, `GET /projects/:id/tasks`, PATCH, DELETE, members).
3. **Quy ước 403/404** và lý do.
4. **Trường hợp chưa kiểm tra / giới hạn**: không có cache quyền; chưa có job nền hay export CSV; không có chia sẻ ACL theo task; chưa kiểm tra concurrency (đổi quyền giữa lúc đang PATCH); dữ liệu in-memory.
5. **Trả lời 4 câu hỏi kết thúc** (gợi ý ở slide 28):
   - Scope `tasks:read` không đủ để đọc B1: scope chỉ giới hạn token, không chứng minh quan hệ với B1.
   - Role Member còn cần kiểm project của task, assignee, status, tenant.
   - Ẩn nút Delete chỉ là giao diện; curl/script gọi thẳng server nên server phải tự kiểm.
   - Hàng triệu tài liệu: một PDP dùng chung, lưu quan hệ chia sẻ như dữ liệu (ReBAC, kiểu OpenFGA), tách check và list, cache có TTL và quy trình thu hồi, một bộ test chung.

## 9. Checklist nộp bài (đối chiếu outline)

- [ ] Bảng chính sách quyền: `docs/policy-matrix.md`; mỗi ô có ít nhất một test.
- [ ] Automated tests cho cả được phép và bị từ chối, chạy bằng `npm test`.
- [ ] Evidence IDOR trước khi sửa (`v1-idor-curl.txt`, `v1-before.txt`) và sau khi sửa (`v1-after.txt`).
- [ ] Code diff thể hiện nơi áp dụng authorization (`git diff starter v3`).
- [ ] Giải thích lựa chọn mô hình và các trường hợp chưa kiểm tra: `docs/explanation.md`.

## 10. Lỗi thường gặp cần tránh

- Trả 403/404 cho tất cả request rồi coi là "đã sửa".
- Kiểm quyền ở controller của một route nhưng quên route khác (list, export).
- Lấy role từ body, tenant từ header, hoặc userId từ query.
- Kiểm `assignee`/`status` sau khi đã merge body của PATCH (client tự gán mình làm assignee).
- Viết test chỉ kiểm status code mà không kiểm body không lộ dữ liệu ở test 3, 16, 17.
- Không reset dữ liệu giữa các test, làm test phụ thuộc thứ tự chạy.
