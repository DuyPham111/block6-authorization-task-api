// PDP (Policy Decision Point): trả lời allow(subject, action, resource).
// Hàm thuần, không biết gì về HTTP. `resource` = { project, task? } luôn được nạp từ DB.
const db = require('./db')

const allow = reason => ({ allow: true, reason })
// visible = false: người gọi không được biết resource tồn tại (PEP trả 404 thay vì 403).
const deny = (reason, { visible }) => ({ allow: false, visible, reason })

function decide(user, action, { project }) {
  // ReBAC: người gọi phải là thành viên của project chứa resource.
  const membership = db.findMembership(user.id, project.id)
  if (!membership) return deny('not_member', { visible: false })

  return allow('member')
}

module.exports = { decide }
