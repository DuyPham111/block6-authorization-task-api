# Phần 1: V1, sửa IDOR/BOLA

## Mục tiêu

Alice (Owner Alpha) đọc được A1 nhưng **không** đọc được B1 (project Beta), dù token hợp lệ.

## Lỗi ban đầu

```js
// starter: chỉ kiểm token và scope
router.get('/:id', requireScope('tasks:read'), (req, res) => {
  const task = db.findTask(req.params.id)
  if (!task) throw notFound()
  res.json(task)            // không hỏi: Alice có liên quan tới task này không?
})
```

Đủ ba điều kiện gây IDOR/BOLA (slide 7): client gửi object ID, token hợp lệ nên qua được xác thực, và server không kiểm quan hệ giữa người gọi với object.

Evidence (`docs/evidence/v1-idor-curl-before.txt`):

```
GET /tasks/B1  Bearer <token Alice>
HTTP/1.1 200 OK
{"id":"B1","projectId":"beta","title":"Kế hoạch ra mắt Beta","description":"Dữ liệu nội bộ của project Beta",...}
```

## Đã sửa thế nào

```js
// src/services/access.js: nạp resource TỪ DB, project suy ra từ task đang lưu
function loadTask(taskId) {
  const task = db.findTask(taskId)
  if (!task) throw notFound()
  return { task, project: db.findProject(task.projectId) }
}
function enforce(user, action, resource) {
  const decision = decide(user, action, resource)
  if (!decision.allow) throw decision.visible ? forbidden() : notFound()
}

// src/services/taskService.js
function getTask(user, taskId) {
  const resource = loadTask(taskId)
  enforce(user, 'task:read', resource)
  return resource.task
}

// src/policy.js (V1)
const membership = db.findMembership(user.id, project.id)
if (!membership) return deny('not_member', { visible: false })
```

Route chỉ còn một dòng: `res.json(taskService.getTask(req.user, req.params.id))`.
`GET /projects/:id/tasks` cũng đi qua cùng `enforce`, nên không có "đường vòng".

## Giải thích từng quyết định

1. **Kiểm quan hệ thành viên project (ReBAC).** Đề nói người trong project đọc được task của project. Quyền đọc suy ra từ quan hệ user → project ← task.
2. **Nạp task trước, suy ra project từ DB.** URL `/tasks/B1` không chứa projectId. Nếu lấy projectId từ query hay body thì đó là dữ liệu client tự khai.
3. **Đặt trong service chứ không ở route.** Có hai entry point đọc task ngay từ V1 (`/tasks/:id`, `/projects/:id/tasks`). Đặt chung ở service thì không route nào quên được.
4. **404 cho người ngoài project.** Che sự tồn tại. Body giống hệt "task không tồn tại", nên không dò được ID nào có thật.
5. **PDP trả về `visible`.** Policy quyết định người gọi có được *biết* resource tồn tại không. Service chỉ việc map `visible` sang 403 hoặc 404.

## Kết quả

| | Starter | V1 |
| --- | --- | --- |
| `docs/evidence/v1-before.txt` | 5 test đỏ: O3, E2, E4, E6, E7 | |
| `docs/evidence/v1-after.txt` | | 11/11 xanh |
| Bảng oracle | 6/17 | 7/17 |

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Quyết định |
| --- | --- | --- | --- |
| Kiểm trong từng controller: `if (!canRead(...))` | Dễ viết | Route mới hoặc export quên kiểm là lọt (slide 17, 18) | ❌ |
| Middleware `checkProjectAccess(req.params.projectId)` | Gọn | `/tasks/:id` không có projectId. Middleware chạy trước khi nạp resource. Lấy ID từ request là tin client | ❌ |
| **Service nạp resource → gọi PDP chung** | Mọi entry point cùng một điểm kiểm. PDP test riêng được | Mỗi service phải nhớ gọi `enforce` (đã grep kiểm) | ✅ |
| Lọc trong câu truy vấn `WHERE id = :id AND project_id IN (...)` | Một truy vấn, không có timing side channel | Logic quyền rải trong SQL, khó tái sử dụng cho PATCH/DELETE | Dùng cho **list** (phần 5), không dùng cho check |
| Dùng UUID thay ID tuần tự | Khó đoán ID | Không phải kiểm quyền. ID vẫn lộ qua log, email, link chia sẻ (slide 7) | ❌ (không thay được) |
| Trả 403 cho Alice đọc B1 | Client hiểu rõ lý do | Lộ sự tồn tại của B1, dò được ID | ❌ cho người ngoài project |
| **Trả 404, body giống "không tồn tại"** | Không dò được | Client hợp lệ khó debug hơn | ✅ (người cùng project nhận 403) |

## Câu hỏi vấn đáp

**H: IDOR và BOLA khác nhau thế nào?**
Đ: Cùng một lỗi, khác tên gọi theo bộ tài liệu. IDOR (Insecure Direct Object Reference) là tên trong OWASP Top 10 bản 2013, nay thuộc nhóm A01:2021 Broken Access Control. BOLA (Broken Object Level Authorization) là tên trong OWASP API Security Top 10, mục API1:2023.

**H: Tại sao em kiểm "thành viên project" mà không kiểm "người tạo task"?**
Đ: Đề không có khái niệm người tạo. Quyền đọc trong đề là "thành viên của project chứa task". Ownership chỉ là một dạng quan hệ. Nếu đề có thì em thêm điều kiện vào `decide()`.

**H: Sao không viết middleware kiểm quyền cho gọn?**
Đ: Middleware chạy trước khi biết task thuộc project nào. Với `/tasks/:id`, muốn biết project phải nạp task từ DB. Nếu middleware lấy projectId từ request thì đó là dữ liệu client khai. Kẻ tấn công gửi `projectId=alpha` kèm `taskId=B1` là qua. Em nạp task trước rồi lấy `task.projectId` từ DB.

**H: Sao lại trả 404? Thầy thấy 403 đúng nghĩa hơn.**
Đ: 403 nghĩa là "có resource này nhưng anh không được xem", tức là đã xác nhận B1 tồn tại. Kẻ tấn công thử lần lượt ID và phân biệt 403 với 404 là biết ID nào có thật. Slide 5 gọi đây là "che sự tồn tại". Em áp dụng có điều kiện: người *cùng project* (đã thấy task) thiếu quyền thì vẫn nhận 403 để biết lý do. Test E2 kiểm body của hai trường hợp 404 giống hệt nhau.

**H: Em nạp task trước rồi mới kiểm quyền. Thời gian trả lời có khác nhau giữa "không tồn tại" và "bị che" không?**
Đ: Có chênh rất nhỏ (thêm một lần tra membership). Đây là timing side channel. Trong phạm vi lab em chấp nhận. Nếu cần chặt hơn, đưa điều kiện quyền vào chính câu truy vấn (`WHERE id = :id AND project_id IN (:readable)`) để hai trường hợp chạy cùng một đường.

**H: Dùng UUID thì có cần kiểm quyền không?**
Đ: Vẫn cần. UUID chỉ làm việc đoán ID khó hơn. ID vẫn lộ qua URL được chia sẻ, log, email thông báo, hoặc response của API khác. Bảo mật không được dựa vào việc giữ bí mật một định danh.

**H: Ẩn task B1 khỏi giao diện của Alice có đủ không?**
Đ: Không. Giao diện chạy ở client. Alice gọi thẳng bằng curl (`scripts/demo-idor.sh`) là bỏ qua giao diện. Server phải tự kiểm.

**H: Sao danh sách `/projects/:id/tasks` chỉ kiểm một lần mà không kiểm từng task?**
Đ: Mọi task trong cùng project có cùng quyền đọc. Kiểm một lần trên project là đủ, tránh N+1 truy vấn quyền (slide 18).

**H: Ở V1 em đã sửa PATCH chưa?**
Đ: Chưa. Em sửa theo từng phiên bản, mỗi phiên bản giải quyết một vấn đề và có evidence riêng. V1 chỉ sửa đường đọc. Bảng oracle cho thấy O14 (Bob sửa B1) vẫn trượt ở v1 và chỉ xanh từ v2. Đây là điều em chủ động để thấy rõ tác dụng của từng bước.

**H: Test E6 để làm gì?**
Đ: Thử Bob tự khai `userId=charlie` qua cả query, header `X-User-Id` và body. Server lấy danh tính từ token nên vẫn 404. Test này bảo vệ trước việc ai đó sau này sửa code thành `req.query.userId || req.user.id`.

**H: Test có kiểm body không bị lộ không, hay chỉ kiểm mã lỗi?**
Đ: Có. Helper `expectDenied` kiểm mã, kiểm body không phải mảng, và không có `title` hay `description`. Yêu cầu của đề là "403 hoặc 404, **không lộ nội dung**".

## Câu hỏi bẫy

**H: Nếu `decide()` ném lỗi vì `project` undefined (task trỏ tới project đã bị xóa) thì sao?**
Đ: `deleteProject` xóa luôn task và thành viên của project nên bình thường không có task mồ côi. Nếu dữ liệu vẫn lỗi, `loadTask` không tìm thấy project thì trả 404 ngay, không gọi `decide()`. Trong `decide()`, Member sửa mà thiếu dữ liệu task cũng bị từ chối (`missing_task`, test U5). Hệ thống *fail closed*: thiếu dữ liệu thì từ chối chứ không cho qua.

**H: Ở bản cuối, Alice đọc B1 bị chặn ở bước nào?**
Đ: Ở bước 1, tenant boundary (`other_tenant`), vì Beta thuộc tenant khác. Ở V1–V3 chưa có tenant nên bước ReBAC (`not_member`) chặn. Hai lớp cùng chặn là phòng thủ nhiều lớp. Audit log ghi đúng lý do của từng trường hợp (test L1), còn client nhận cùng một body 404.
