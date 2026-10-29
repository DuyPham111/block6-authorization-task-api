# Nhóm 07 — Block 6: Authorization & Access Control (Task Management API)

**Thành viên:** 23127045 · 23127102 · 23127159 · 23127183 · 23127393.

Gói nộp gồm mã nguồn Task API, dữ liệu lab, hướng dẫn triển khai (file này), **REPORT.md** và **REPORT.html** giải thích các lựa chọn của nhóm, evidence chạy thật, trang demo trên trình duyệt và đặc tả OpenAPI.

| Kết quả | Giá trị |
| --- | --- |
| Test oracle của đề | **17/17** đạt (starter 6/17 → v1 7 → v2 12 → v3 14 → v4 17) |
| Toàn bộ automated test | **84/84** đạt (`npm test`) |
| Kiểm kiểu | `npm run typecheck` đạt (TypeScript `--checkJs`) |
| Coverage | 98,5% dòng `src/`; `src/policy.js` 100% nhánh |
| Bản sửa sai "từ chối hết" | Bị bắt: 51/70 test trượt ([evidence](docs/evidence/deny-all.txt)) |

## 1. Yêu cầu môi trường

- **Node.js ≥ 22** (dùng `process.loadEnvFile` có sẵn để đọc `.env`). Gói đã kiểm tra trên Node **22.16.0**, npm 11.
- npm đi kèm Node.js; cần Internet khi cài dependency lần đầu.
- Windows PowerShell, macOS hoặc Linux. Không cần cơ sở dữ liệu ngoài hay công cụ build frontend.
- Cổng **3000** (API) và **3100** (server demo) phải trống.
- Docker Desktop / Docker Engine là **tùy chọn**, chỉ cần khi triển khai bằng container (mục 4).

## 2. Triển khai sau khi giải nén

Mở terminal tại thư mục chứa `package.json` rồi chạy:

~~~powershell
node --version          # >= 22
npm ci                  # cài đúng phiên bản trong package-lock.json
npm run check           # typecheck + 84 test, khoảng 5 giây
npm start               # API tại http://localhost:3000
~~~

Kiểm tra nhanh API ở terminal thứ hai:

~~~bash
curl http://localhost:3000/health                                   # {"status":"ok"}
TOKEN=$(npm run -s token -- alice)                                   # token của Alice
curl -i http://localhost:3000/tasks/A1 -H "Authorization: Bearer $TOKEN"   # 200
curl -i http://localhost:3000/tasks/B1 -H "Authorization: Bearer $TOKEN"   # 404 (che sự tồn tại)
~~~

PowerShell: `$TOKEN = npm run -s token -- alice` rồi `curl.exe -i http://localhost:3000/tasks/A1 -H "Authorization: Bearer $TOKEN"`.

Dừng server bằng **Ctrl+C**.

## 3. Cấu hình

Không bắt buộc với môi trường dev: thiếu `.env` thì dùng giá trị mặc định cho lab. Muốn đổi thì sao chép `.env.example` thành `.env`:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `JWT_SECRET` | `block6-dev-secret` (chỉ dev) | Khóa ký JWT HS256. **Bắt buộc** khi `NODE_ENV=production`: thiếu thì app từ chối khởi động |
| `AUDIT_LOG` | `deny` (`off` khi chạy test) | Ghi quyết định phân quyền ra stdout dạng JSON Lines: `off`, `deny`, `all` |
| `PORT` | `3000` | Cổng API |
| `DEMO_PORT` | `3100` | Cổng server demo |

`npm start`, `npm run demo`, `npm run token` đều tự đọc `.env`, nên token sinh ra khớp với server đang chạy.

## 4. Triển khai bằng Docker (tùy chọn)

~~~bash
cp .env.example .env            # rồi đặt JWT_SECRET là chuỗi ngẫu nhiên dài
docker compose up --build -d    # build image node:22-alpine, chạy bằng user node
curl http://localhost:3000/health
TOKEN=$(npm run -s token -- alice)   # cần Node trên máy host; dùng cùng JWT_SECRET trong .env
curl -i http://localhost:3000/tasks/A1 -H "Authorization: Bearer $TOKEN"
docker compose logs -f api      # xem audit log: các dòng {"event":"authz.decision",...}
docker compose down
~~~

Image chỉ chứa `src/`, `data/` và dependency production (`npm ci --omit=dev`). Không có server demo, test hay `/dev/*`. Có `HEALTHCHECK` gọi `/health`, nhận `SIGTERM` để dừng gọn.

## 5. Tài khoản và dữ liệu

Không có mật khẩu: lab giả định đăng nhập đã có sẵn, token được sinh bằng `npm run token -- <user> [scope...]` hoặc trên trang demo.

| User | Tenant | Quan hệ |
| --- | --- | --- |
| alice | alpha | Owner project Alpha |
| bob | alpha | Member Alpha, được giao task A1 |
| vera | alpha | Viewer Alpha |
| erin | alpha | Chưa thuộc project nào |
| dana | alpha | Admin của tenant Alpha |
| charlie | beta | Owner project Beta |

Task: A1 (Alpha, giao cho bob, Open), A2 (Alpha, chưa giao), B1 (Beta, giao cho charlie), B2 (Beta, chưa giao).
Dataset nằm ở [data/seed.json](data/seed.json), mô tả ở [data/README.md](data/README.md). Dữ liệu ở RAM: khởi động lại là về trạng thái ban đầu.

## 6. Demo trên trình duyệt và Swagger

~~~bash
npm run demo        # http://localhost:3100/demo/   và   http://localhost:3100/docs
~~~

1. Mở **http://localhost:3100/demo/**.
2. Chọn người gọi (cột trái), chọn request mẫu hoặc tự soạn method/path/header/body, bấm **Gửi request**.
3. Ô **Response** hiện mã trạng thái, body, lệnh curl tương đương và **quyết định của PDP** (đọc từ audit log phía server, ví dụ `DENY · khác tenant (tenant boundary)`). Client chỉ nhận `{"error":"not_found"}`, không thấy lý do.
4. Cột phải: **Chạy tất cả 21** kịch bản (17 oracle + 4 bổ sung). Kết quả mong đợi: `21/21 kịch bản đạt`.
5. Bảng **Dữ liệu hiện tại** cho thấy request bị từ chối không làm đổi dữ liệu. Nút **Reset dữ liệu về seed** đưa dữ liệu về ban đầu.
6. **http://localhost:3100/docs**: Swagger UI đọc [docs/openapi.yaml](docs/openapi.yaml). Lấy token ở trang demo hoặc `npm run token -- alice`, bấm **Authorize**, rồi **Try it out**.

Server demo bọc chính app thật và thêm `/demo`, `/docs`, `/dev/token`, `/dev/reset`, `/dev/state`, `/dev/audit`. Vì `/dev/token` cấp token cho bất kỳ ai, server demo **chỉ nghe trên 127.0.0.1** và không bao giờ được mount vào `src/app.js` (test `[S1]` chứng minh).

## 7. Kiểm tra và tái tạo evidence

~~~bash
npm run typecheck         # tsc --checkJs trên src/, demo/server.js
npm test                  # 84 test: 17 oracle [O*], 12 ô ma trận [M*], bổ sung [E*], nhất quán [C*], unit PDP [U*], demo [S*], vận hành [P*][L*][D*]
npm run test:coverage     # bảng coverage
npm run report            # sinh lại REPORT.html từ report/slides/
~~~

Hai lệnh sau cần **lịch sử git** (tag `starter`, `v1`, `v2`, `v3`, `v4-pre`, `v4`, `final`, `submit`). Gói ZIP không kèm `.git`, nên hãy clone repository:

~~~bash
git clone https://github.com/DuyPham111/block6-authorization-task-api.git
bash scripts/test-against.sh starter test/v1.idor.test.js   # cùng test V1, chạy trên code starter: thấy đỏ
npm run oracle                                              # bảng 17 test oracle theo từng tag
git diff starter v1 -- src                                  # nơi áp dụng authorization ở V1
~~~

Evidence đã đo sẵn nằm trong [docs/evidence/](docs/evidence/), tổng hợp ở [EVIDENCE.md](EVIDENCE.md).

## 8. API

| Endpoint | Scope | Policy action | Mô tả |
| --- | --- | --- | --- |
| `GET /health` | — | — | Health check, không cần token |
| `GET /tasks` | `tasks:read` | lọc theo `readableProjectIds` | Mọi task người gọi được đọc |
| `GET /tasks/:id` | `tasks:read` | `task:read` | Đọc một task |
| `PATCH /tasks/:id` | `tasks:write` | `task:edit` | Sửa `title`, `description`, `status` |
| `GET /projects/:id/tasks` | `tasks:read` | `task:read` | Task của một project |
| `DELETE /projects/:id` | `projects:manage` | `project:delete` | Xóa project |
| `POST /projects/:id/members` | `projects:manage` | `member:manage` | Thêm thành viên |
| `DELETE /projects/:id/members/:userId` | `projects:manage` | `member:manage` | Gỡ thành viên |

Mã lỗi: **401** chưa xác thực · **403** thiếu scope, hoặc cùng project nhưng không đủ quyền · **404** không tồn tại, hoặc ngoài project/tenant (body giống hệt nhau) · **400** dữ liệu sai · **409** xung đột · **413** body quá 10 KB.

## 9. Kiến trúc kiểm quyền

```
request → authenticate (JWT: sub, scope) → requireScope → route → service = PEP → policy.decide = PDP
            401                             403 scope              nạp resource    tenant → Admin → thành viên (ReBAC)
                                                                   từ DB           → role (RBAC) → assignee/status (ABAC)
                                                                   → enforce       → 403 / 404, ghi audit log
```

- `src/policy.js`: **PDP**, toàn bộ chính sách trong một hàm thuần `decide(user, action, { project, task })`.
- `src/services/*.js`: **PEP**, nạp resource từ DB, gọi `enforce` rồi mới thao tác. Route không import DB.
- Role, tenant, assignee, status luôn đọc từ dữ liệu server. `role`, `userId`, `tenantId`, `X-Tenant-Id` gửi từ client bị bỏ qua.

## 10. Cấu trúc và tài liệu nộp

| Đường dẫn | Nội dung |
| --- | --- |
| `src/` | Mã nguồn API: `policy.js` (PDP), `services/` (PEP), `auth.js`, `audit.js`, `db.js`, `routes/` |
| `data/` | Dataset `seed.json` và mô tả |
| `demo/` | Server demo và trang `/demo` |
| `test/` | 84 automated test (Jest + Supertest) |
| `scripts/` | Sinh token, chạy test trên tag cũ, bảng oracle, build REPORT.html, demo IDOR bằng curl |
| `docs/openapi.yaml` | Đặc tả OpenAPI 3.1 (Swagger UI tại `/docs` của server demo) |
| `docs/evidence/` | Output test trước/sau từng phiên bản, curl IDOR, bảng oracle, code diff, bản "từ chối hết" |
| `docs/thuyet-minh/` | Thuyết minh thiết kế và câu hỏi vấn đáp từng phần |
| `docs/policy-matrix.md` | Bảng chính sách quyền |
| `report/` | Nguồn các slide của REPORT.html |
| **`REPORT.md`** | Báo cáo chi tiết: nhóm chọn gì, không chọn gì, vì sao, đánh đổi |
| **`REPORT.html`** | Bộ slide báo cáo (mở offline), có chế độ đọc tài liệu kèm giải thích từng slide |
| `AUDIT.md` | Đối chiếu từng yêu cầu của đề với nơi hiện thực và test chứng minh |
| `EVIDENCE.md` | Tổng hợp số liệu evidence |
| `SUBMISSION.md` | Thông tin gói nộp (commit, repository) |
| `Dockerfile`, `docker-compose.yml`, `.env.example` | Triển khai container và cấu hình mẫu |
| `package.json`, `package-lock.json`, `tsconfig.json` | Thư viện, phiên bản khóa, cấu hình kiểm kiểu |

Để xem kết quả mà không cần chạy server: mở **REPORT.html** bằng trình duyệt (phím ←/→ để chuyển slide, nút **Đọc tài liệu** để xem toàn bộ kèm giải thích).

## 11. Khắc phục lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `process.loadEnvFile is not a function` hoặc lỗi cú pháp lạ | Node quá cũ. Cài Node ≥ 22 (khuyến nghị 22.16), mở terminal mới |
| `EADDRINUSE` | Cổng 3000/3100 đang bận: dừng server cũ bằng Ctrl+C, hoặc đặt `PORT` / `DEMO_PORT` khác |
| `JWT_SECRET is required when NODE_ENV=production` | Đặt `JWT_SECRET` trong `.env` hoặc biến môi trường |
| `docker compose` báo `JWT_SECRET chua duoc dat` | Tạo `.env` từ `.env.example` và đặt `JWT_SECRET` |
| Token hợp lệ nhưng luôn `401 invalid_token` | Token sinh bằng secret khác server. Sinh lại bằng `npm run token` trong cùng thư mục có `.env` |
| `test-against.sh` / `npm run oracle` lỗi không thấy tag | Gói ZIP không có `.git`: clone repository GitHub ở mục 7 |

Ứng dụng chỉ phục vụ lab với dữ liệu giả. Các giới hạn khi triển khai thật (HTTPS, rate limit, DB thật, xoay khóa) được trình bày trong REPORT.
