const db = require('../src/db')
const { api, bearer, expectDenied } = require('./helpers')

beforeEach(() => db.resetDb())

const asDana = req => req.set('Authorization', bearer('dana'))

describe('V4 - Admin tenant Alpha không vượt tenant boundary', () => {
  test('[O15] Dana (Admin tenant Alpha) đọc A1 -> 200', async () => {
    const res = await asDana(api().get('/tasks/A1'))
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('A1')
  })

  test('[O16] Dana đọc B1 (tenant Beta) -> 404', async () => {
    const res = await asDana(api().get('/tasks/B1'))
    expectDenied(res, 404)
  })

  test('[O17] Dana đọc B1 với header X-Tenant-Id: beta -> 404', async () => {
    const res = await asDana(api().get('/tasks/B1')).set('X-Tenant-Id', 'beta')
    expectDenied(res, 404)
  })

  test('[E22] Dana gửi tenantId=beta trong query và body -> 404', async () => {
    const res = await asDana(api().get('/tasks/B1?tenantId=beta')).send({ tenantId: 'beta', role: 'Admin' })
    expectDenied(res, 404)
  })

  test('[E23] Dana xem danh sách hoặc xóa project Beta -> 404, Beta vẫn còn', async () => {
    const list = await asDana(api().get('/projects/beta/tasks'))
    expectDenied(list, 404)
    const del = await asDana(api().delete('/projects/beta'))
    expectDenied(del, 404)
    expect(db.findProject('beta')).toBeDefined()
  })
})

describe('V4 - quyền Admin bên trong tenant của mình', () => {
  test('[E24] Dana quản lý thành viên project Alpha dù không phải member -> 201', async () => {
    const res = await asDana(api().post('/projects/alpha/members')).send({ userId: 'erin', role: 'Viewer' })
    expect(res.status).toBe(201)
    expect(db.findMembership('erin', 'alpha').role).toBe('Viewer')
  })
})

describe('V4 - dữ liệu thành viên không vượt tenant', () => {
  test('[E25] Membership chéo tenant (dữ liệu lỗi) vẫn bị chặn bởi tenant boundary -> 404', async () => {
    db.addMember({ projectId: 'alpha', userId: 'charlie', role: 'Owner' })
    const res = await api().get('/tasks/A1').set('Authorization', bearer('charlie'))
    expectDenied(res, 404)
  })

  test('[E26] Owner Alpha thêm user của tenant Beta vào project -> 400', async () => {
    const res = await api()
      .post('/projects/alpha/members')
      .set('Authorization', bearer('alice'))
      .send({ userId: 'charlie', role: 'Viewer' })
    expect(res.status).toBe(400)
    expect(db.findMembership('charlie', 'alpha')).toBeUndefined()
  })
})
