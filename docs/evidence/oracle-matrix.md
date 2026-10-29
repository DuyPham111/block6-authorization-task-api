# Bảng test oracle theo phiên bản

Sinh bởi `node scripts/oracle-matrix.js`: chạy bộ test hiện tại trên `src/` của từng git tag.

| Test | Tình huống | starter | v1 | v2 | v3 | v4-pre | v4 | final |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| O1 | Anonymous đọc A1 -> 401 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O2 | Alice đọc A1 (cùng project) -> 200 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O3 | Alice đọc B1 (project Beta) -> 404, không lộ nội dung | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O4 | Charlie đọc B1 (Owner Beta) -> 200 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O5 | Viewer sửa task -> allow=false | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O6 | Member xóa project -> allow=false | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O7 | Member quản lý thành viên -> allow=false | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O8 | Owner xóa project -> allow=true | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O9 | Owner quản lý thành viên -> allow=true | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O10 | Bob tự gửi role=Admin (body, header, query) để xóa project -> 403 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O11 | Bob sửa A1 (giao cho Bob, Open) -> 200 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O12 | Bob sửa A2 (chưa được giao) -> 403, A2 không đổi | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| O13 | Bob sửa A1 khi A1 đã Closed -> 403 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| O14 | Bob sửa B1 (project khác) -> 404 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| O15 | Dana (Admin tenant Alpha) đọc A1 -> 200 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| O16 | Dana đọc B1 (tenant Beta) -> 404 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| O17 | Dana đọc B1 với header X-Tenant-Id: beta -> 404 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | **Oracle qua** | **6/17** | **7/17** | **12/17** | **14/17** | **15/17** | **17/17** | **17/17** |
| | Toàn bộ test qua | 16/58 | 23/70 | 46/70 | 52/70 | 54/70 | 62/70 | 70/70 |

Ghi chú:

- O15 trượt từ `starter` đến `v3` vì user Dana và tenant chỉ được thêm ở `v4-pre` (token của Dana bị 401).
- `v4-pre` là trạng thái cố ý chưa đúng: Admin được coi là toàn cục, nên Dana đọc được B1 (O16, O17 trượt).
- Dòng "Toàn bộ test qua" ở `v4` chưa đủ 58 vì `GET /tasks` và test nhất quán chỉ có từ `final`.
- O8, O9, O11 qua ngay ở `starter`: đó là các request hợp lệ. Bản sửa phải giữ chúng xanh (không "từ chối hết").
