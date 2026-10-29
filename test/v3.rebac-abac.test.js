const db = require('../src/db')
const { api, bearer, expectDenied } = require('./helpers')

beforeEach(() => db.resetDb())

const patchAs = (userId, taskId, body) =>
  api().patch(`/tasks/${taskId}`).set('Authorization', bearer(userId)).send(body)

describe('V3 - Member chỉ sửa task được giao cho mình khi task còn Open', () => {
  test('[O11] Bob sửa A1 (giao cho Bob, Open) -> 200', async () => {
    const res = await patchAs('bob', 'A1', { title: 'Bob cập nhật' })
    expect(res.status).toBe(200)
    expect(db.findTask('A1').title).toBe('Bob cập nhật')
  })

  test('[O12] Bob sửa A2 (chưa được giao) -> 403, A2 không đổi', async () => {
    const res = await patchAs('bob', 'A2', { title: 'Bob sửa trộm' })
    expectDenied(res, 403)
    expect(db.findTask('A2').title).toBe('Viết tài liệu API')
  })

  test('[O13] Bob sửa A1 khi A1 đã Closed -> 403', async () => {
    db.updateTask('A1', { status: 'Closed' })
    const res = await patchAs('bob', 'A1', { title: 'Sửa task đã đóng' })
    expectDenied(res, 403)
    expect(db.findTask('A1').title).toBe('Thiết kế màn hình đăng nhập')
  })

  test('[O14] Bob sửa B1 (project khác) -> 404', async () => {
    const res = await patchAs('bob', 'B1', { title: 'Sửa task Beta' })
    expectDenied(res, 404)
    expect(db.findTask('B1').title).toBe('Kế hoạch ra mắt Beta')
  })
})

describe('V3 - điều kiện lấy từ dữ liệu đang lưu, không lấy từ body', () => {
  test('[E3] Bob gửi assignee=bob để sửa A2 -> 403, A2 vẫn chưa giao', async () => {
    const res = await patchAs('bob', 'A2', { assignee: 'bob', title: 'Tự giao cho mình' })
    expectDenied(res, 403)
    expect(db.findTask('A2').assignee).toBeNull()
  })

  test('[E16] Bob đóng A1 được, nhưng gửi status=Open để mở lại thì bị từ chối', async () => {
    const close = await patchAs('bob', 'A1', { status: 'Closed' })
    expect(close.status).toBe(200)

    const reopen = await patchAs('bob', 'A1', { status: 'Open' })
    expectDenied(reopen, 403)
    expect(db.findTask('A1').status).toBe('Closed')
  })
})

describe('V3 - kết hợp RBAC, ReBAC và ABAC', () => {
  test('[E17] Owner sửa A2 dù không được giao -> 200 (điều kiện assignee chỉ áp cho Member)', async () => {
    const res = await patchAs('alice', 'A2', { title: 'Owner cập nhật' })
    expect(res.status).toBe(200)
  })

  test('[E18] Owner mở lại task đã đóng -> 200', async () => {
    db.updateTask('A1', { status: 'Closed' })
    const res = await patchAs('alice', 'A1', { status: 'Open' })
    expect(res.status).toBe(200)
    expect(db.findTask('A1').status).toBe('Open')
  })

  test('[E20] Viewer được giao task vẫn không sửa được -> 403 (assignee không thay role)', async () => {
    db.updateTask('A2', { assignee: 'vera' })
    const res = await patchAs('vera', 'A2', { title: 'Viewer sửa' })
    expectDenied(res, 403)
  })

  test('[E21] Bob vẫn là assignee của A1 nhưng đã bị gỡ khỏi project -> 404 (cần quan hệ member)', async () => {
    db.removeMember('alpha', 'bob')
    const res = await patchAs('bob', 'A1', { title: 'Sửa sau khi bị gỡ' })
    expectDenied(res, 404)
    expect(db.findTask('A1').title).toBe('Thiết kế màn hình đăng nhập')
  })
})
