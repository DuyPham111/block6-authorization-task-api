# EVIDENCE — Block 6: Authorization & Access Control

Nhóm 07 · 23127045 · 23127102 · 23127159 · 23127183 · 23127393

Mọi số liệu dưới đây lấy từ lượt chạy thật, lưu nguyên văn trong [docs/evidence/](docs/evidence/). Môi trường đo: Node v22.16.0, npm 11.7.0, Windows 11, ngày 29/10/2026.

## 1. Lỗi IDOR trước và sau khi sửa (curl)

`bash scripts/demo-idor.sh`: Alice (Owner Alpha) đọc A1 và B1 bằng cùng một token hợp lệ.

| Request | Starter | Sau V1 | File |
| --- | --- | --- | --- |
| `GET /tasks/A1` | 200, task Alpha | 200, task Alpha | |
| `GET /tasks/B1` | **200**, lộ `"description":"Dữ liệu nội bộ của project Beta"` | **404** `{"error":"not_found"}` | [trước](docs/evidence/v1-idor-curl-before.txt) · [sau](docs/evidence/v1-idor-curl-after.txt) |

## 2. Cùng một test: đỏ trước khi sửa, xanh sau khi sửa

Bộ test mới chạy trên `src/` của tag trước bằng `scripts/test-against.sh`, rồi chạy lại sau khi sửa.

| Phiên bản | Chạy trên code cũ | Sau khi sửa | Test đỏ trước khi sửa | File |
| --- | --- | --- | --- | --- |
| V1 | `starter`: 6/11 | 11/11 | O3, E2, E4, E6, E7 | [before](docs/evidence/v1-before.txt) · [after](docs/evidence/v1-after.txt) |
| V2 | `v1`: 8/21 | 21/21 | O5, M2, M3, O6, O7, O10, E12, E10, E13, E11, E14, E9, E15 | [before](docs/evidence/v2-before.txt) · [after](docs/evidence/v2-after.txt) |
| V3 | `v2`: 6/10 | 10/10 | O12, O13, E3, E16 | [before](docs/evidence/v3-before.txt) · [after](docs/evidence/v3-after.txt) |
| V4 | `v4-pre`: 2/8 | 8/8 | O16, O17, E22, E23, E25, E26 | [before](docs/evidence/v4-before.txt) · [after](docs/evidence/v4-after.txt) |

`v4-pre` là trạng thái cố ý sai (Admin được coi là toàn cục): Dana (Admin tenant Alpha) đọc được B1 và xóa được project Beta.

## 3. 17 test oracle theo từng phiên bản

`npm run oracle` chạy bộ test cuối trên từng git tag. Bảng đầy đủ từng test: [docs/evidence/oracle-matrix.md](docs/evidence/oracle-matrix.md).

| | starter | v1 | v2 | v3 | v4-pre | v4 | final | submit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Oracle qua | 6/17 | 7/17 | 12/17 | 14/17 | 15/17 | 17/17 | 17/17 | **17/17** |

## 4. Kiểm tra ngược: bản sửa "từ chối hết"

Biến thể `decide()` luôn trả deny, chạy trên bộ test tại tag `final` ([deny-all.txt](docs/evidence/deny-all.txt)):

- **51/70 test trượt**: mọi test được phép (O2, O4, O8, O9, O11, O15, M1, M4–M7, E17, E18, E24…) đều đỏ.
- Nếu chỉ chấm theo tiêu chí "403 hoặc 404" của đề, bản sai vẫn qua **11/17** oracle, khớp cột "Từ chối hết" trên slide 25 của bài giảng. Đó là lý do bộ test có test được phép cho mọi quyền.

## 5. Lượt chạy cuối của bản nộp

[docs/evidence/final.txt](docs/evidence/final.txt):

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` (tsc `--checkJs`) | 0 lỗi |
| `npm test` | **84/84** đạt, 8 file test |
| Coverage `src/` | 98,46% dòng · 96,07% câu lệnh · 84,61% nhánh · 98,63% hàm |
| Coverage `src/policy.js` (PDP) | 100% dòng, câu lệnh, nhánh, hàm |

## 6. Chạy server thật

`node src/server.js` (cổng thử 3055), token sinh bằng `npm run -s token -- alice`:

| Request | Kết quả |
| --- | --- |
| `GET /health` | `{"status":"ok"}` |
| Alice `GET /tasks/A1` | 200 |
| Alice `GET /tasks/B1` | 404 `{"error":"not_found"}` |

Dòng audit log in ra stdout cho request bị từ chối (client không thấy lý do):

```json
{"seq":2,"ts":"2026-10-29T10:46:08.998Z","event":"authz.decision","userId":"alice","action":"task:read","projectId":"beta","taskId":"B1","allow":false,"reason":"other_tenant"}
```

## 7. Trang demo và Swagger UI (trình duyệt)

Thao tác trên `npm run demo`, cửa sổ 1600×900:

| Thao tác | Kết quả quan sát |
| --- | --- |
| Bấm **Chạy tất cả 21** (17 oracle + E1, E3, E5, E7) | `21/21 kịch bản đạt · 400 ms · dữ liệu đã reset về seed` |
| Chạy O3 (Alice đọc B1) | Response `404 Not Found`; khung PDP: `DENY · khác tenant (tenant boundary) · alice · task:read · task B1, project beta` |
| Dana `GET /tasks/B1` kèm header `X-Tenant-Id: beta` | 404, header bị bỏ qua |
| Console trình duyệt | Không có lỗi JavaScript (chỉ log mạng của các response 4xx cố ý) |
| Swagger UI `/docs` | Tải `openapi.yaml` (OpenAPI 3.1, 8 operation, không báo lỗi đặc tả) |
| Swagger: Authorize bằng token Alice → `GET /tasks/{id}` → Try it out với `A1` | Request `http://localhost:3100/tasks/A1` kèm Bearer, response chứa task A1 |

## 8. REPORT.html

`npm run report` sinh REPORT.html (30 slide, ~116 KB, một file). Kiểm tra trên trình duyệt 1440×900:

- Chế độ đọc: phần giới thiệu, mục lục 6 section, mỗi slide có phần **Giải thích** bên dưới.
- Chế độ trình chiếu: phím ← → / Home / End, chọn slide theo mục lục, `#n` trên URL nhảy tới slide n; mũi tên, biểu đồ cột và icon hiển thị đúng; console không lỗi.
- Đo tự động 30 slide: không phần tử nào tràn lề phải; nội dung không lấn vào dòng footer.

## 9. Docker

`Dockerfile`, `docker-compose.yml`, `.dockerignore` đã viết theo REPORT §4.16. **Trong lượt đóng gói này nhóm chưa build được image trên máy đo** vì Docker Desktop không khởi động xong engine (lệnh `docker version` không phản hồi). Cách kiểm tra:

```bash
cp .env.example .env               # đặt JWT_SECRET
docker compose up --build -d
curl http://localhost:3000/health  # {"status":"ok"}
docker compose ps                  # STATUS: healthy
docker compose logs api            # dòng {"event":"authz.decision",...} khi có request bị từ chối
docker compose down
```

## 10. Code diff theo phiên bản

| Diff | `src/` thay đổi | File |
| --- | --- | --- |
| starter → v1 | 5 file, +66/−7 | [diff-starter-v1.diff](docs/evidence/diff-starter-v1.diff) |
| v1 → v2 | 5 file, +78/−20 | [diff-v1-v2.diff](docs/evidence/diff-v1-v2.diff) |
| v2 → v3 | 1 file, +7/−1 | [diff-v2-v3.diff](docs/evidence/diff-v2-v3.diff) |
| v4-pre → v4 | 2 file, +8/−3 | [diff-v4-pre-v4.diff](docs/evidence/diff-v4-pre-v4.diff) |
| starter → submit | toàn bộ | [diff-starter-submit.diff](docs/evidence/diff-starter-submit.diff) |
