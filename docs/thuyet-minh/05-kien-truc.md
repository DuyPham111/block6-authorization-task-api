# Phần 5: Kiến trúc kiểm quyền (PEP, PDP, check và list)

## Sơ đồ

```
HTTP request
   │
   ▼
authenticate (auth.js)  ── 401 ──▶  (thiếu, sai, hết hạn token)
   │ req.user = db.findUser(sub)
   ▼
requireScope            ── 403 insufficient_scope
   │
   ▼
route (routes/*.js)     chỉ chuyển request vào service, không import db
   │
   ▼
service = PEP           loadTask / loadProject (từ DB)  ──▶  enforce(user, action, resource)
(taskService,                                                     │
 projectService)                                                  ▼
   │                                              policy.decide = PDP (hàm thuần)
   │                                              tenant → Admin → member → role → assignee/status
   │                                                              │
   │◀──────────── { allow, visible, reason } ────────────────────┘
   │   deny + visible=false → 404     deny + visible=true → 403
   ▼
db.* (chỉ chạy khi đã được phép)
```

## PEP và PDP trong code

| Khái niệm (slide 15) | Trong bài | Nhiệm vụ |
| --- | --- | --- |
| **PEP**: Policy Enforcement Point | `src/services/taskService.js`, `projectService.js`, helper `enforce` trong `access.js` | Chặn thao tác: nạp resource, hỏi PDP, ném 403/404, chỉ thao tác khi được phép |
| **PDP**: Policy Decision Point | `src/policy.js` → `decide()` | Trả lời `allow(subject, action, resource)`. Không biết HTTP, không ghi dữ liệu |
| Dữ liệu chính sách (PIP) | `db.findMembership`, `user.tenantId`, `task.assignee`, `task.status` | Luôn đọc từ server, không đọc từ request |

## Giải thích từng quyết định

1. **Một PDP duy nhất.** Mọi quyết định đi qua `decide()`. Chính sách thay đổi thì chỉ sửa một chỗ, không có hai API áp hai luật khác nhau (slide 18, vấn đề 1).
2. **PDP là hàm thuần.** Unit test được từng nhánh mà không cần HTTP (`test/policy.unit.test.js`, 100% nhánh). Sau này muốn thay bằng OPA hay OpenFGA thì chỉ thay phần bên trong `decide()`, route và service giữ nguyên.
3. **PEP ở business layer, không ở controller.** Cùng một dữ liệu có nhiều đường vào: `/tasks/:id`, `/tasks`, `/projects/:id/tasks`, và sau này có thể là export CSV hay job nhắc việc (slide 17). Đặt kiểm quyền ở service thì đường nào cũng phải đi qua.
4. **Route không import `db`.** Muốn chạm dữ liệu phải qua service. Grep `require('../db')` trong `src/routes` cho kết quả rỗng.
5. **`reason` trong quyết định.** Dùng để test (unit test kiểm đúng lý do) và để ghi log audit sau này. Lý do không trả về client, vì như vậy sẽ lộ chi tiết chính sách.

## Check và list

| | Check: `GET /tasks/:id` | List: `GET /tasks` |
| --- | --- | --- |
| Câu hỏi | Được đọc task **này** không? | Được đọc **những** task nào? |
| Cách làm | Nạp task → `decide()` | `readableProjectIds(user)` → `listTasksInProjects(ids)` |
| Số truy vấn quyền | 1 | 1 (không phải N+1) |
| SQL tương đương | `SELECT * FROM project_members WHERE user_id = ? AND project_id = ?` | `SELECT t.* FROM tasks t JOIN projects p ... LEFT JOIN project_members m ... WHERE p.tenant_id = :tenant AND (:isAdmin OR m.user_id IS NOT NULL)` |

**Rủi ro**: hai đường biểu diễn cùng một luật bằng hai cách, nên có thể lệch nhau. **Cách kiểm soát**: `test/consistency.test.js` (C1) chạy với mọi user × mọi task. Task xuất hiện trong list phải đúng bằng các task mà check trả về 200.

## Cache và thu hồi quyền

Hiện tại **không cache**: mỗi request đọc membership. Thu hồi có hiệu lực ngay (E5, C3).

| Cách | Thời gian còn truy cập sau khi bị gỡ (slide 20) | Số lần đọc DB |
| --- | --- | --- |
| **Đọc DB mỗi request** (bài này) | 0 | Nhiều nhất |
| Cache 1 phút | Tối đa 1 phút | Giảm |
| Cache 5 phút | Tối đa 5 phút | Giảm nhiều |
| Role trong JWT 15 phút | Tối đa 15 phút | Ít nhất |

Nếu cần cache: key là `(userId, projectId)`, TTL ngắn, và **xóa cache khi gỡ thành viên hay đổi role** (slide 19).

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Quyết định |
| --- | --- | --- | --- |
| Kiểm quyền trong từng controller | Dễ hiểu | Quên một route là lọt. Logic trùng lặp | ❌ |
| Express middleware chung | Một chỗ | Chạy trước khi nạp resource nên không biết project của task | ❌ |
| **Service (PEP) + `decide()` (PDP)** | Một điểm kiểm cho mọi entry point. PDP test riêng được | Service phải gọi `enforce` (đã grep kiểm) | ✅ |
| Decorator/annotation (`@Authorize('task:edit')`) | Khai báo gọn | Cần framework. Vẫn phải nạp resource để xét ABAC | ❌ trong Express |
| OPA (Rego) làm PDP | Policy-as-code, tách hẳn khỏi app | Thêm service và ngôn ngữ mới cho 4 action | ❌ (hướng mở rộng) |
| Casbin | Thư viện, mô hình RBAC/ABAC có sẵn | DSL riêng, quá sức với quy mô bài | ❌ |
| OpenFGA (ReBAC kiểu Zanzibar) | Rất mạnh cho chia sẻ qua nhóm, thư mục, hàng triệu object | Thêm hạ tầng, đồng bộ quan hệ | ❌ trong lab, ✅ nếu quy mô lớn |
| List: tải hết rồi lọc bằng `decide()` | Dùng lại đúng một luật | N+1, chậm khi có nhiều task | ❌ |
| **List: điều kiện trong truy vấn + test nhất quán** | 1 truy vấn | Hai biểu diễn của một luật | ✅ (C1 khóa sự nhất quán) |

## Câu hỏi vấn đáp

**H: PEP và PDP trong bài em nằm ở đâu?**
Đ: PDP là `decide()` trong `src/policy.js`. PEP là các service: `taskService` và `projectService` gọi `enforce()` trước mọi thao tác. Route chỉ chuyển request vào service.

**H: Sao không đặt kiểm quyền ở controller cho dễ thấy?**
Đ: Vì cùng một task có ít nhất ba đường đọc: `/tasks/:id`, `/tasks`, `/projects/:id/tasks`. Slide 17 cho thấy kiểm ở controller thì route nào thiếu là lọt. Ở service, đường nào cũng phải đi qua `enforce`.

**H: Service ném `HttpError` (404/403), vậy service có phụ thuộc HTTP không?**
Đ: Có, một chút. Em chọn vậy cho gọn trong phạm vi lab. Nếu tách chặt hơn thì service ném lỗi miền (`NotVisible`, `Forbidden`), và lớp ngoài map sang mã HTTP. Khi đó một job chạy nền gọi service cũng hiểu được lỗi. Thay đổi này không ảnh hưởng tới policy.

**H: `GET /tasks` và `GET /tasks/:id` dùng hai cách kiểm khác nhau. Làm sao em chắc chúng không lệch?**
Đ: Test C1 chạy với cả 6 user × 4 task: gọi list một lần, gọi check từng task một, rồi so hai tập kết quả phải bằng nhau. Ai sửa luật ở `decide()` mà quên sửa `readableProjectIds()` thì C1 đỏ.

**H: Với hàng triệu tài liệu chia sẻ qua nhiều nhóm thì kiến trúc này còn dùng được không?**
Đ: Khung PEP/PDP vẫn giữ nguyên. Chỉ phần bên trong PDP phải đổi:
- Lưu quan hệ như dữ liệu (user → nhóm → thư mục → tài liệu), đúng như slide 19.
- Dùng hệ thống ReBAC như OpenFGA hoặc Zanzibar, có API `check` cho một object và `list objects` cho danh sách.
- Cache có TTL kèm cơ chế thu hồi.
- Dùng chung một bộ test cho mọi API.

**H: OPA, Casbin và OpenFGA khác nhau thế nào?**
Đ:
- **OPA** là PDP đa năng, viết chính sách bằng ngôn ngữ Rego, chạy như service riêng hoặc sidecar.
- **Casbin** là thư viện nhúng vào app, mô tả mô hình ACL/RBAC/ABAC bằng file cấu hình.
- **OpenFGA** là hệ thống ReBAC theo mô hình Zanzibar của Google, lưu quan hệ dạng tuple và trả lời check hay list rất nhanh ở quy mô lớn.

Bài này dùng hàm thuần vì outline không yêu cầu cài các hệ thống trên.

**H: Tại sao không cache quyền cho nhanh?**
Đ: Quy mô bài nhỏ, và em ưu tiên thu hồi có hiệu lực ngay. Cache luôn là đánh đổi giữa độ trễ thu hồi và số truy vấn (slide 20). Nếu cần, em cache theo `(user, project)`, TTL khoảng 1 phút, và xóa cache khi gỡ thành viên.

**H: Thêm một endpoint export CSV thì phải làm gì để không lọt?**
Đ: Endpoint đó gọi `taskService.listVisibleTasks(user)`, không truy vấn DB trực tiếp. Sau đó thêm export vào test nhất quán C1. Quy ước "route không import db" giúp phát hiện khi ai đó viết tắt.

## Câu hỏi bẫy

**H: PDP trả `visible`. Như vậy PDP có đang làm việc của HTTP không?**
Đ: Không. `visible` là quyết định chính sách: "người gọi có được biết resource tồn tại không". Việc map sang 404 hay 403 là do PEP làm. Một client gRPC hay CLI có thể map `visible` theo cách riêng của nó.
