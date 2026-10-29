# Phần 6: Kiểm thử và evidence

## Tổng quan bộ test

| File | Số test | Nội dung |
| --- | --- | --- |
| `test/v1.idor.test.js` | 11 | O1–O4, token hết hạn, ID không tồn tại, danh sách, tự khai userId, scope |
| `test/v2.rbac.test.js` | 21 | 12 ô permission matrix, tự khai role, quản lý thành viên, mass assignment |
| `test/v3.rebac-abac.test.js` | 10 | O11–O14, tự gán assignee, mở lại task, kết hợp mô hình |
| `test/v4.tenant.test.js` | 8 | O15–O17, giả mạo tenantId, membership chéo tenant |
| `test/consistency.test.js` | 8 | Check và list khớp nhau cho mọi user × task, thu hồi quyền |
| `test/policy.unit.test.js` | 12 | Unit test PDP: lý do từng nhánh, role lạ, action chưa khai báo |
| `test/demo.test.js` | 3 | Server demo tách biệt: app chính không có `/dev/token`, request demo vẫn qua phân quyền thật |
| **Tổng** | **73** | Coverage: 98.9% dòng `src/`, `policy.js` 100% nhánh |

Ký hiệu trong tên test: `[O*]` test oracle của bài, `[M*]` ô ma trận, `[E*]` bổ sung, `[C*]` nhất quán, `[U*]` unit, `[S*]` server demo.

## Nguyên tắc viết test

1. **Đỏ trước, xanh sau.** Viết test trước khi sửa, chạy trên code của tag trước (`scripts/test-against.sh`) để thấy đỏ, lưu output. Sửa xong chạy lại thấy xanh, lưu output. Evidence nằm ở `docs/evidence/v*-before.txt` và `v*-after.txt`.
2. **Có cả test được phép và test bị từ chối.** Mỗi quyền đều có hai phía.
3. **Test từ chối kiểm luôn dữ liệu không đổi.** Không chỉ kiểm mã 403/404 mà còn kiểm task chưa bị sửa, project chưa bị xóa, thành viên chưa được thêm.
4. **Test từ chối kiểm không lộ nội dung.** Helper `expectDenied` kiểm body không có `title` hay `description` và không phải mảng.
5. **Gọi qua HTTP thật** (Supertest với `app`), để đi qua đủ middleware → route → service → policy.
6. **Dữ liệu độc lập.** `beforeEach(resetDb)`, không phụ thuộc thứ tự chạy.
7. **Kiểm mã cụ thể** (403 hoặc 404 theo quy ước) chứ không chấp nhận "403 hoặc 404". Như vậy test khóa luôn quy ước che sự tồn tại.

## Bảng oracle theo phiên bản

Sinh bởi `node scripts/oracle-matrix.js` (`docs/evidence/oracle-matrix.md`):

| | starter | v1 | v2 | v3 | v4-pre | v4 | final |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Oracle qua | 6/17 | 7/17 | 12/17 | 14/17 | 15/17 | 17/17 | 17/17 |
| Toàn bộ test qua | 16/58* | 23/70 | 46/70 | 52/70 | 54/70 | 62/70 | **70/70** |

\* Ở starter, file unit test PDP không nạp được vì chưa có `policy.js`. Bảng này và mục "từ chối hết" bên dưới đo tại tag `final` (70 test), trước khi thêm trang demo và 3 test `[S*]`.

## Trang demo

`npm run demo` mở `http://localhost:3100/demo/`: chọn người gọi, gửi request, xem response và lệnh curl; chạy từng kịch bản hoặc cả 21 kịch bản (17 oracle + E1, E3, E5, E7) với kết luận Đạt/Sai. Server demo chỉ nghe trên `127.0.0.1` và nằm ngoài `src/app.js`.

**H: Trang demo cấp token cho bất kỳ ai, vậy có phải lỗ hổng không?**
Đ: Endpoint `/dev/token` chỉ có trong `demo/server.js`, một server riêng chỉ nghe trên `127.0.0.1` để thuyết trình. `src/app.js` (bản chạy bằng `npm start`) không import file này. Test `[S1]` gọi `/dev/token` vào app chính: không token thì 401, có token thì 404.

## Chống bản sửa "từ chối hết"

Em tạo một biến thể sai trong thư mục tạm: `decide()` luôn trả deny. Rồi chạy cả bộ test trên biến thể đó (`docs/evidence/deny-all.txt`):

- **51/70 test trượt.** Các test được phép (O2, O4, O8, O9, O11, O15, M1, M4–M7, E17, E18, E24...) đều đỏ.
- Nếu chỉ chấm theo tiêu chí "403 hoặc 404" của đề, bản từ chối hết **vẫn qua 11/17 oracle**, khớp với cột "Từ chối hết" trên slide 25. Chỉ có 6 test được phép bắt được nó. Đó là lý do test được phép là bắt buộc.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Quyết định |
| --- | --- | --- | --- |
| Test thủ công bằng Postman | Nhanh lúc đầu | Không lặp lại được, không làm evidence được | ❌ |
| Chỉ unit test `decide()` | Nhanh, chính xác | Không chứng minh route thật đi qua policy | Bổ sung, không thay thế |
| **Integration test qua HTTP (Supertest)** | Kiểm đúng đường request thật | Chậm hơn unit test một chút (~2 giây cho cả bộ) | ✅ chính |
| Chấp nhận "403 hoặc 404" | Khớp đề | Không khóa quy ước. Bản sai trả 403 cho người ngoài vẫn qua | ❌ (kiểm mã cụ thể) |
| `test.each` cho ma trận | Mỗi ô một test, dễ đối chiếu | | ✅ |
| Snapshot test response | Ít code | Không nói lên ý định. Dễ cập nhật nhầm | ❌ |

## Câu hỏi vấn đáp

**H: Em chứng minh test thực sự bắt được lỗi bằng cách nào?**
Đ: Chạy chính test đó trên code *trước khi sửa*. Ví dụ `bash scripts/test-against.sh starter test/v1.idor.test.js` cho 5 test đỏ, trong đó O3 là "Expected 404, Received 200". Sửa xong chạy lại thì cùng test đó xanh. Cả hai output đều lưu trong `docs/evidence/`.

**H: Nếu em sửa bằng cách từ chối mọi request thì test có phát hiện không?**
Đ: Có. Em đã thử thật: 51/70 test trượt (`docs/evidence/deny-all.txt`). Các test được phép như Alice đọc A1, Charlie đọc B1, Owner xóa project đều đỏ.

**H: Sao không chỉ viết đủ 17 test oracle?**
Đ: Oracle là mức tối thiểu. Các test bổ sung bắt những lỗi mà oracle bỏ sót: tự gán assignee (E3), mass assignment `projectId` (E9), mở lại task đã đóng (E16), membership chéo tenant (E25), và list lệch với check (C1).

**H: Tại sao test bị từ chối phải kiểm dữ liệu không đổi?**
Đ: Một lỗi thường gặp là code ghi xong rồi mới kiểm quyền và báo lỗi. Response vẫn là 403 nhưng dữ liệu đã bị sửa. Chỉ kiểm mã lỗi thì không phát hiện được.

**H: Coverage bao nhiêu? Chỗ nào chưa phủ?**
Đ: 98.9% số dòng. `policy.js` phủ 100% nhánh. Phần chưa phủ là nhánh lỗi 500 trong `app.js`, nhánh token có `sub` không tồn tại trong `auth.js`, và một vài nhánh validate (thêm thành viên trùng). Không phần nào trong đó thuộc logic quyết định quyền.

**H: Trường hợp nào em chưa kiểm tra?**
Đ: Concurrency (đổi quyền đúng lúc PATCH), cache quyền, các entry point ngoài HTTP như job nền, hiệu năng với DB thật, và chia sẻ riêng một task. Tất cả đã ghi trong `docs/explanation.md` mục 5, kèm hướng xử lý.

## Câu hỏi bẫy

**H: Test chạy trên dữ liệu in-memory. Lên DB thật thì test còn giá trị không?**
Đ: Các test HTTP kiểm *hành vi*, không phụ thuộc vào cách lưu dữ liệu. Thay `db.js` bằng SQL thì giữ nguyên bộ test, chỉ cần thêm bước reset DB trong `beforeEach`. Đó chính là lợi ích của test qua HTTP thay vì test chi tiết cài đặt.
