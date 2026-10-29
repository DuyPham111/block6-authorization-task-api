const db = require('../src/db')
const { api, bearer } = require('./helpers')

beforeEach(() => db.resetDb())

const USERS = ['alice', 'bob', 'vera', 'charlie', 'erin', 'dana']
const TASKS = ['A1', 'A2', 'B1', 'B2']

describe('Nhất quán giữa check (GET /tasks/:id) và list (GET /tasks)', () => {
  test.each(USERS)('[C1] %s: task trong danh sách đúng bằng các task đọc được từng cái', async userId => {
    const token = bearer(userId)
    const list = await api().get('/tasks').set('Authorization', token)
    expect(list.status).toBe(200)

    const readable = []
    for (const id of TASKS) {
      const res = await api().get(`/tasks/${id}`).set('Authorization', token)
      expect([200, 404]).toContain(res.status)
      if (res.status === 200) readable.push(id)
    }
    expect(list.body.map(t => t.id).sort()).toEqual(readable.sort())
  })

  test('[C2] Danh sách theo từng người: không ai thấy task ngoài phạm vi', async () => {
    const idsOf = async userId =>
      (await api().get('/tasks').set('Authorization', bearer(userId))).body.map(t => t.id).sort()
    expect(await idsOf('alice')).toEqual(['A1', 'A2'])
    expect(await idsOf('charlie')).toEqual(['B1', 'B2'])
    expect(await idsOf('dana')).toEqual(['A1', 'A2'])
    expect(await idsOf('erin')).toEqual([])
  })

  test('[C3] Sau khi bị gỡ khỏi project, task biến mất khỏi cả check lẫn list', async () => {
    db.removeMember('alpha', 'bob')
    const token = bearer('bob')
    const list = await api().get('/tasks').set('Authorization', token)
    const one = await api().get('/tasks/A1').set('Authorization', token)
    expect(list.body).toEqual([])
    expect(one.status).toBe(404)
  })
})
