# Phần 3: V3, kết hợp ReBAC + RBAC + ABAC

## Mục tiêu

Member chỉ sửa được task **được giao cho mình** và **còn Open**. Quyết định phải xét đồng thời: quan hệ thành viên project, assignee, và trạng thái task.

## Code

```js
// src/policy.js
function decide(user, action, { project, task }) {
  const membership = db.findMembership(user.id, project.id)                 // ReBAC
  if (!membership) return deny('not_member', { visible: false })

  if (!permissionsOf(membership.role).includes(action))                     // RBAC
    return deny('role_lacks_permission', { visible: true })

  if (action === 'task:edit' && membership.role === 'Member') {             // ABAC
    if (task.assignee !== user.id) return deny('not_assignee', { visible: true })
    if (task.status !== 'Open') return deny('task_closed', { visible: true })
  }
  return allow(`role:${membership.role}`)
}
```

Thay đổi so với V2 nằm trong một file, thêm 7 dòng và bỏ 1 dòng (`docs/evidence/diff-v2-v3.diff`). Kiến trúc PDP tách riêng nên thêm điều kiện mới không phải sửa route hay service.

## Mỗi lớp trả lời một câu hỏi

| Lớp | Câu hỏi | Dữ liệu | Thiếu lớp này thì |
| --- | --- | --- | --- |
| ReBAC | Người gọi có quan hệ với project chứa task không? | Bảng `members`, `task.projectId` | Bob sửa được B1 của Beta (O14) |
| RBAC | Role này có được *loại* thao tác này không? | `membership.role` | Viewer sửa được task (O5) |
| ABAC | Với *task cụ thể này*, điều kiện có thỏa không? | `task.assignee`, `task.status` | Bob sửa A2 không được giao (O12), sửa task đã đóng (O13) |

Hai test chứng minh **không lớp nào thay được lớp khác**:

- **E20**: Vera (Viewer) được giao A2 nhưng vẫn không sửa được. Assignee không thay được role.
- **E21**: Bob vẫn là assignee của A1 nhưng đã bị gỡ khỏi project, nên không sửa được. Assignee không thay được quan hệ thành viên.

## Giải thích từng quyết định

1. **Kiểm trên bản ghi đang lưu, trước khi áp dụng body.** `updateTask` gọi `enforce` với `task` lấy từ DB, sau đó mới `pick` field từ body. Nếu kiểm *sau* khi merge:
   - Bob gửi `{assignee: "bob"}` để tự gán A2 cho mình rồi sửa (test E3).
   - Bob gửi `{status: "Open"}` để tự mở lại task đã đóng (test E16).
2. **Thứ tự ReBAC → RBAC → ABAC.** Bước đầu xác định người gọi có được *thấy* resource không (404 hay 403). ABAC cần dữ liệu của task cụ thể nên đặt cuối, và chỉ chạy khi cần.
3. **Điều kiện assignee/status chỉ áp cho Member.** Owner quản lý project, cần sửa mọi task và mở lại task đã đóng (E17, E18). Đây là quyết định thiết kế đã ghi trong bảng chính sách.
4. **Member đóng task được nhưng không mở lại được.** Đây là hệ quả của quy tắc "chỉ sửa khi Open" xét trên trạng thái đang lưu. Mở lại task đã đóng là việc của Owner. Nếu muốn khác, cần thêm quy tắc chuyển trạng thái riêng.
5. **Không cho đổi `assignee` qua PATCH.** Giao việc là quyền quản lý. Hiện chưa có action `task:assign` nên field này nằm ngoài whitelist.

## Kết quả

| | v2 | v3 |
| --- | --- | --- |
| `docs/evidence/v3-before.txt` | 4/10 đỏ (O12, O13, E3, E16) | |
| `docs/evidence/v3-after.txt` | | 10/10 xanh |
| Bảng oracle | 12/17 | 14/17 |

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Quyết định |
| --- | --- | --- | --- |
| Thêm role "Assignee" | Chỉ dùng RBAC | Role gắn với *task* chứ không với project. Mỗi lần giao việc phải đổi role. Không biểu diễn được "còn Open" | ❌ |
| ACL: thêm dòng "bob edit A1" khi giao việc | Rõ ràng | Phải đồng bộ ACL mỗi khi assignee hoặc status đổi. Dễ lệch dữ liệu | ❌ |
| **ABAC trên thuộc tính đang lưu** | Thuộc tính đổi thì quyền đổi theo, không phải đồng bộ | Cần nạp task trước khi quyết định | ✅ |
| Kiểm điều kiện sau khi merge body | Một lần kiểm cho mọi field | Client tự đổi điều kiện để qua (E3, E16) | ❌ |
| Điều kiện ABAC áp cho cả Owner | Nhất quán | Owner không giao lại hay mở lại task được, trái vai trò quản lý | ❌ |
| Viết rule dạng dữ liệu (JSON policy) | Linh hoạt | Với 2 điều kiện, code thuần dễ đọc và dễ test hơn | ❌ |

## Câu hỏi vấn đáp

**H: Tại sao không chỉ dùng RBAC?**
Đ: RBAC trả lời "Member có quyền sửa task không", câu trả lời là có, cho mọi task. Nó không phân biệt A1 (giao cho Bob) với A2 (chưa giao). Slide 11 gọi đây là đánh đổi của RBAC: không biểu diễn được điều kiện riêng của từng task.

**H: Có ABAC rồi thì cần ReBAC làm gì? Cứ kiểm `assignee === user` là đủ?**
Đ: Không đủ. Test E21: Bob bị gỡ khỏi Alpha nhưng A1 vẫn ghi assignee là bob. Nếu chỉ kiểm assignee, Bob vẫn sửa được. Quan hệ thành viên là điều kiện cần. Assignee chỉ thu hẹp thêm trong phạm vi project.

**H: Có ABAC rồi thì cần RBAC làm gì?**
Đ: Test E20: Vera là Viewer, được giao A2. Nếu chỉ kiểm assignee thì Viewer sửa được. Role quyết định *loại* thao tác được phép. Assignee không nâng được quyền.

**H: Tại sao em kiểm quyền trước khi áp dụng body?**
Đ: Điều kiện ABAC phải dựa trên trạng thái mà server đang giữ. Nếu áp dụng body trước, client tự đặt `assignee=bob` hoặc `status=Open` để vượt điều kiện. Slide 11 nói rõ: assignee và status phải do server giữ, không lấy từ request.

**H: Sao Bob sửa A2 nhận 403 mà không nhận 404?**
Đ: Bob là thành viên Alpha và *đọc được* A2. Giấu A2 bằng 404 không còn ý nghĩa, mà còn làm Bob khó hiểu. 403 cho biết đúng lý do: không được sửa.

**H: Owner có bị ràng buộc assignee không? Vì sao?**
Đ: Không. Owner chịu trách nhiệm cả project nên cần sửa và mở lại mọi task. Điều kiện này em ghi trong bảng chính sách, có test E17 và E18. Nếu yêu cầu thay đổi, chỉ cần sửa một nhánh trong `decide()` và cập nhật test.

**H: Bob đóng task xong có mở lại được không? Có phải lỗi không?**
Đ: Không mở lại được, và đây là chủ đích. Quy tắc là Member chỉ sửa task còn Open, xét trên trạng thái đang lưu. Task đã đóng thì Bob không sửa gì được nữa, kể cả mở lại. Test E16 khẳng định hành vi này.

**H: Nếu giữa lúc kiểm quyền và lúc ghi, Owner đóng task thì sao (race condition)?**
Đ: Trong bài, dữ liệu in-memory và Node xử lý tuần tự trong một tick, nên không xen được. Với DB thật, kiểm rồi ghi là hai bước nên có cửa sổ TOCTOU. Cách xử lý là gộp điều kiện vào câu ghi: `UPDATE tasks SET ... WHERE id = :id AND assignee = :user AND status = 'Open'`, rồi kiểm số dòng bị ảnh hưởng. Hoặc làm trong transaction có khóa dòng. Đây là chủ đề concurrency của Block 7. Em đã ghi vào phần giới hạn.

**H: Owner muốn giao lại task cho người khác thì làm thế nào?**
Đ: Chưa có trong phạm vi bài. Em sẽ thêm action `task:assign` (chỉ Owner), một endpoint riêng, và kiểm người được giao cũng là thành viên project.

**H: Ví dụ trên slide 11 nói "các mô hình dùng cùng nhau được". Bài em kết hợp thế nào?**
Đ: Đúng như ví dụ V3 trên slide. RBAC: Member có quyền sửa. ReBAC: Bob thuộc project chứa task. ABAC: task giao cho Bob và còn Open. Cả ba nằm trong một hàm `decide()`, đánh giá theo thứ tự cố định.

## Câu hỏi bẫy

**H: Bob gửi PATCH A1 với `{ "status": "Closed", "assignee": "alice" }` thì sao?**
Đ: Bob là assignee của A1 và A1 đang Open, nên được sửa. `status` được áp dụng (đóng task). `assignee` bị bỏ qua vì không có trong whitelist, A1 vẫn giao cho Bob.
