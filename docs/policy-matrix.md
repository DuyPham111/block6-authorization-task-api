# Bảng chính sách quyền

Quyết định: `allow(subject, action, resource)` trong [src/policy.js](../src/policy.js). Mọi dữ liệu dùng để quyết định (tenant, role, assignee, status) được đọc từ DB. Không có giá trị nào lấy từ body, query hay header.

## 1. Permission matrix (RBAC trong phạm vi project)

| Role trong project | Đọc task | Sửa task | Xóa project | Quản lý thành viên |
| --- | :---: | :---: | :---: | :---: |
| Viewer | ✅ | ❌ | ❌ | ❌ |
| Member | ✅ | ✅ *có điều kiện* | ❌ | ❌ |
| Owner | ✅ | ✅ | ✅ | ✅ |

## 2. Điều kiện bổ sung

| Điều kiện | Áp dụng cho | Mô hình | Kết quả khi sai |
| --- | --- | --- | --- |
| `user.tenantId = project.tenantId` | Mọi action, mọi role, kể cả Admin | Tenant boundary (ABAC) | 404 |
| `user.tenantRole = Admin` | Mọi action, chỉ trong tenant của mình | Role cấp tenant | (cho phép) |
| User là thành viên project chứa resource | Mọi action với user không phải Admin | ReBAC | 404 |
| Role có permission cho action | Mọi action | RBAC | 403 |
| `task.assignee = user` **và** `task.status = Open` | `task:edit` khi role là Member | ABAC | 403 |

## 3. Thứ tự đánh giá

```
1. tenant khác            → DENY (404)
2. Admin của tenant       → ALLOW
3. không phải thành viên  → DENY (404)
4. role thiếu permission  → DENY (403)
5. Member sửa task: assignee ≠ mình hoặc status ≠ Open → DENY (403)
6. còn lại                → ALLOW
```

## 4. Quy tắc nghiệp vụ đi kèm

| Quy tắc | Nơi kiểm | Mã |
| --- | --- | --- |
| PATCH chỉ nhận `title`, `description`, `status` | `taskService.updateTask` | field khác bị bỏ qua |
| `status` ∈ {Open, Closed} | `taskService.updateTask` | 400 |
| Role khi thêm thành viên ∈ {Viewer, Member, Owner} | `projectService.addMember` | 400 |
| Chỉ thêm user cùng tenant với project | `projectService.addMember` | 400 |
| Không gỡ Owner cuối cùng | `projectService.removeMember` | 409 |

## 5. Ma trận → test

| Ô | Test |
| --- | --- |
| Viewer × 4 action | M1, O5, M2, M3 |
| Member × 4 action | M4, M5, O6, O7 |
| Owner × 4 action | M6, M7, O8, O9 |
| Tenant boundary | O16, O17, E22, E23, E25; ở bản cuối cũng chặn O3, O14, E4, E14 (B1/Beta thuộc tenant khác) |
| Admin trong tenant | O15, E24 |
| ReBAC (cùng tenant, không phải thành viên) | E21, E5, C3, L1 (Erin đọc A1); ở V1–V3 (chưa có tenant) chặn O3, O14, E4, E14 |
| ABAC assignee / status | O11, O12, O13, E3, E16, E17, E18, E20 |
| Không tin dữ liệu client | O10, O17, E3, E6, E9, E12, E22 |
| Lý do từng nhánh, role lạ, action lạ, thiếu dữ liệu | U1–U5 |

Mỗi quyết định được ghi vào audit log (`src/audit.js`) kèm `reason` của nhánh tương ứng: `other_tenant`, `tenant_admin`, `not_member`, `role_lacks_permission`, `not_assignee`, `task_closed`, `missing_task`, `role:<Role>`. Client không thấy lý do này.
