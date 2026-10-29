// PDP (Policy Decision Point): trả lời allow(subject, action, resource).
// Hàm thuần, không biết gì về HTTP. `resource` = { project, task? } luôn được nạp từ DB.
/** @typedef {import('./types').User} User */
/** @typedef {import('./types').Resource} Resource */
/** @typedef {import('./types').Decision} Decision */
const db = require('./db')

/** RBAC: permission gắn với role trong phạm vi một project. @type {Record<string, string[]>} */
const ROLE_PERMISSIONS = {
  Viewer: ['task:read'],
  Member: ['task:read', 'task:edit'],
  Owner: ['task:read', 'task:edit', 'project:delete', 'member:manage'],
}
const ROLES = Object.keys(ROLE_PERMISSIONS)

// Role lạ (kể cả '__proto__', 'constructor') không có quyền nào: deny by default.
/** @param {string} role */
const permissionsOf = role => (Object.hasOwn(ROLE_PERMISSIONS, role) ? ROLE_PERMISSIONS[role] : [])

/** @param {string} reason @returns {Decision} */
const allow = reason => ({ allow: true, reason })
// visible = false: người gọi không được biết resource tồn tại (PEP trả 404 thay vì 403).
/** @param {string} reason @param {{ visible: boolean }} options @returns {Decision} */
const deny = (reason, { visible }) => ({ allow: false, visible, reason })

/**
 * @param {User} user
 * @param {string} action
 * @param {Resource} resource
 * @returns {Decision}
 */
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
    if (!task) return deny('missing_task', { visible: true }) // fail closed: thiếu dữ liệu thì không cho
    if (task.assignee !== user.id) return deny('not_assignee', { visible: true })
    if (task.status !== 'Open') return deny('task_closed', { visible: true })
  }

  return allow(`role:${membership.role}`)
}

// Bản "list" của rule task:read: các project người gọi được đọc, để lọc ngay trong truy vấn danh sách
// (SQL tương đương: JOIN project_members ... WHERE tenant_id = :tenant).
// Phải khớp với decide(); test/consistency.test.js đối chiếu hai đường này cho mọi user × task.
/** @param {User} user @returns {string[]} */
function readableProjectIds(user) {
  const inTenant = db.listProjects().filter(p => p.tenantId === user.tenantId)
  if (user.tenantRole === 'Admin') return inTenant.map(p => p.id)
  return inTenant.filter(p => db.findMembership(user.id, p.id)).map(p => p.id)
}

module.exports = { decide, readableProjectIds, ROLES, ROLE_PERMISSIONS }
