const db = require('../src/db')
const { api, bearer, expectDenied } = require('./helpers')

beforeEach(() => db.resetDb())

const USER_OF_ROLE = { Viewer: 'vera', Member: 'bob', Owner: 'alice' }

// Mỗi action: cách gọi API và cách kiểm dữ liệu không đổi khi bị từ chối.
const ACTIONS = {
  'đọc task': {
    call: token => api().get('/tasks/A1').set('Authorization', token),
    allowed: 200,
    unchanged: () => {},
  },
  'sửa task': {
    call: token => api().patch('/tasks/A1').set('Authorization', token).send({ title: 'Tiêu đề mới' }),
    allowed: 200,
    unchanged: () => expect(db.findTask('A1').title).toBe('Thiết kế màn hình đăng nhập'),
  },
  'xóa project': {
    call: token => api().delete('/projects/alpha').set('Authorization', token),
    allowed: 204,
    unchanged: () => expect(db.findProject('alpha')).toBeDefined(),
  },
  'quản lý thành viên': {
    call: token =>
      api().post('/projects/alpha/members').set('Authorization', token).send({ userId: 'erin', role: 'Viewer' }),
    allowed: 201,
    unchanged: () => expect(db.findMembership('erin', 'alpha')).toBeUndefined(),
  },
}

// Permission matrix: mỗi ô sinh một test. Mã O* là test trong oracle của bài.
const MATRIX = [
  { id: 'M1', role: 'Viewer', action: 'đọc task', allow: true },
  { id: 'O5', role: 'Viewer', action: 'sửa task', allow: false },
  { id: 'M2', role: 'Viewer', action: 'xóa project', allow: false },
  { id: 'M3', role: 'Viewer', action: 'quản lý thành viên', allow: false },
  { id: 'M4', role: 'Member', action: 'đọc task', allow: true },
  { id: 'M5', role: 'Member', action: 'sửa task', allow: true },
  { id: 'O6', role: 'Member', action: 'xóa project', allow: false },
  { id: 'O7', role: 'Member', action: 'quản lý thành viên', allow: false },
  { id: 'M6', role: 'Owner', action: 'đọc task', allow: true },
  { id: 'M7', role: 'Owner', action: 'sửa task', allow: true },
  { id: 'O8', role: 'Owner', action: 'xóa project', allow: true },
  { id: 'O9', role: 'Owner', action: 'quản lý thành viên', allow: true },
]

describe('V2 - permission matrix theo role trong project', () => {
  test.each(MATRIX)('[$id] $role $action -> allow=$allow', async ({ role, action, allow }) => {
    const { call, allowed, unchanged } = ACTIONS[action]
    const res = await call(bearer(USER_OF_ROLE[role]))
    if (allow) {
      expect(res.status).toBe(allowed)
    } else {
      expectDenied(res, 403)
      unchanged()
    }
  })
})

describe('V2 - role không lấy từ request', () => {
  test('[O10] Bob tự gửi role=Admin (body, header, query) để xóa project -> 403', async () => {
    const res = await api()
      .delete('/projects/alpha?role=Owner')
      .set('Authorization', bearer('bob'))
      .set('X-Role', 'Admin')
      .send({ role: 'Admin' })
    expectDenied(res, 403)
    expect(db.findProject('alpha')).toBeDefined()
  })

  test('[E12] Member tự thêm mình làm Owner -> 403, role vẫn là Member', async () => {
    const res = await api()
      .post('/projects/alpha/members')
      .set('Authorization', bearer('bob'))
      .send({ userId: 'bob', role: 'Owner' })
    expectDenied(res, 403)
    expect(db.findMembership('bob', 'alpha').role).toBe('Member')
  })

  test('[E10] Owner mời thành viên với role không có trong hệ thống (Admin) -> 400', async () => {
    const res = await api()
      .post('/projects/alpha/members')
      .set('Authorization', bearer('alice'))
      .send({ userId: 'erin', role: 'Admin' })
    expect(res.status).toBe(400)
    expect(db.findMembership('erin', 'alpha')).toBeUndefined()
  })
})

describe('V2 - quản lý thành viên và thu hồi quyền', () => {
  test('[E5] Owner gỡ Bob khỏi Alpha -> Bob mất quyền đọc A1 ngay lập tức', async () => {
    const before = await api().get('/tasks/A1').set('Authorization', bearer('bob'))
    expect(before.status).toBe(200)

    const removed = await api().delete('/projects/alpha/members/bob').set('Authorization', bearer('alice'))
    expect(removed.status).toBe(204)

    const after = await api().get('/tasks/A1').set('Authorization', bearer('bob'))
    expectDenied(after, 404)
  })

  test('[E13] Member gỡ thành viên khác -> 403, Vera vẫn còn trong project', async () => {
    const res = await api().delete('/projects/alpha/members/vera').set('Authorization', bearer('bob'))
    expectDenied(res, 403)
    expect(db.findMembership('vera', 'alpha')).toBeDefined()
  })

  test('[E11] Không gỡ được Owner cuối cùng của project -> 409', async () => {
    const res = await api().delete('/projects/alpha/members/alice').set('Authorization', bearer('alice'))
    expect(res.status).toBe(409)
    expect(db.findMembership('alice', 'alpha').role).toBe('Owner')
  })

  test('[E14] Owner Beta không quản lý được thành viên project Alpha -> 404', async () => {
    const res = await api()
      .post('/projects/alpha/members')
      .set('Authorization', bearer('charlie'))
      .send({ userId: 'charlie', role: 'Owner' })
    expectDenied(res, 404)
    expect(db.findMembership('charlie', 'alpha')).toBeUndefined()
  })
})

describe('V2 - PATCH chỉ nhận field được phép', () => {
  test('[E9] Owner gửi projectId/id trong body -> bị bỏ qua, task vẫn thuộc Alpha', async () => {
    const res = await api()
      .patch('/tasks/A1')
      .set('Authorization', bearer('alice'))
      .send({ title: 'Đổi tên', projectId: 'beta', id: 'HACK' })
    expect(res.status).toBe(200)
    const task = db.findTask('A1')
    expect(task.title).toBe('Đổi tên')
    expect(task.projectId).toBe('alpha')
    expect(db.findTask('HACK')).toBeUndefined()
  })

  test('[E15] Status ngoài Open/Closed -> 400', async () => {
    const res = await api().patch('/tasks/A1').set('Authorization', bearer('alice')).send({ status: 'Deleted' })
    expect(res.status).toBe(400)
    expect(db.findTask('A1').status).toBe('Open')
  })
})
