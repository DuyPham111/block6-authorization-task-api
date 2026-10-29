# Đối chiếu đề Block 6 với bài làm

Ngày kiểm tra: 29/10/2026. Đối chiếu với outline Block 6 (Authorization và Access Control), slide bài giảng, mã nguồn, các lệnh kiểm tra thực thi và thao tác trên trình duyệt. Môi trường: Node v22.16.0, npm 11.7.0, Windows 11.

## Kiểm tra thực thi

| Lệnh / thao tác | Kết quả quan sát |
| --- | --- |
| `npm run typecheck` | 0 lỗi (`tsc --checkJs` trên `src/`, `demo/server.js`, `scripts/token.js`) |
| `npm test` | 84/84 test đạt, khoảng 2–3 giây |
| `npm run test:coverage` | `src/`: 98,5% dòng; `policy.js` 100% dòng và nhánh |
| `bash scripts/test-against.sh starter test/v1.idor.test.js` | 5/11 đỏ trên code starter (O3, E2, E4, E6, E7) |
| `npm run oracle` | starter 6 → v1 7 → v2 12 → v3 14 → v4-pre 15 → v4 17 → final 17 (trên 17) |
| Biến thể `decide()` luôn deny | 51/70 test trượt; theo tiêu chí "403 hoặc 404" vẫn qua 11/17 oracle |
| `bash scripts/demo-idor.sh` (starter / bản cuối) | Alice `GET /tasks/B1`: 200 lộ dữ liệu → 404 `{"error":"not_found"}` |
| Trang demo `npm run demo`, bấm "Chạy tất cả 21" | 21/21 kịch bản đạt, dữ liệu tự reset |
| Swagger UI `http://localhost:3100/docs` | Tải `docs/openapi.yaml`, Authorize bằng Bearer token, Try it out gọi được API |
| `docker compose up --build` | Xem [EVIDENCE.md](EVIDENCE.md) mục Docker |

## Mục tiêu của block

| Mục tiêu trong đề | Hiện thực / nơi kiểm tra |
| --- | --- |
| 1. Phân biệt authentication, OAuth2 scope và quyền truy cập tài nguyên | `auth.js` (401), `requireScope` (403 `insufficient_scope`), `policy.decide` (403/404); test O1, E1, E7, E8; REPORT §4.2 |
| 2. Giải thích ACL, RBAC, ABAC, ReBAC và chọn mô hình phù hợp | REPORT §4.4; slide "Bốn mô hình" và quiz chọn mô hình ([docs/thuyet-minh/07](docs/thuyet-minh/07-cau-hoi-ket-thuc.md)) |
| 3. Phát hiện và sửa IDOR/BOLA | V1: evidence curl trước/sau, `v1-before.txt` (5 đỏ) → `v1-after.txt` (11/11) |
| 4. Thiết kế chính sách theo principal, action, resource, context | `decide(user, action, { project, task })`; [docs/policy-matrix.md](docs/policy-matrix.md) |
| 5. Kiểm quyền tại server/business layer, bảo vệ mọi đường truy cập | PEP ở `services/`; route không import `db` (grep); C1 đối chiếu `/tasks` với `/tasks/:id` |
| 6. Automated tests cho cả được phép và bị từ chối | 84 test; ma trận 12 ô có cả allow và deny; bản "từ chối hết" trượt 51/70 |

## Phạm vi kiến thức

| Nội dung trong đề | Hiện thực / nơi kiểm tra |
| --- | --- |
| Authentication xác định người gọi | JWT verify, `sub` nạp user từ DB; sai/hết hạn → 401 (O1, E1) |
| Scope giới hạn quyền của token, không mặc nhiên cho phép mọi object | E7: token `tasks:read` đọc A1 nhưng 404 với B1 |
| Application authorization: principal + action + resource cụ thể | `enforce(user, action, resource)` trong mọi service |
| Ý nghĩa 401, 403, 404 | REPORT §4.3; test E2 (404 không phân biệt được), O5 (403) |
| Deny by default, least privilege | Không khớp nhánh nào → deny; role lạ không quyền (U3); action chưa khai báo bị từ chối (U4); scope theo loại thao tác |
| ACL, RBAC, ABAC, ReBAC; ownership là một quan hệ; mô hình kết hợp | RBAC + ReBAC + ABAC + tenant; E20, E21 chứng minh không lớp nào thay lớp khác |
| Không xây policy engine tổng quát | Một hàm thuần, ~30 dòng (REPORT §4.6) |
| IDOR/BOLA, BFLA, leo thang ngang và dọc | O3/O14 (ngang), O6/O7 (dọc, BFLA), O10/E12 (tự khai quyền) |
| Giới hạn của kiểm quyền ở giao diện | O6: gọi thẳng DELETE → 403; câu hỏi kết thúc 3 |
| Regression test tái hiện lỗi trước khi sửa | `scripts/test-against.sh`, file `v*-before.txt` cho từng phiên bản |
| `allow(subject, action, resource, context)`, PEP, PDP | `policy.js` = PDP, `services/` = PEP (REPORT §3, §4.6, §4.7) |
| Enforcement tại API, service; tránh chính sách mâu thuẫn giữa entry point | Một `decide()` dùng chung; C1 khóa nhất quán check/list |
| Không tin `userId`, `role`, `tenantId` client tự khai | O10, O17, E6, E22 |
| Nhất quán, hiệu năng truy vấn, cache, thu hồi quyền | `readableProjectIds` lọc trong truy vấn (không N+1); không cache, thu hồi 0 giây (E5, C3) |
| OPA, Casbin, OpenFGA chỉ là hướng tìm hiểu | So sánh trong REPORT §4.6, không cài đặt |

## Bài thực hành: Task Management API

| Yêu cầu | Hiện thực / nơi kiểm tra |
| --- | --- |
| Starter có `GET /tasks/:id` chỉ kiểm token; mở rộng PATCH, DELETE project, quản lý thành viên | Tag `starter`; các route mở rộng có sẵn ở starter (đều chưa kiểm quyền) |
| Dữ liệu mẫu Alpha (Alice Owner, Bob Member, A1, A2), Beta (Charlie Owner, B1, B2) | [data/seed.json](data/seed.json); thêm Vera (Viewer), Erin (chưa thuộc project), Dana (Admin tenant) để test đủ ma trận và V4 |
| **V1**: dùng token Alice đọc B1, ghi nhận response | [v1-idor-curl-before.txt](docs/evidence/v1-idor-curl-before.txt): 200 kèm nội dung Beta |
| V1: automated test tái hiện lỗi | `test/v1.idor.test.js`; [v1-before.txt](docs/evidence/v1-before.txt) |
| V1: object-level authorization tại server | `taskService.getTask` → `enforce` → `decide` (diff `starter..v1`) |
| V1: Alice vẫn đọc A1, không đọc B1 | O2 (200), O3 (404); [v1-after.txt](docs/evidence/v1-after.txt) |
| **V2**: Viewer, Member, Project Owner; permission matrix | `ROLE_PERMISSIONS`; [docs/policy-matrix.md](docs/policy-matrix.md) |
| V2: enforce role trong phạm vi project, không dùng role tự khai | Role từ `findMembership(user, project)`; O10 |
| V2: positive và negative test cho mỗi quyền | 12 ô M1–M7, O5–O9 (`test.each`), test từ chối kiểm dữ liệu không đổi |
| **V3**: assignee và trạng thái Open/Closed | Thuộc tính `assignee`, `status` trong task |
| V3: Member chỉ sửa task được giao khi chưa đóng | Nhánh ABAC trong `decide()`; O11 (200), O12, O13 (403) |
| V3: kiểm quan hệ member, assignee, trạng thái | E20, E21 (kết hợp), E3, E16 (lấy điều kiện từ bản ghi đang lưu) |
| V3: test task project khác, chưa assign, đã đóng | O14, O12, O13 |
| **V4**: hai tenant với project và user | `tenants`, `tenantId` trong seed |
| V4: Admin tenant Alpha không truy cập tenant Beta | O15 (A1 200), O16 (B1 404), E23 (danh sách và xóa Beta 404) |
| V4: gọi API trực tiếp, giả mạo `tenantId`/`role` | O17 (`X-Tenant-Id: beta`), E22 (`tenantId`, `role` trong query/body) |

## Yêu cầu kiểm chứng

| Tình huống trong đề | Kỳ vọng | Test | Kết quả bản nộp |
| --- | --- | --- | --- |
| Anonymous đọc task | 401 | O1 | 401 |
| Alice đọc A1 | 200 | O2 | 200 |
| Alice đọc B1 | 403 hoặc 404, không lộ nội dung | O3 | 404, body `{"error":"not_found"}` |
| Charlie đọc B1 | 200 | O4 | 200 |
| Member sửa task không được assign | Từ chối | O12 | 403, task không đổi |
| Member sửa task đã đóng | Từ chối | O13 | 403, task không đổi |
| Caller tự gửi `role=Admin` | Không tăng quyền | O10 | 403, project còn |
| Admin tenant Alpha truy cập tenant Beta | Từ chối | O16, O17 | 404 |
| Kiểm cả request hợp lệ và không hợp lệ; từ chối hết không phải bản sửa đúng | — | O2, O4, O8, O9, O11, O15, M1, M4–M7 | Đạt; bản "từ chối hết" trượt 51/70 |

## Bài nộp theo đề

| Bài nộp | Nơi nộp |
| --- | --- |
| Bảng chính sách quyền của vai trò và tài nguyên | [docs/policy-matrix.md](docs/policy-matrix.md), REPORT §6 |
| Automated tests cho request được phép và bị từ chối | `test/` (84 test), `npm test` |
| Evidence IDOR trước khi sửa, kết quả test sau khi sửa | `docs/evidence/v1-idor-curl-before.txt`, `v1-before.txt`, `v1-after.txt` |
| Code diff thể hiện nơi áp dụng authorization | `docs/evidence/diff-*.diff`, `git diff starter v1 -- src` |
| Giải thích lựa chọn ACL/RBAC/ABAC/ReBAC; trường hợp chưa kiểm tra | REPORT §4.4, §10 |

## Bài nộp theo mẫu của môn

| Yêu cầu | Nơi nộp |
| --- | --- |
| Mã nguồn | `src/`, `demo/`, `scripts/`, `test/` |
| Data | `data/seed.json`, `data/README.md` |
| README.md hướng dẫn triển khai | [README.md](README.md): môi trường, cài đặt, cấu hình, Docker, demo, kiểm tra, khắc phục lỗi |
| REPORT.md giải thích các lựa chọn | [REPORT.md](REPORT.md): 17 lựa chọn dạng "Nhóm chọn / Không chọn / Đánh đổi" |
| REPORT.html | [REPORT.html](REPORT.html): bộ slide báo cáo kèm slide giải thích từng lựa chọn, chế độ đọc tài liệu |

## Câu hỏi kết thúc

| Câu hỏi | Trả lời / test |
| --- | --- |
| Scope `tasks:read` có đủ để Alice đọc B1? | Không; E7 |
| Role Member còn cần kiểm dữ liệu nào? | Project, assignee, status, tenant; O12–O16, E20, E21 |
| Vì sao ẩn nút Delete không ngăn request trực tiếp? | Giao diện ở client; O6 |
| Hàng triệu tài liệu chia sẻ qua nhóm? | PDP chung, ReBAC lưu quan hệ, tách check/list, cache có thu hồi; C1 |

Trả lời đầy đủ: REPORT §11 và [docs/thuyet-minh/07-cau-hoi-ket-thuc.md](docs/thuyet-minh/07-cau-hoi-ket-thuc.md).

## Giới hạn xác minh

- Tái tạo `test-against.sh` và bảng oracle cần lịch sử git; gói ZIP không kèm `.git`, dùng repository GitHub trong [SUBMISSION.md](SUBMISSION.md).
- Hiệu năng với cơ sở dữ liệu thật và concurrency chưa được đo (REPORT §10).
