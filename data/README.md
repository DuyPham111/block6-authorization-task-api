# Dữ liệu đi kèm

- `seed.json`: dataset giả của lab, gồm 2 tenant, 6 user, 2 project, 4 membership, 4 task. Không chứa secret hay token.
- Ứng dụng nạp file này khi khởi động (`src/db.js` → `require('../data/seed.json')`). Mỗi test gọi `resetDb()` để trở về đúng dataset này.
- Dữ liệu chạy ở RAM: khởi động lại server, hoặc gọi `POST /dev/reset` trên server demo, là dữ liệu trở về trạng thái ban đầu.
- Không cần import thủ công, không cần cài PostgreSQL hay MySQL.

| User | Tenant | Quan hệ | Dùng trong test |
| --- | --- | --- | --- |
| alice | alpha | Owner project Alpha | O2, O8, O9, E5, E9 |
| bob | alpha | Member Alpha, assignee của A1 | O6, O7, O10–O14, E3, E16 |
| vera | alpha | Viewer Alpha | O5, E20 |
| erin | alpha | Chưa thuộc project nào | thêm thành viên (O9), ReBAC `not_member` |
| dana | alpha | `tenantRole: Admin` của tenant Alpha | O15–O17, E22–E24 |
| charlie | beta | Owner project Beta | O4, E14, E25, E26 |

| Task | Project | Assignee | Status |
| --- | --- | --- | --- |
| A1 | alpha | bob | Open |
| A2 | alpha | (chưa giao) | Open |
| B1 | beta | charlie | Open |
| B2 | beta | (chưa giao) | Open |

Muốn thử kịch bản khác, sửa `seed.json` rồi khởi động lại server. Bộ test giả định đúng dataset trên, nên chạy `npm test` với seed gốc.
