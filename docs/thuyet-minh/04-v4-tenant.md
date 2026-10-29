# Phần 4: V4, tenant boundary

## Mục tiêu

Admin của tenant Alpha (Dana) có toàn quyền trong tenant Alpha nhưng **không** truy cập được dữ liệu tenant Beta. Giả mạo `tenantId` hay `role` không có tác dụng.

## Hai bước làm

### Bước 1: `v4-pre`, tái hiện lỗi

Thêm tenant cho user và project, thêm Dana với `tenantRole: 'Admin'`, nhưng kiểm Admin **trước** và không có tenant boundary. Đây là trạng thái "Admin toàn cục" mà slide 24 mô tả.

```js
if (user.tenantRole === 'Admin') return allow('admin')   // cố ý sai
```

Evidence `docs/evidence/v4-before.txt`: 6/8 test đỏ. Dana đọc được B1, xem được danh sách Beta, **xóa được project Beta**.

### Bước 2: `v4`, sửa

```js
// Tenant boundary đứng trước mọi role, kể cả Admin. Tenant của người gọi lấy từ DB.
if (user.tenantId !== project.tenantId) return deny('other_tenant', { visible: false })
// Admin của tenant: toàn quyền, nhưng chỉ trong tenant của mình.
if (user.tenantRole === 'Admin') return allow('tenant_admin')
```

Và trong `addMember`: chỉ thêm được user **cùng tenant** với project.

Diff của bước sửa: 2 file, thêm 8 dòng, bỏ 3 dòng (`docs/evidence/diff-v4-pre-v4.diff`). Evidence `v4-after.txt`: 8/8 xanh. Bảng oracle: 15/17 → 17/17.

## Giải thích từng quyết định

1. **Tenant check là bước đầu tiên.** Tenant là ranh giới cứng. Không role nào, kể cả Admin, được vượt qua. Đặt Admin trước thì Admin thành toàn cục, và `v4-pre` đã chứng minh hậu quả.
2. **Tenant của người gọi lấy từ bản ghi user trong DB** (nạp theo `sub` của token), không lấy từ header `X-Tenant-Id`, query hay body. Test O17 thử header, E22 thử query và body.
3. **404 cho dữ liệu tenant khác.** Không để lộ việc một ID tồn tại ở tenant khác.
4. **Kiểm tenant ngay cả khi có membership.** Test E25 cố ý chèn membership chéo tenant (Charlie là Owner Alpha), mô phỏng dữ liệu lỗi hoặc một bug ở chỗ khác. Tenant check vẫn chặn. Đây là phòng thủ nhiều lớp (defense in depth).
5. **Không thêm user khác tenant vào project.** Chặn ngay từ gốc việc tạo membership chéo tenant (E26). Trả 400 `invalid_user`, giống hệt trường hợp user không tồn tại, để không dò được user của tenant khác.
6. **Admin tenant quản lý được project dù không phải thành viên** (E24). Đó là vai trò của admin tổ chức.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Quyết định |
| --- | --- | --- | --- |
| Admin toàn cục (`v4-pre`) | Đơn giản | Admin tenant Alpha xóa được dữ liệu Beta | ❌ (đã tái hiện lỗi) |
| Tin header `X-Tenant-Id` | Tiện khi một user thuộc nhiều tenant | Client tự đổi tenant (slide 24 "V4 lỗi") | ❌ |
| Tenant trong JWT claim | Có chữ ký, không giả mạo được | Đổi tenant thì phải đợi token mới. Có hai nguồn sự thật | ⚠️ Chấp nhận được, nhưng em đã đọc user từ DB nên lấy luôn từ đó |
| **Tenant từ bản ghi user trong DB** | Một nguồn sự thật, đổi là có hiệu lực ngay | Mỗi request đọc user (đã có sẵn ở bước xác thực) | ✅ |
| Database riêng / schema riêng cho mỗi tenant | Cách ly mạnh nhất | Vận hành phức tạp, quá sức cho lab | ❌ (hướng production) |
| Row-Level Security của PostgreSQL | DB tự chặn dù app quên | Cần DB thật | ❌ trong lab, ✅ nên thêm ở production như lớp thứ hai |
| Chỉ kiểm tenant ở `addMember` (không cho tạo membership chéo) | Ít kiểm hơn | Dữ liệu lỗi hoặc bug khác vẫn có thể tạo membership chéo (E25) | ❌ (kiểm cả hai nơi) |

## Câu hỏi vấn đáp

**H: Tại sao tenant check phải đặt trước kiểm Admin?**
Đ: Nếu kiểm Admin trước thì Admin được cho qua mà không xét tenant. Em làm đúng trạng thái đó ở tag `v4-pre`. Kết quả: Dana đọc được B1 và xóa được project Beta (6 test đỏ). Thêm tenant check lên trước là sửa được, diff chỉ 8 dòng thêm và 3 dòng bỏ.

**H: Tenant của người gọi em lấy ở đâu?**
Đ: Từ bản ghi user trong DB, nạp theo `sub` của token đã xác thực. Header `X-Tenant-Id`, `?tenantId=` hay `tenantId` trong body đều bị bỏ qua (O17, E22).

**H: Nhiều hệ thống SaaS dùng header hoặc subdomain để chọn tenant. Như vậy là sai?**
Đ: Dùng header hay subdomain để *chọn ngữ cảnh* thì được. Nhưng server phải xác minh user thực sự thuộc tenant đó, không được dùng giá trị đó làm căn cứ cấp quyền. Lỗi ở slide 24 là server *tin* header.

**H: Sao không đưa tenantId vào JWT?**
Đ: Đưa vào được, vì JWT có chữ ký nên client không sửa được. Em chọn DB vì hai lý do. Thứ nhất, middleware đã đọc user từ DB rồi. Thứ hai, chỉ có một nguồn sự thật: chuyển user sang tenant khác là có hiệu lực ngay, không phải đợi token hết hạn.

**H: Admin tenant Alpha có xóa được project Alpha không?**
Đ: Có. Admin tenant toàn quyền trong tenant của mình (E24 thêm thành viên, và `decide` trả `tenant_admin` cho mọi action). Nếu tổ chức muốn hạn chế, chỉ cần thay `allow` bằng một bảng permission riêng cho Admin.

**H: Có "super admin" xem được mọi tenant không?**
Đ: Không có trong thiết kế. Nếu cần, đó phải là một đường riêng (API nội bộ, xác thực mạnh hơn, có audit log), không dùng chung API của người dùng tenant. Gộp vào API chung sẽ dễ lặp lại lỗi `v4-pre`.

**H: Test E25 chèn dữ liệu thẳng vào DB, có thực tế không?**
Đ: Có. Đó là cách kiểm *phòng thủ nhiều lớp*. Membership chéo tenant có thể xuất hiện do lỗi import, script migration, hoặc một API khác có bug. Tenant check trong PDP vẫn chặn, không dựa vào việc dữ liệu luôn sạch.

**H: Thêm user khác tenant sao trả 400 mà không trả 404?**
Đ: Đây là giá trị không hợp lệ trong body của một request hợp lệ (Owner có quyền quản lý thành viên), nên là 400. Body `invalid_user` giống hệt trường hợp user không tồn tại, nên không dò được user nào thuộc tenant khác.

**H: Ở production em sẽ cách ly tenant thế nào?**
Đ: Giữ kiểm tra trong app (PDP) và thêm một lớp ở DB như Row-Level Security của PostgreSQL với `tenant_id = current_setting('app.tenant')`. Như vậy nếu một truy vấn nào đó quên điều kiện tenant, DB vẫn chặn.

## Câu hỏi bẫy

**H: Dana gửi `role=Owner` và `X-Tenant-Id: beta` cùng lúc thì sao?**
Đ: Cả hai đều bị bỏ qua. Tenant và role đều đọc từ DB, nên kết quả vẫn 404 (O17, E22).
