# Thuyết minh và chuẩn bị vấn đáp

Mỗi file gồm: mục tiêu, những gì đã làm, giải thích thiết kế, **bảng phương án đã cân nhắc** (chọn gì, bỏ gì, vì sao) và **câu hỏi vấn đáp** kèm câu trả lời gợi ý.

| File | Nội dung |
| --- | --- |
| [00-tong-quan-va-starter.md](00-tong-quan-va-starter.md) | Bối cảnh, ba lớp kiểm tra, chọn stack, thiết kế token, dữ liệu mẫu, cách tạo evidence |
| [01-v1-idor.md](01-v1-idor.md) | V1: IDOR/BOLA, object-level authorization, 404 hay 403 |
| [02-v2-rbac.md](02-v2-rbac.md) | V2: RBAC theo project, permission matrix, BFLA, mass assignment |
| [03-v3-rebac-abac.md](03-v3-rebac-abac.md) | V3: kết hợp ReBAC + RBAC + ABAC, kiểm trên bản ghi đang lưu |
| [04-v4-tenant.md](04-v4-tenant.md) | V4: tenant boundary, giả mạo tenantId, Admin của tenant |
| [05-kien-truc.md](05-kien-truc.md) | PEP/PDP, vị trí đặt kiểm quyền, check và list, cache, mở rộng quy mô |
| [06-kiem-thu.md](06-kiem-thu.md) | Chiến lược test, evidence đỏ/xanh, oracle, chống "từ chối hết" |
| [07-cau-hoi-ket-thuc.md](07-cau-hoi-ket-thuc.md) | 4 câu hỏi kết thúc, đáp án hai bài quiz trên slide |

## 10 câu thầy dễ hỏi nhất (trả lời trong 30 giây)

1. **Token có scope `tasks:read`, sao Alice vẫn không đọc được B1?** Scope chỉ nói token được làm *loại* thao tác nào. Nó không nói Alice có quan hệ với *task B1*. Server vẫn phải kiểm Alice có thuộc project chứa B1 không. Test E7 chứng minh điều này.
2. **Kiểm quyền đặt ở đâu, sao không đặt ở controller?** Đặt ở service (PEP), gọi chung một hàm `decide()` (PDP). Cùng một dữ liệu có nhiều đường vào (`/tasks/:id`, `/projects/:id/tasks`, `/tasks`). Đặt ở controller thì route nào quên là lọt.
3. **Sao trả 404 mà không trả 403 khi Alice đọc B1?** Để che sự tồn tại, tránh bị dò ID. Body của "bị che" và "không tồn tại" giống hệt nhau (test E2). Người *cùng project* nhưng thiếu quyền thì nhận 403 có lý do rõ.
4. **Sao không để role trong JWT cho nhanh?** Role thay đổi theo project và có thể bị thu hồi. Nếu role nằm trong token, người bị gỡ vẫn dùng được quyền cũ tới khi token hết hạn (slide 20). Đọc từ DB thì thu hồi có hiệu lực ngay (test E5).
5. **Sao chọn RBAC + ReBAC + ABAC mà không chỉ RBAC?** RBAC không biểu diễn được "task được giao cho mình, còn Open". ReBAC trả lời "có thuộc project không". ABAC trả lời "với task cụ thể này, điều kiện có thỏa không".
6. **Sao không dùng ACL?** Bài không cần chia sẻ riêng từng task. ACL cần `user × task` mục và phải ghi thêm mỗi khi tạo task.
7. **Bob gửi `role=Admin` thì sao?** Không ảnh hưởng gì. Role đọc từ bảng thành viên. Test O10 thử gửi qua cả body, header và query.
8. **Làm sao chứng minh bản sửa không phải "từ chối hết"?** Có các test được phép (O2, O4, O8, O9, O11, O15, M1, M4–M7). Từ chối hết thì các test này đỏ.
9. **Sao tenant check đứng trước kiểm Admin?** Tag `v4-pre` đặt Admin trước và Dana đọc được B1, có evidence đỏ. Tenant là ranh giới cứng, không role nào được vượt.
10. **Danh sách hàng nghìn task có bị N+1 không?** Không. Điều kiện quyền nằm trong truy vấn danh sách (`readableProjectIds`, tương đương JOIN). Test C1 đối chiếu kết quả list với từng lần check cho mọi user × task.

## Cách trả lời khi gặp câu chưa chuẩn bị

Trả lời theo khung **quyết định → lý do → đánh đổi → evidence**:

> "Em chọn X vì Y. Đánh đổi là Z. Test số ... chứng minh hành vi này."

Nếu đó là giới hạn chưa làm, nói thẳng và chỉ vào [../explanation.md](../explanation.md) mục 5 (trường hợp chưa kiểm tra), kèm hướng xử lý.
