const request = require('supertest')
const app = require('../src/app')
const demo = require('../demo/server')
const db = require('../src/db')

beforeEach(() => db.resetDb())

const demoToken = async userId => (await request(demo).post('/dev/token').send({ userId })).body.token

describe('Server demo tách biệt khỏi app chính', () => {
  test('[S1] App chính không có /dev/token: không token -> 401, có token -> 404', async () => {
    const anon = await request(app).post('/dev/token').send({ userId: 'dana' })
    expect(anon.status).toBe(401)

    const authed = await request(app)
      .post('/dev/token')
      .set('Authorization', `Bearer ${await demoToken('alice')}`)
      .send({ userId: 'dana' })
    expect(authed.status).toBe(404)
    expect(authed.body).not.toHaveProperty('token')
  })

  test('[S2] Request qua server demo vẫn đi qua đúng phân quyền của app thật', async () => {
    const token = await demoToken('alice')
    const own = await request(demo).get('/tasks/A1').set('Authorization', `Bearer ${token}`)
    const other = await request(demo).get('/tasks/B1').set('Authorization', `Bearer ${token}`)
    expect(own.status).toBe(200)
    expect(other.status).toBe(404)
  })

  test('[S4] /dev/audit trả lý do của PDP cho trang demo; Swagger UI và đặc tả được phục vụ', async () => {
    const token = await demoToken('bob')
    await request(demo).patch('/tasks/A2').set('Authorization', `Bearer ${token}`).send({ title: 'x' })
    const { entries } = (await request(demo).get('/dev/audit')).body
    expect(entries.at(-1)).toMatchObject({ userId: 'bob', action: 'task:edit', taskId: 'A2', allow: false, reason: 'not_assignee' })

    const spec = await request(demo).get('/openapi.yaml')
    expect(spec.status).toBe(200)
    expect(spec.text).toContain('openapi: 3.1.0')
    const docs = await request(demo).get('/docs/')
    expect(docs.status).toBe(200)
    expect(docs.text).toContain('swagger-ui')
  })

  test('[S3] /dev/reset đưa dữ liệu về seed', async () => {
    db.deleteProject('alpha')
    const res = await request(demo).post('/dev/reset')
    expect(res.status).toBe(204)
    expect(db.findProject('alpha')).toBeDefined()
  })
})
