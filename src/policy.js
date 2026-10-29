// PDP (Policy Decision Point): trả lời allow(subject, action, resource).
// Hàm thuần, không biết gì về HTTP. `resource` = { project, task? } luôn được nạp từ DB.
const db = require('./db')

// RBAC: permission gắn với role trong phạm vi một project.
const ROLE_PERMISSIONS = {
  Viewer: ['task:read'],
  Member: ['task:read', 'task:edit'],
  Owner: ['task:read', 'task:edit', 'project:delete', 'member:manage'],
}
const ROLES = Object.keys(ROLE_PERMISSIONS)

// Role lạ (kể cả '__proto__', 'constructor') không có quyền nào: deny by default.
const permissionsOf = role => (Object.hasOwn(ROLE_PERMISSIONS, role) ? ROLE_PERMISSIONS[role] : [])

const allow = reason => ({ allow: true, reason })
// visible = false: người gọi không được biết resource tồn tại (PEP trả 404 thay vì 403).
const deny = (reason, { visible }) => ({ allow: false, visible, reason })

function decide(user, action, { project, task }) {
  // Tenant boundary: đứng trước mọi role, kể cả Admin. Tenant của người gọi lấy từ DB, không từ header.
  if (user.tenantId !== project.tenantId) return deny('other_tenant', { visible: false })

  // Admin của tenant: toàn quyền, nhưng chỉ trong tenant của mình.
  if (user.tenantRole === 'Admin') return allow('tenant_admin')

  // ReBAC: người gọi phải là thành viên của project chứa resource.
  const membership = db.findMembership(user.id, project.id)
  if (!membership) return deny('not_member', { visible: false })

  // RBAC: role lấy từ bảng thành viên, không lấy từ request.
  if (!permissionsOf(membership.role).includes(action)) return deny('role_lacks_permission', { visible: true })

  // ABAC: Member chỉ sửa task được giao cho mình khi task còn Open (thuộc tính của bản ghi đang lưu).
  if (action === 'task:edit' && membership.role === 'Member') {
    if (task.assignee !== user.id) return deny('not_assignee', { visible: true })
    if (task.status !== 'Open') return deny('task_closed', { visible: true })
  }

  return allow(`role:${membership.role}`)
}

module.exports = { decide, ROLES, ROLE_PERMISSIONS }
