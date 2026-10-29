const db = require('../src/db')
const { api, bearer, expectDenied } = require('./helpers')

beforeEach(() => db.resetDb())

describe('V1 - object-level authorization khi đọc task', () => {
  test('[O1] Anonymous đọc A1 -> 401', async () => {
    const res = await api().get('/tasks/A1')
    expect(res.status).toBe(401)
  })

  test('[O2] Alice đọc A1 (cùng project) -> 200', async () => {
    const res = await api().get('/tasks/A1').set('Authorization', bearer('alice'))
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('A1')
  })

  test('[O3] Alice đọc B1 (project Beta) -> 404, không lộ nội dung', async () => {
    const res = await api().get('/tasks/B1').set('Authorization', bearer('alice'))
    expectDenied(res, 404)
  })

  test('[O4] Charlie đọc B1 (Owner Beta) -> 200', async () => {
    const res = await api().get('/tasks/B1').set('Authorization', bearer('charlie'))
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('B1')
  })

  test('[E1] Token của Alice đã hết hạn -> 401', async () => {
    const res = await api().get('/tasks/A1').set('Authorization', bearer('alice', { expiresIn: -60 }))
    expect(res.status).toBe(401)
  })

  test('[E2] Task không tồn tại -> 404, body giống hệt khi bị che (không dò được ID)', async () => {
    const missing = await api().get('/tasks/Z9').set('Authorization', bearer('alice'))
    const hidden = await api().get('/tasks/B1').set('Authorization', bearer('alice'))
    expect(missing.status).toBe(404)
    expect(hidden.status).toBe(404)
    expect(hidden.body).toEqual(missing.body)
  })

  test('[E4] Alice đọc danh sách task của project Beta -> 404 (entry point thứ hai)', async () => {
    const res = await api().get('/projects/beta/tasks').set('Authorization', bearer('alice'))
    expectDenied(res, 404)
  })

  test('[E4b] Alice đọc danh sách task của project Alpha -> 200, chỉ có task Alpha', async () => {
    const res = await api().get('/projects/alpha/tasks').set('Authorization', bearer('alice'))
    expect(res.status).toBe(200)
    expect(res.body.map(t => t.id).sort()).toEqual(['A1', 'A2'])
  })

  test('[E6] Bob tự khai userId=charlie (query, header, body) vẫn không đọc được B1', async () => {
    const res = await api()
      .get('/tasks/B1?userId=charlie')
      .set('Authorization', bearer('bob'))
      .set('X-User-Id', 'charlie')
      .send({ userId: 'charlie' })
    expectDenied(res, 404)
  })

  test('[E7] Token chỉ có scope tasks:read: đọc được A1 nhưng vẫn không đọc được B1', async () => {
    const token = bearer('alice', { scope: 'tasks:read' })
    const own = await api().get('/tasks/A1').set('Authorization', token)
    const other = await api().get('/tasks/B1').set('Authorization', token)
    expect(own.status).toBe(200)
    expectDenied(other, 404)
  })

  test('[E8] Token thiếu scope tasks:read -> 403 insufficient_scope dù Alice là Owner', async () => {
    const res = await api().get('/tasks/A1').set('Authorization', bearer('alice', { scope: 'tasks:write' }))
    expectDenied(res, 403)
    expect(res.body.error).toBe('insufficient_scope')
  })
})
