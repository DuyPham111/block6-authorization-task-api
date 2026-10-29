# Phần 2: V2, RBAC theo project

## Mục tiêu

Viewer, Member và Owner có tập quyền khác nhau **trong phạm vi từng project**. Chặn BFLA (gọi chức năng vượt role bằng request trực tiếp). Không tin role do request gửi lên.

## Permission matrix

| Role | Đọc task | Sửa task | Xóa project | Quản lý thành viên |
| --- | :---: | :---: | :---: | :---: |
| Viewer | ✅ | ❌ | ❌ | ❌ |
| Member | ✅ | ✅ (V3 thêm điều kiện) | ❌ | ❌ |
| Owner | ✅ | ✅ | ✅ | ✅ |

```js
// src/policy.js
const ROLE_PERMISSIONS = {
  Viewer: ['task:read'],
  Member: ['task:read', 'task:edit'],
  Owner: ['task:read', 'task:edit', 'project:delete', 'member:manage'],
}
const permissionsOf = role => (Object.hasOwn(ROLE_PERMISSIONS, role) ? ROLE_PERMISSIONS[role] : [])

// trong decide(), sau bước kiểm thành viên:
if (!permissionsOf(membership.role).includes(action)) return deny('role_lacks_permission', { visible: true })
```

## Đã làm gì

- `projectService`: `deleteProject`, `addMember`, `removeMember`, mỗi hàm gọi `enforce` trước khi thao tác.
- `taskService.updateTask`: kiểm quyền trên bản ghi đang lưu, rồi chỉ nhận các field `title`, `description`, `status`.
- `addMember`: role của người được thêm phải nằm trong `ROLES`, user phải tồn tại, không thêm trùng.
- `removeMember`: không gỡ Owner cuối cùng (409).
- Route không còn import `db`.

## Giải thích từng quyết định

1. **Role theo project, không theo hệ thống.** Một người có thể là Owner project này và Viewer project khác. Role toàn cục mà là "Owner" thì sẽ có quyền trên mọi project, tức vertical escalation.
2. **Kiểm theo permission, không kiểm theo tên role.** Code hỏi "role này có `project:delete` không", không viết `if (role === 'Owner')` rải khắp nơi. Thêm role mới chỉ cần sửa bảng.
3. **`Object.hasOwn`.** Nếu dữ liệu có role lạ như `"__proto__"` hay `"constructor"`, `ROLE_PERMISSIONS[role]` có thể lấy nhầm thuộc tính của prototype. `hasOwn` đảm bảo role lạ thì không có quyền nào (deny by default). Unit test U3 kiểm điều này.
4. **Member không quản lý thành viên.** Thêm thành viên là *cấp quyền cho người khác*, một quyền "meta". Nếu Member có quyền này, Member tự thêm mình làm Owner được (test E12).
5. **Whitelist field khi PATCH.** Starter dùng `Object.assign(task, req.body)`, nên client đổi được cả `projectId` và `id` (mass assignment). Whitelist thì field mới mặc định không sửa được.
6. **Validate role khi mời thành viên.** Không cho tạo membership với role `Admin` hay role lạ. Dù role lạ không có quyền gì, nó vẫn là dữ liệu bẩn.
7. **Giữ Owner cuối cùng.** Nếu gỡ hết Owner, project không còn ai quản lý được. Trả 409 Conflict vì đây là xung đột với trạng thái hiện tại, không phải lỗi quyền.
8. **403 cho Member, 404 cho người ngoài.** Member thấy project nên nhận 403 rõ lý do. Owner Beta không thuộc Alpha nên nhận 404 (test E14). Bước ReBAC chạy trước RBAC.

## Kết quả

| | v1 | v2 |
| --- | --- | --- |
| `docs/evidence/v2-before.txt` | 13/21 đỏ | |
| `docs/evidence/v2-after.txt` | | 21/21 xanh |
| Bảng oracle | 7/17 | 12/17 |

Test từ chối trong ma trận **kiểm cả dữ liệu không đổi** (task chưa bị sửa, project chưa bị xóa, thành viên chưa được thêm), không chỉ kiểm mã lỗi.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Quyết định |
| --- | --- | --- | --- |
| ACL cho từng task | Chia sẻ riêng linh hoạt | 20 user × 100 task = 2.000 mục. Thêm task mới phải ghi 20 mục (slide 12) | ❌ |
| **RBAC theo project** | Thêm người = 1 mục, thêm task = 0 mục | Không biểu diễn được điều kiện riêng của từng task | ✅ (V3 bổ sung ABAC) |
| Role toàn cục (một user một role) | Đơn giản | Owner một project thành Owner mọi project | ❌ |
| `if (role === 'Owner')` trong từng service | Viết nhanh | Rải logic quyền khắp nơi, thêm role phải sửa nhiều chỗ | ❌ |
| **Bảng `ROLE_PERMISSIONS` trong PDP** | Một chỗ duy nhất, dễ đối chiếu với ma trận | | ✅ |
| Phân cấp role (Owner kế thừa Member kế thừa Viewer) | Gọn khi có nhiều role | Ẩn đi quyền thực tế. Khó đọc khi bảo vệ | ❌ (liệt kê tường minh) |
| Casbin (`model.conf` + `policy.csv`) | Chuẩn, hỗ trợ RBAC | Thêm dependency và DSL mới cho 3 role × 4 action. Outline không yêu cầu | ❌ (ghi là hướng mở rộng) |
| Blacklist field (`delete body.projectId`) | Ít sửa code | Field mới thêm vào schema mặc định sửa được | ❌ |
| **Whitelist field** | Deny by default cho field | Phải cập nhật khi thêm field hợp lệ | ✅ |

## Câu hỏi vấn đáp

**H: Tại sao Member được sửa task mà không được xóa project?**
Đ: Theo least privilege. Member là người làm việc trên task. Xóa project là thao tác không đảo ngược được, ảnh hưởng mọi người, nên chỉ Owner làm.

**H: Bob gửi `{"role":"Admin"}` thì hệ thống xử lý thế nào?**
Đ: Bỏ qua hoàn toàn. `decide()` lấy role từ `db.findMembership(user.id, project.id)`, không đọc body. Test O10 gửi role qua cả body, header `X-Role` và query `?role=Owner`, kết quả vẫn 403 và project vẫn còn.

**H: Nhưng `POST /members` lại đọc `role` từ body. Có mâu thuẫn không?**
Đ: Không mâu thuẫn. Đó là role của **người được thêm**, là dữ liệu nghiệp vụ, không phải quyền của người gọi. Quyền của người gọi (có `member:manage` không) vẫn lấy từ DB. Giá trị role này được kiểm theo whitelist (test E10), và Member không gọi được API này (E12).

**H: Tại sao kiểm theo permission (`project:delete`) mà không kiểm `role === 'Owner'`?**
Đ: Để tách "role là gì" khỏi "được làm gì". Thêm role "Maintainer" chỉ cần thêm một dòng vào bảng, không phải tìm sửa từng câu `if`. Bảng này cũng đối chiếu một-một với permission matrix trong bài nộp.

**H: Sao không cho Owner kế thừa quyền của Member cho gọn?**
Đ: Với 3 role, liệt kê tường minh dễ đọc hơn: nhìn bảng là thấy ngay Owner có gì. Phân cấp kế thừa đáng dùng khi có nhiều role. Đổi lại, nó làm khó thấy quyền thực tế khi bảo vệ bài.

**H: Mass assignment là gì? Tại sao Owner gửi `projectId` cũng không được?**
Đ: Mass assignment là gán thẳng body vào bản ghi, nên client đổi được field không được phép. Nếu Owner Alpha đổi `projectId` của A1 thành `beta`, A1 sẽ "nhảy" sang Beta, tức là ghi dữ liệu vào project mình không có quyền. Test E9 kiểm `projectId` và `id` bị bỏ qua.

**H: Tại sao kiểm quyền trước, validate dữ liệu sau?**
Đ: Nếu validate trước, người không có quyền gửi dữ liệu sai vẫn nhận 400. Họ phân biệt được "task tồn tại, dữ liệu sai" với "không tồn tại", tức là lộ thông tin. Kiểm quyền trước thì người ngoài luôn nhận 404.

**H: Owner gỡ Bob xong, Bob còn đọc được bao lâu?**
Đ: 0 giây. Mỗi request đọc membership từ DB, không có cache và không có role trong token. Test E5 gỡ Bob rồi gọi lại ngay thì nhận 404.

**H: Tại sao chặn gỡ Owner cuối cùng? Đây có phải authorization không?**
Đ: Đây là một invariant nghiệp vụ đi kèm phân quyền. Project không có Owner thì không ai quản lý thành viên hay xóa project được nữa. Em dùng 409 vì đó là xung đột trạng thái, người gọi vẫn có quyền.

**H: Viewer có thể đọc danh sách thành viên không?**
Đ: Bài không yêu cầu API này nên em chưa làm. Nếu thêm, em sẽ thêm action `member:read` vào bảng (Viewer có quyền) và viết test theo ma trận.

**H: 12 ô ma trận có test hết không?**
Đ: Có, dùng `test.each` trên 12 dòng (M1–M7 và O5–O9). Mỗi dòng gọi API thật bằng user mang role đó.

## Câu hỏi bẫy

**H: Nếu trong DB có membership role `"Admin"` do lỗi dữ liệu, user đó có quyền gì?**
Đ: Không có quyền gì. `permissionsOf('Admin')` trả về mảng rỗng, nên mọi action bị từ chối. Unit test U3 kiểm cả `Admin`, `__proto__`, `constructor`, `toString`.

**H: Action mới `project:export` chưa khai báo thì Owner có được gọi không?**
Đ: Không. Chưa khai báo nghĩa là không có trong bảng, nên bị từ chối (deny by default, slide 6). Unit test U4 kiểm điều này.
