# Phần 7: Câu hỏi kết thúc và đáp án quiz trên slide

## Bốn câu hỏi kết thúc (slide 28)

**1. Token có scope `tasks:read` có đủ để Alice đọc task B1 không? Vì sao?**
Không đủ. Scope chỉ giới hạn *loại* thao tác mà token được làm. Nó không cho biết Alice có quan hệ với B1. Server vẫn phải kiểm Alice có thuộc project chứa B1 không.
*Trong bài:* test E7 dùng token chỉ có `tasks:read`, đọc A1 được 200 còn đọc B1 bị 404.

**2. Khi dùng role Member, hệ thống còn cần kiểm tra dữ liệu nào trước khi cho sửa task?**
- Task thuộc project nào, và người gọi có phải thành viên của project đó không (ReBAC).
- `assignee` có phải người gọi không, và `status` có phải Open không (ABAC).
- Tenant của project có trùng tenant của người gọi không.

Tất cả lấy từ dữ liệu server đang giữ. Role chỉ trả lời "Member được làm *loại* thao tác nào".
*Trong bài:* O12, O13, O14, E20, E21, O16.

**3. Vì sao ẩn nút Delete trên giao diện không ngăn được request trực tiếp?**
Giao diện chạy ở phía client, nên ẩn nút chỉ ảnh hưởng tới người bấm nút. Request gửi bằng curl, Postman hay script không đi qua giao diện. Server phải tự kiểm quyền (đây là lỗi BFLA).
*Trong bài:* O6 cho Bob gọi thẳng `DELETE /projects/alpha` và nhận 403. Ở starter, request này trả 204 và project bị xóa thật.

**4. Với hàng triệu tài liệu chia sẻ qua nhiều nhóm, policy nên được tổ chức như thế nào để tránh khác biệt giữa các API?**
- Một PDP dùng chung cho mọi entry point.
- Lưu quan hệ chia sẻ như dữ liệu (user → nhóm → thư mục → tài liệu), không viết điều kiện riêng trong từng API. Có thể dùng hệ thống ReBAC như OpenFGA.
- Tách hai câu hỏi `check` (một object) và `list` (danh sách object).
- Cache có TTL kèm quy trình thu hồi.
- Một bộ test dùng chung cho mọi API.

*Trong bài:* `decide()` là PDP chung. `readableProjectIds()` là bản list. Test C1 đối chiếu check với list.

## Đáp án quiz slide 14: Chọn mô hình theo yêu cầu

| # | Yêu cầu | Mô hình | Giải thích |
| --- | --- | --- | --- |
| 1 | Alice chia sẻ riêng một tài liệu cho Bob đọc, các tài liệu khác thì không | **ACL** | Ngoại lệ trên một resource cụ thể, chỉ cần một mục |
| 2 | Viewer đọc task trong project, Owner xóa được project | **RBAC** | Quyền gắn với role trong project |
| 3 | Member chỉ sửa task được giao cho mình khi task chưa đóng | **ABAC** (kèm RBAC, ReBAC) | Phụ thuộc thuộc tính assignee và status |
| 4 | Xem được tài liệu nếu thuộc nhóm đã được chia sẻ thư mục chứa tài liệu đó | **ReBAC** | Chuỗi quan hệ user → nhóm → thư mục → tài liệu |
| 5 | Báo cáo chỉ truy cập được trong giờ làm việc và từ IP công ty | **ABAC** | Thuộc tính của context (thời gian, IP) |
| 6 | Admin tenant Alpha không truy cập được dữ liệu tenant Beta | **RBAC + ABAC** (hoặc ReBAC) | Role Admin, bị giới hạn bởi thuộc tính tenant (hoặc quan hệ user thuộc tenant) |

## Đáp án quiz slide 27: Server trả mã nào?

| # | Tình huống | Mã | Lý do |
| --- | --- | --- | --- |
| 1 | `GET /tasks/A1`, không có header Authorization | **401** | Chưa xác thực được người gọi |
| 2 | Alice (Owner Alpha, token còn hạn) gọi `GET /tasks/A1` | **200** | Có quyền |
| 3 | Bob (Member) gọi `DELETE /projects/alpha` | **403** | Đã xác thực, thấy project, nhưng role không có quyền |
| 4 | Alice gọi `GET /tasks/B1`, hệ thống che sự tồn tại | **404** | Resource ngoài phạm vi, che sự tồn tại |
| 5 | Bob (Member, assignee) gọi `PATCH /tasks/A1` khi A1 đã Closed | **403** | Thấy task nhưng điều kiện ABAC không thỏa |
| 6 | Alice gọi `GET /tasks/Z9`, không có task Z9 | **404** | Không tồn tại |
| 7 | Token của Alice đã quá `exp` | **401** | Token hết hạn thì không còn xác thực được |

Tất cả 7 tình huống đều có test tương ứng trong bộ test: O1, O2, O6, O3, O13, E2, E1.
