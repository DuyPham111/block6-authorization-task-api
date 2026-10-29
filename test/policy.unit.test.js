// Unit test cho PDP: decide() là hàm thuần nên kiểm được từng nhánh mà không cần HTTP.
const db = require('../src/db')
const { decide } = require('../src/policy')

beforeEach(() => db.resetDb())

const resourceOfTask = id => {
  const task = db.findTask(id)
  return { task, project: db.findProject(task.projectId) }
}

describe('PDP decide() - lý do của từng nhánh', () => {
  test.each([
    ['charlie', 'task:read', 'A1', false, 'other_tenant'],
    ['dana', 'project:delete', 'A1', true, 'tenant_admin'],
    ['erin', 'task:read', 'A1', false, 'not_member'],
    ['vera', 'task:edit', 'A1', false, 'role_lacks_permission'],
    ['bob', 'task:edit', 'A2', false, 'not_assignee'],
    ['alice', 'member:manage', 'A1', true, 'role:Owner'],
  ])('[U1] %s %s trên %s -> allow=%s (%s)', (userId, action, taskId, allow, reason) => {
    const decision = decide(db.findUser(userId), action, resourceOfTask(taskId))
    expect(decision.allow).toBe(allow)
    expect(decision.reason).toBe(reason)
  })

  test('[U2] Member sửa task đã đóng -> task_closed', () => {
    db.updateTask('A1', { status: 'Closed' })
    const decision = decide(db.findUser('bob'), 'task:edit', resourceOfTask('A1'))
    expect(decision).toMatchObject({ allow: false, reason: 'task_closed', visible: true })
  })

  test.each(['Admin', '__proto__', 'constructor', 'toString'])(
    '[U3] Role lạ "%s" trong dữ liệu thành viên không có quyền nào (deny by default)',
    role => {
      db.addMember({ projectId: 'alpha', userId: 'erin', role })
      const decision = decide(db.findUser('erin'), 'task:read', resourceOfTask('A1'))
      expect(decision).toMatchObject({ allow: false, reason: 'role_lacks_permission' })
    },
  )

  test('[U5] Member sửa nhưng thiếu dữ liệu task -> từ chối (fail closed)', () => {
    const decision = decide(db.findUser('bob'), 'task:edit', { project: db.findProject('alpha') })
    expect(decision).toMatchObject({ allow: false, reason: 'missing_task' })
  })

  test('[U4] Action chưa khai báo trong policy bị từ chối, kể cả với Owner', () => {
    const decision = decide(db.findUser('alice'), 'project:export', resourceOfTask('A1'))
    expect(decision.allow).toBe(false)
  })
})
