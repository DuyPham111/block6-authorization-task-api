# Phần 8: Vận hành và công cụ (kiểm kiểu, audit log, OpenAPI, Docker, trang demo)

## Mục tiêu

Biến bài lab thành một sản phẩm **chạy được, đọc được, kiểm được** ở máy người chấm: một lệnh cài, một lệnh kiểm tra, có tài liệu API thử được trực tiếp, có log giải thích quyết định, đóng gói được bằng container.

## Đã làm gì

| Thành phần | File | Lệnh |
| --- | --- | --- |
| Kiểm kiểu tĩnh | `tsconfig.json`, `src/types.d.ts`, JSDoc trong `src/` | `npm run typecheck` |
| Audit log quyết định phân quyền | `src/audit.js`, gọi trong `services/access.js` | `AUDIT_LOG=all npm start` |
| Đặc tả API | `docs/openapi.yaml` (OpenAPI 3.1) | Swagger UI: `npm run demo` → `/docs` |
| Health check, giới hạn body, tắt `X-Powered-By` | `src/app.js` | `curl localhost:3000/health` |
| Bắt buộc secret ở production | `src/auth.js` | test P5 |
| Container | `Dockerfile`, `docker-compose.yml`, `.dockerignore` | `docker compose up --build` |
| Cấu hình | `.env.example`, `src/load-env.js` (`process.loadEnvFile`) | `cp .env.example .env` |
| Trang demo | `demo/server.js`, `demo/public/index.html` | `npm run demo` → `/demo/` |

## Phương án đã cân nhắc

| Quyết định | Chọn | Không chọn | Vì sao |
| --- | --- | --- | --- |
| Kiểm kiểu | JSDoc + `tsc --checkJs` | Chuyển sang TypeScript + `tsx` (như Block 5) | Giữ chạy thẳng bằng `node` cho mọi tag cũ (test-against.sh); vẫn bắt lỗi kiểu |
| | | Không kiểm kiểu | Sai tên trường giữa các lớp chỉ lộ khi chạy |
| Audit | JSON Lines ra stdout, `AUDIT_LOG=off\|deny\|all` | ELK/Loki dựng trong lab | Nặng; JSON Lines đã gom được bằng ELK/Loki sau này |
| | | winston / pino | Thêm dependency cho một loại sự kiện |
| | | Trả lý do trong response | Lộ chính sách, giúp kẻ tấn công |
| Tài liệu API | OpenAPI 3.1 viết tay + Swagger UI | `swagger-jsdoc` | YAML rải trong comment làm route khó đọc |
| | | Postman collection | Không phải chuẩn mở |
| | | Redoc | Không có "Try it out" |
| Đồng bộ tài liệu | Test D1 so route Express với đặc tả | Rà tay | Thêm route quên tài liệu thì test đỏ |
| Cấu hình | `.env` + `process.loadEnvFile` của Node, chỉ ở entry point | `dotenv` | Node 22 có sẵn, bớt một dependency; test không nạp `.env` nên luôn chạy giống nhau |
| Container | `node:22-alpine`, `npm ci --omit=dev`, user `node`, HEALTHCHECK | Image `node:22` đầy đủ, chạy root | Nhỏ hơn, ít bề mặt tấn công |
| | | PM2, Kubernetes | Vượt phạm vi một API in-memory |
| Trang demo | HTML + JS thuần, server riêng 127.0.0.1 | React/Vue | Cần build, không cần cho ~500 dòng |
| | | Mount `/dev/*` vào app khi `NODE_ENV=dev` | Đặt sai biến môi trường là thành cửa sau cấp token |

## Câu hỏi vấn đáp

**H: Block 5 nhóm dùng TypeScript, sao Block 6 lại dùng JavaScript?**
Đ: Block 6 có một yêu cầu đặc thù: chạy bộ test mới trên mã nguồn của các tag cũ (`starter`, `v1`…) để chứng minh test đỏ trước khi sửa. Giữ JavaScript thì mọi tag chạy thẳng bằng `node`, không cần biên dịch. Nhóm vẫn giữ lợi ích kiểm kiểu như Block 5: JSDoc + `tsc --checkJs` với kiểu `Task`, `Membership`, `Decision` trong `src/types.d.ts`, chạy bằng `npm run typecheck` (0 lỗi).

**H: Audit log ghi gì và để làm gì?**
Đ: Mỗi lần `enforce` ghi một dòng JSON: `userId`, `action`, `projectId`, `taskId`, `allow`, `reason`. Client chỉ nhận `404 not_found` chung, nhưng server biết vì sao (`other_tenant`, `not_member`, `not_assignee`…). Dùng để điều tra, phát hiện dò ID (nhiều 404 liên tiếp từ một user), và để trang demo giải thích khi trình bày. Test L1 chứng minh hai lần bị chặn với lý do khác nhau trả cùng một body.

**H: Sao không dùng ELK như ví dụ của thầy?**
Đ: ELK là nơi *gom và tìm kiếm* log, không phải cách *ghi* log. Nhóm ghi log dạng JSON Lines ra stdout, đúng định dạng mà Filebeat/Logstash, Loki hay Docker logging driver đọc được. Muốn đưa vào ELK chỉ cần cấu hình phía hạ tầng, không sửa code. Dựng cả ELK trong lab thì nặng mà không thêm gì cho phần phân quyền.

**H: Swagger UI có phải là cửa sau không?**
Đ: Không. Swagger UI chỉ là trang đọc `docs/openapi.yaml` và gửi request như mọi client khác: vẫn phải có token, vẫn qua đủ ba lớp kiểm tra. Swagger chỉ có trên server demo, không có trong image Docker.

**H: Làm sao biết đặc tả OpenAPI không lệch với code?**
Đ: Test D1 đọc danh sách route trực tiếp từ Express router (`router.stack`), rồi so với các path/method trong `docs/openapi.yaml`. Thêm route mà quên ghi tài liệu, hoặc tài liệu ghi route không tồn tại, thì test đỏ.

**H: Vì sao image Docker không có server demo?**
Đ: Server demo có `/dev/token`, cấp token cho bất kỳ ai. `.dockerignore` loại thư mục `demo/`, image chỉ chạy `src/server.js`. Ngoài ra image đặt `NODE_ENV=production`, nên thiếu `JWT_SECRET` thì app không khởi động (test P5), và `docker compose` cũng dừng ngay nếu chưa đặt biến này.

**H: Health check có lộ thông tin không?**
Đ: `GET /health` chỉ trả `{"status":"ok"}`, không cần token, không đọc dữ liệu nghiệp vụ (test P1). Docker dùng nó cho `HEALTHCHECK`.

**H: Giới hạn body 10 KB để làm gì?**
Đ: Chặn request quá lớn làm tốn bộ nhớ khi parse JSON. Task chỉ có `title`, `description`, `status` nên 10 KB là dư. Vượt quá thì trả `413 payload_too_large`, dữ liệu không đổi (test P4).

## Câu hỏi bẫy

**H: `AUDIT_LOG=all` thì có ghi token hay dữ liệu task vào log không?**
Đ: Không. Entry chỉ có định danh (`userId`, `projectId`, `taskId`), action, kết quả và lý do. Không ghi token, không ghi tiêu đề hay mô tả task.
