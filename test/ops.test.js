const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const db = require('../src/db')
const audit = require('../src/audit')
const { api, bearer, expectDenied } = require('./helpers')

beforeEach(() => {
  db.resetDb()
  audit.clear()
})

describe('Vận hành và cấu hình an toàn', () => {
  test('[P1] GET /health trả 200 không cần token, không chứa dữ liệu nghiệp vụ', async () => {
    const res = await api().get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  test('[P2] Response không lộ framework qua header X-Powered-By', async () => {
    const res = await api().get('/tasks/A1').set('Authorization', bearer('alice'))
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  test('[P3] Body JSON sai cú pháp -> 400 invalid_json', async () => {
    const res = await api()
      .patch('/tasks/A1')
      .set('Authorization', bearer('alice'))
      .set('Content-Type', 'application/json')
      .send('{"title": ')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_json' })
  })

  test('[P4] Body lớn hơn 10kb -> 413 payload_too_large, task không đổi', async () => {
    const res = await api()
      .patch('/tasks/A1')
      .set('Authorization', bearer('alice'))
      .send({ title: 'x'.repeat(11 * 1024) })
    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: 'payload_too_large' })
    expect(db.findTask('A1').title).toBe('Thiết kế màn hình đăng nhập')
  })

  test('[P5] NODE_ENV=production mà thiếu JWT_SECRET thì không khởi động', () => {
    const result = spawnSync(process.execPath, ['-e', "require('./src/auth')"], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '' },
      encoding: 'utf8',
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('JWT_SECRET is required')
  })
})

describe('Audit log quyết định phân quyền', () => {
  const captureStdout = () => {
    const lines = []
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      lines.push(String(chunk))
      return true
    })
    return { lines, restore: () => spy.mockRestore() }
  }

  afterEach(() => {
    delete process.env.AUDIT_LOG
  })

  test('[L1] Deny ghi lý do ra log JSON, còn client chỉ nhận 404 chung', async () => {
    process.env.AUDIT_LOG = 'deny'
    const out = captureStdout()
    const sameTenant = await api().get('/tasks/A1').set('Authorization', bearer('erin'))
    const otherTenant = await api().get('/tasks/B1').set('Authorization', bearer('alice'))
    out.restore()

    expectDenied(sameTenant, 404)
    expectDenied(otherTenant, 404)
    expect(sameTenant.body).toEqual(otherTenant.body)
    const entries = out.lines.filter(l => l.includes('authz.decision')).map(l => JSON.parse(l))
    expect(entries).toEqual([
      expect.objectContaining({ userId: 'erin', action: 'task:read', taskId: 'A1', allow: false, reason: 'not_member' }),
      expect.objectContaining({ userId: 'alice', action: 'task:read', taskId: 'B1', projectId: 'beta', allow: false, reason: 'other_tenant' }),
    ])
  })

  test('[L2] AUDIT_LOG=deny không in quyết định cho phép; AUDIT_LOG=all thì in', async () => {
    process.env.AUDIT_LOG = 'deny'
    let out = captureStdout()
    await api().get('/tasks/A1').set('Authorization', bearer('alice'))
    out.restore()
    expect(out.lines.filter(l => l.includes('authz.decision'))).toHaveLength(0)

    process.env.AUDIT_LOG = 'all'
    out = captureStdout()
    await api().get('/tasks/A1').set('Authorization', bearer('alice'))
    out.restore()
    expect(JSON.parse(out.lines.find(l => l.includes('authz.decision')))).toMatchObject({ allow: true, reason: 'role:Owner' })
  })

  test('[L3] Bộ nhớ audit gần nhất giữ thứ tự và lọc được theo seq', async () => {
    await api().get('/tasks/A1').set('Authorization', bearer('bob'))
    await api().patch('/tasks/A2').set('Authorization', bearer('bob')).send({ title: 'x' })
    const all = audit.recentEntries()
    expect(all.map(e => [e.action, e.reason])).toEqual([['task:read', 'role:Member'], ['task:edit', 'not_assignee']])
    expect(audit.recentEntries(all[0].seq)).toEqual([all[1]])
  })
})

describe('Tài liệu OpenAPI khớp route thật', () => {
  // Đọc route từ chính Express router, không gõ tay danh sách.
  const routesOf = (prefix, router) =>
    router.stack
      .filter(layer => layer.route)
      .flatMap(layer =>
        Object.keys(layer.route.methods).map(method => {
          const sub = layer.route.path === '/' ? '' : layer.route.path.replace(/:(\w+)/g, '{$1}')
          return `${method.toUpperCase()} ${prefix}${sub}`
        }))

  const documented = () => {
    const ops = []
    let current = null
    for (const line of fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8').split('\n')) {
      const p = line.match(/^ {2}(\/\S*):\s*$/)
      if (p) current = p[1]
      const m = line.match(/^ {4}(get|post|patch|put|delete):/)
      if (m && current) ops.push(`${m[1].toUpperCase()} ${current}`)
      if (/^\S/.test(line) && !line.startsWith('paths:')) current = null
    }
    return ops
  }

  test('[D1] Mọi route của API đều có trong docs/openapi.yaml và ngược lại', () => {
    const actual = [
      'GET /health',
      ...routesOf('/tasks', require('../src/routes/tasks')),
      ...routesOf('/projects', require('../src/routes/projects')),
    ]
    expect(documented().sort()).toEqual(actual.sort())
  })
})
