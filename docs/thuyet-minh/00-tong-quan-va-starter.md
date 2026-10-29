# Phần 0: Tổng quan và starter

## Mục tiêu

- Có một API **đã xác thực** nhưng **chưa kiểm quyền**, giống starter của bài: `GET /tasks/:id` chỉ kiểm token.
- Có dữ liệu mẫu đủ để viết 17 test oracle.
- Có cách tạo evidence "đỏ trước khi sửa, xanh sau khi sửa" cho từng phiên bản.

## Đã làm gì

| File | Vai trò |
| --- | --- |
| `src/auth.js` | Xác thực JWT (HS256), nạp `req.user` từ DB theo `sub`, kiểm scope (`requireScope`) |
| `src/db.js` | Dữ liệu in-memory, `resetDb()` cho mỗi test |
| `src/errors.js` | `HttpError`: 404 dùng chung một body |
| `src/routes/*.js` | Ở starter: route gọi thẳng `db`, không kiểm quyền (lỗi có chủ đích) |
| `scripts/token.js` | In token để demo bằng curl |
| `scripts/test-against.sh` | Chạy bộ test hiện tại trên `src/` của một tag cũ, để thấy test đỏ |
| `scripts/oracle-matrix.js` | Lập bảng test oracle qua/trượt theo từng tag |

## Ba lớp kiểm tra của một request

```
Authorization: Bearer <JWT{sub, scope}>
        │
        ▼
1. Authentication  (auth.js)      Người gọi là ai?               sai/thiếu/hết hạn → 401
2. OAuth2 scope    (requireScope)  Token được cấp loại quyền gì?  thiếu scope → 403 insufficient_scope
3. Authorization   (service+policy) Người này làm được action này
                                   trên resource này không?     → 403 / 404
```

Starter có lớp 1 và lớp 2, **thiếu lớp 3**. Đó chính là lỗi IDOR/BOLA của bài.

## Giải thích thiết kế

### Token chỉ chứa `sub` và `scope`

```js
jwt.sign({ sub, scope }, SECRET, { algorithm: 'HS256', expiresIn: '15m' })
```

- `sub` cho biết danh tính. Middleware đọc user từ DB theo `sub` mỗi request.
- `scope` là quyền cấp cho token (lớp OAuth2), không liên quan tới từng resource.
- **Không** để `role` hay `tenantId` trong token, vì hai lý do. Role phụ thuộc vào từng project (Alice là Owner Alpha nhưng có thể là Viewer project khác). Và quyền có thể bị thu hồi bất cứ lúc nào.
- `jwt.verify(..., { algorithms: ['HS256'] })` ghim thuật toán để chặn tấn công đổi `alg` (ví dụ `none`).

### Dữ liệu mẫu

| User | Lý do có mặt |
| --- | --- |
| alice, bob, charlie | Có sẵn trong đề bài |
| vera (Viewer Alpha) | Đề có role Viewer, cần người thật để test "Viewer sửa A1" |
| erin (cùng tenant, chưa thuộc project nào) | Cần một người hợp lệ để test "thêm thành viên" |
| dana (Admin tenant Alpha) | Cho V4, chỉ thêm từ tag `v4-pre` |

### Evidence đỏ/xanh

Mỗi phiên bản là một git tag: `starter → v1 → v2 → v3 → v4-pre → v4 → final`.
`scripts/test-against.sh <tag>` lấy `src/` của tag cũ, ghép với test mới rồi chạy. Kết quả là cùng một test **đỏ trên code cũ, xanh trên code mới**, đúng yêu cầu "regression test phải tái hiện lỗi trước khi sửa".

## Phương án đã cân nhắc

| Quyết định | Phương án khác | Vì sao không chọn |
| --- | --- | --- |
| **Node.js + Express** | NestJS (có Guard và decorator sẵn) | Guard che mất cơ chế. Thầy hỏi "kiểm quyền ở đâu" thì khó chỉ ra từng bước. Express cho thấy rõ PEP/PDP. Slide cũng dùng Express |
| | Spring Security | Nặng, cấu hình nhiều, lệch trọng tâm bài |
| **In-memory + `resetDb()`** | PostgreSQL/SQLite | Bài tập trung vào authorization. Thêm DB tốn thời gian cài đặt và làm test chậm. Đánh đổi: chưa đo hiệu năng JOIN (đã ghi ở phần giới hạn) |
| **Jest + Supertest** | Postman / curl thủ công | Không lặp lại được, không chạy được bằng một lệnh. Bài yêu cầu automated tests |
| **Token: `sub` + `scope`** | Token chứa `role`, `tenantId` | Role cũ còn hiệu lực tới khi token hết hạn. Token phình ra khi user thuộc nhiều project |
| | Opaque token + introspection | Đề cho sẵn JWT, không xây lại OAuth2 |
| **HS256** | RS256 + JWKS | Đủ cho một service. Production có nhiều service cùng verify thì nên dùng RS256 để không phải chia sẻ secret |
| **Git tag từng phiên bản** | Một commit cuối | Bài nộp cần code diff và evidence trước/sau. Tag giúp `git diff v1 v2` và chạy test trên code cũ |
| **Starter có cả PATCH/DELETE/members chưa kiểm quyền** | Starter chỉ có GET | Đề nói "có thể mở rộng API với PATCH, DELETE và quản lý thành viên". Có sẵn route lỗi thì test V2/V3 mới đỏ thật |

## Câu hỏi vấn đáp

**H: Tại sao em dựng starter có lỗi rồi mới sửa, sao không viết đúng ngay?**
Đ: Bài yêu cầu tái hiện lỗi trước khi sửa. Một regression test chỉ có giá trị khi đã thấy nó **đỏ** trên code lỗi. Nếu viết đúng ngay, em không chứng minh được test thực sự bắt được lỗi. Có thể test đó luôn xanh dù code sai.

**H: Tại sao chọn Express mà không chọn NestJS có sẵn Guard?**
Đ: Guard của NestJS chạy *trước* controller, lúc đó chưa nạp resource. Muốn kiểm quyền trên object vẫn phải viết trong service. Express giúp em cho thấy rõ từng lớp: middleware xác thực → scope → service (PEP) → policy (PDP). Slide của thầy cũng dùng Express.

**H: Sao không dùng database thật?**
Đ: Trọng tâm là logic phân quyền. Dữ liệu in-memory có `resetDb()` giúp mỗi test độc lập và cả bộ 70 test chạy khoảng 2 giây. Service và policy không phụ thuộc vào cách lưu trữ, thay bằng SQL chỉ cần sửa `db.js`. Đánh đổi là chưa đo được hiệu năng truy vấn danh sách. Em đã ghi điều này ở phần giới hạn.

**H: Tại sao token không chứa role? Mỗi request đọc DB có chậm không?**
Đ: Role nằm theo project, mỗi user có thể có nhiều role khác nhau, và quyền có thể bị thu hồi bất cứ lúc nào. Slide 20 cho thấy nếu role nằm trong JWT 15 phút, người bị gỡ vẫn truy cập được tới 15 phút. Đọc membership mỗi request chỉ là một truy vấn có index `(user_id, project_id)`. Nếu cần nhanh hơn thì cache với TTL ngắn và xóa cache khi đổi quyền.

**H: Có scope rồi thì cần gì kiểm quyền nữa? Có kiểm quyền rồi thì cần gì scope?**
Đ: Hai lớp trả lời hai câu hỏi khác nhau.
- Scope giới hạn *token* (least privilege). Nếu token của một client báo cáo bị lộ, kẻ tấn công chỉ đọc được, không sửa hay xóa được.
- Authorization giới hạn *người dùng trên từng resource*.
- Test E7: token chỉ có `tasks:read` đọc được A1 nhưng không đọc được B1. Test E8: Alice là Owner nhưng token thiếu scope thì vẫn bị 403.

**H: Thiếu scope sao trả 403 mà không trả 401?**
Đ: Theo RFC 6750, token hợp lệ nhưng thiếu scope là `insufficient_scope` với mã 403. Lỗi 401 dành cho trường hợp chưa xác thực được người gọi (thiếu token, sai chữ ký, hết hạn).

**H: `sub` trỏ tới user không tồn tại thì sao?**
Đ: Trả 401 `invalid_token`. Danh tính không hợp lệ thì coi như chưa xác thực. Trường hợp này xảy ra khi user đã bị xóa nhưng token vẫn còn hạn.

**H: Tại sao `algorithms: ['HS256']` khi verify?**
Đ: Để server không tin trường `alg` trong header của token. Nếu không ghim, kẻ tấn công có thể gửi `alg: none` hoặc đổi thuật toán.

**H: Vera và Erin ở đâu ra, đề không có?**
Đ: Đề có role Viewer và chức năng quản lý thành viên. Muốn test "Viewer sửa A1" thì cần một Viewer thật, muốn test "Owner thêm thành viên" thì cần một người chưa thuộc project. Em thêm hai user này và ghi rõ trong README.

**H: Làm sao em chạy test mới trên code cũ?**
Đ: `scripts/test-against.sh` dùng `git archive <tag> src` để lấy mã nguồn cũ ra thư mục tạm, chép bộ test hiện tại vào rồi chạy Jest. Nó không động vào working tree. `oracle-matrix.js` làm tương tự cho mọi tag, bằng `git worktree`.

## Câu hỏi bẫy

**H: Starter đã kiểm token rồi, vậy là an toàn chứ?**
Đ: Không. Kiểm token chỉ trả lời "ai đang gọi". IDOR xảy ra chính khi token *hợp lệ*. Alice đăng nhập đúng nhưng đổi ID thành B1 là đọc được dữ liệu Beta (`docs/evidence/v1-idor-curl-before.txt`).
