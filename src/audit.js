// Audit log cho quyết định phân quyền. Lý do deny chỉ ghi phía server, không bao giờ trả về client.
// Mỗi dòng là một JSON (JSON Lines) ra stdout: gom bằng ELK/Loki/CloudWatch về sau mà không đổi code.
/** @typedef {import('./types').AuditEntry} AuditEntry */
/** @typedef {import('./types').User} User */
/** @typedef {import('./types').Resource} Resource */
/** @typedef {import('./types').Decision} Decision */

const MODES = ['off', 'deny', 'all']
const RECENT_LIMIT = 50

/** @type {AuditEntry[]} vài quyết định gần nhất, cho trang demo hiển thị lý do */
const recent = []
let seq = 0

// AUDIT_LOG=off|deny|all. Mặc định: deny (production), off khi chạy test để output test sạch.
function mode() {
  const value = process.env.AUDIT_LOG ?? (process.env.NODE_ENV === 'test' ? 'off' : 'deny')
  return MODES.includes(value) ? value : 'deny'
}

/**
 * @param {{ user: User, action: string, resource: Resource, decision: Decision }} input
 * @returns {AuditEntry}
 */
function record({ user, action, resource, decision }) {
  /** @type {AuditEntry} */
  const entry = {
    seq: ++seq,
    ts: new Date().toISOString(),
    event: 'authz.decision',
    userId: user.id,
    action,
    projectId: resource.project.id,
    taskId: resource.task?.id ?? null,
    allow: decision.allow,
    reason: decision.reason,
  }
  recent.push(entry)
  if (recent.length > RECENT_LIMIT) recent.shift()

  const current = mode()
  if (current === 'all' || (current === 'deny' && !entry.allow)) process.stdout.write(`${JSON.stringify(entry)}\n`)
  return entry
}

/** @param {number} [after] chỉ lấy các entry có seq lớn hơn giá trị này */
const recentEntries = (after = 0) => recent.filter(e => e.seq > after)

const clear = () => {
  recent.length = 0
}

module.exports = { record, recentEntries, clear }
